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

/**
 * Downloads the latest translations submitted to Artifactory to
 * https://zowe.jfrog.io/ui/repos/tree/General/libs-snapshot-local/org/zowe/vscode/zowe-explorer-g11n
 * and copies them into the provides them into the top-level and l10n for building a localized extension.
 */

const os = require("os");
const path = require("path");
const fs = require("fs");
const process = require("process");
const admZip = require("adm-zip");

const artifactPath = "libs-snapshot-local/org/zowe/vscode/zowe-explorer-g11n";
const baseUrl = new URL("https://zowe.jfrog.io");
const getLatestInfoApiUrl = new URL(`artifactory/api/storage/${artifactPath}?lastModified`, baseUrl);

(async () => {
    const listResponse = await fetch(getLatestInfoApiUrl)
        .then((r) => r.json())
        .catch((error) => {
            // Don't want to break builds if this does not work
            console.warn(`WARNING. Error contacting Artifactory. Error: ${error}. Zowe Explorer build will not be localized.`);
            process.exit(0);
        });
    const downloadUrl = new URL(listResponse.uri.replace("api/storage/", ""));
    console.log(`Retrieving translations zip from ${new Date(listResponse.lastModified)} from Artifactory at ${downloadUrl}`);

    fetch(downloadUrl)
        .then((response) => response.arrayBuffer())
        .then((arrayBuffer) => {
            const tempFile = path.join(os.tmpdir(), "zowe-explorer-g11n.zip");
            console.log(`Writing zip file to ${tempFile}`);
            fs.writeFileSync(tempFile, Buffer.from(arrayBuffer));

            // Files inside the zip are relative to top-level Zowe directory
            const targetDir = path.normalize(path.join(__dirname, "../../.."));
            console.log(`Extracting zip file to ${targetDir}`);
            const zip = new admZip(tempFile);
            zip.extractAllTo(targetDir, true);
            fs.unlinkSync(tempFile);
            console.log("Unzipped and removed zip file successfully.");
        })
        .catch((error) => {
            console.warn(`WARNING. Error retrieving or unzipping translations zip file. Error: ${error}. Zowe Explorer build will not be localized.`);
            process.exit(0);
        });
})();
