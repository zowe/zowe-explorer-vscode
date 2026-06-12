/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

const path = require("path");
const fs = require("fs");
const process = require("process");
const os = require("os");
const admZip = require("adm-zip");

/**
 * Downloads the latest translations submitted to Artifactory in
 * https://zowe.jfrog.io/ui/repos/tree/General/libs-snapshot-local/org/zowe/vscode/zowe-explorer-g11n
 * and copies them into the top-level and l10n folders for building a localized extension.
 */
(async () => {
    const artifactPath = "libs-snapshot-local/org/zowe/vscode/zowe-explorer-g11n";
    const baseUrl = new URL("https://zowe.jfrog.io");
    const getLatestInfoApiUrl = new URL(`artifactory/api/storage/${artifactPath}?lastModified`, baseUrl);

    const downloadUrl = await getLatestVersionInfo(getLatestInfoApiUrl);
    if(baseUrl.host !== downloadUrl.host) {
        console.warn(`WARNING. Download URL hostname ${downloadUrl.hostname} does not match base URL hostname ${baseUrl.hostname}. Zowe Explorer build will not be localized.`);
        process.exit(0);
    }

    const zipFilePath = await downloadArtifact(downloadUrl);
    await unzipArtifact(zipFilePath);
})();

async function getLatestVersionInfo(getLatestInfoApiUrl) {
    try {
        const listResponse = await fetch(getLatestInfoApiUrl);
        const listData = await listResponse.json();
        const downloadUrl = new URL(listData.uri.replace("api/storage/", ""));
        console.log(`Retrieving translations zip from ${new Date(listData.lastModified)} from Artifactory at ${downloadUrl}`);
        return downloadUrl;
    } catch (error) {
        // Don't want to break builds if this does not work
        console.warn(`WARNING. Error contacting Artifactory. Error: ${error}. Zowe Explorer build will not be localized.`);
        process.exit(0);
    }
}

async function downloadArtifact(downloadUrl) {
    try {
        const zipFileResponse = await fetch(downloadUrl);
        const zipFileData = Buffer.from(await zipFileResponse.arrayBuffer());
        const zipFilePath = path.join(os.tmpdir(), `zowe-explorer-translations-${Date.now()}.zip`);
        console.log(`Writing zip file to ${zipFilePath}`);
        fs.writeFileSync(zipFilePath, zipFileData);
        return zipFilePath;
    } catch (error) {
        console.warn(`WARNING. Error retrieving translations zip file. Error: ${error}. Zowe Explorer build will not be localized.`);
        process.exit(0);
    }
}

async function unzipArtifact(zipFilePath) {
    const tempExtractDir = path.join(os.tmpdir(), `zowe-explorer-extract-${Date.now()}`);
    try {
        const targetDir = path.normalize(path.join(__dirname, "../../.."));
        console.log(`Extracting zip file to temporary directory: ${tempExtractDir}`);
        const zip = new admZip(zipFilePath);
        zip.extractAllTo(tempExtractDir, true);

        // Calculate the package directory relative to the workspace root dynamically
        const packageRelPath = path.relative(targetDir, path.join(__dirname, ".."));
        console.log(`Copying localization files to target directory: ${targetDir}`);
        copyNlsFiles(tempExtractDir, targetDir, packageRelPath);

        fs.unlinkSync(zipFilePath);
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
        console.log("Unzipped, copied localization files, and cleaned up successfully.");
    } catch (error) {
        console.warn(`WARNING. Error unzipping translations zip file. Error: ${error}. Zowe Explorer build will not be localized.`);
        process.exit(0);
    }
}

function copyNlsFiles(srcDir, destDir, packageRelPath) {
    const srcPkgDir = path.join(srcDir, packageRelPath);
    const destPkgDir = path.join(destDir, packageRelPath);
    if (!fs.existsSync(srcPkgDir)) {
        return;
    }

    // Copy package.nls.*.json files
    const rootEntries = fs.readdirSync(srcPkgDir, { withFileTypes: true });
    for (const entry of rootEntries) {
        if (entry.isFile() && /^package\.nls\..*\.json$/.test(entry.name)) {
            if (!fs.existsSync(destPkgDir)) {
                fs.mkdirSync(destPkgDir, { recursive: true });
            }
            const srcPath = path.join(srcPkgDir, entry.name);
            const destPath = path.join(destPkgDir, entry.name);
            fs.copyFileSync(srcPath, destPath);
        }
    }

    // Copy bundle.l10n.*.json files
    const srcL10nDir = path.join(srcPkgDir, "l10n");
    const destL10nDir = path.join(destPkgDir, "l10n");
    if (fs.existsSync(srcL10nDir)) {
        const l10nEntries = fs.readdirSync(srcL10nDir, { withFileTypes: true });
        for (const entry of l10nEntries) {
            if (entry.isFile() && /^bundle\.l10n\..*\.json$/.test(entry.name)) {
                if (!fs.existsSync(destL10nDir)) {
                    fs.mkdirSync(destL10nDir, { recursive: true });
                }
                const srcPath = path.join(srcL10nDir, entry.name);
                const destPath = path.join(destL10nDir, entry.name);
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
}
