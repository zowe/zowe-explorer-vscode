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
const tmp = require("tmp");
const admZip = require("adm-zip");

/**
 * Downloads the latest translations submitted to Artifactory to
 * https://zowe.jfrog.io/ui/repos/tree/General/libs-snapshot-local/org/zowe/vscode/zowe-explorer-g11n
 * and copies them into the provides them into the top-level and l10n for building a localized extension.
 */
(async () => {
    const artifactPath = "libs-snapshot-local/org/zowe/vscode/zowe-explorer-g11n";
    const baseUrl = new URL("https://zowe.jfrog.io");
    const getLatestInfoApiUrl = new URL(`artifactory/api/storage/${artifactPath}?lastModified`, baseUrl);

    const downloadUrl = await getLatestVersionInfo(getLatestInfoApiUrl);
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
        const zipFilePath = tmp.fileSync({ postfix: ".zip" }).name;
        console.log(`Writing zip file to ${zipFilePath}`);
        fs.writeFileSync(zipFilePath, zipFileData);
        return zipFilePath;
    } catch (error) {
        console.warn(`WARNING. Error retrieving translations zip file. Error: ${error}. Zowe Explorer build will not be localized.`);
        process.exit(0);
    }
}

async function unzipArtifact(zipFilePath) {
    try {
        // Files inside the zip are relative to top-level Zowe directory
        const targetDir = path.normalize(path.join(__dirname, "../../.."));
        console.log(`Extracting zip file to ${targetDir}`);
        const zip = new admZip(zipFilePath);
        zip.extractAllTo(targetDir, true);
        fs.unlinkSync(zipFilePath);
        console.log("Unzipped and removed zip file successfully.");
    } catch (error) {
        console.warn(`WARNING. Error unzipping translations zip file. Error: ${error}. Zowe Explorer build will not be localized.`);
        process.exit(0);
    }
}
