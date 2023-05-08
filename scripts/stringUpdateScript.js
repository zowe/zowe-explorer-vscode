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

// This script creates the i18n/sample template used for adding/updating i18n files
const fse = require("fs-extra");
const path = require("path");

// Clean out i18n samples directory
fse.emptyDirSync("./i18n/sample");

for (const metadataJson of require("glob").sync("./out/src/**/*.nls.metadata.json")) {
    // Read localization metadata files
    const parsedData = JSON.parse(fse.readFileSync(metadataJson).toString());
    const keysPairsData = {};

    // Extract localization key/value pairs from metadata files
    parsedData.keys.forEach((key, i) => (keysPairsData[key] = parsedData.messages[i]));
    if (Object.keys(keysPairsData).length === 0) {
        continue; // Don't create empty files
    }

    // Write to i18n sample folder to create template for new languages
    const i18nJson = metadataJson.replace("./out/src", "./i18n/sample/").replace(".nls.metadata.json", ".i18n.json");
    fse.ensureDirSync(path.dirname(i18nJson));
    fse.writeFileSync(i18nJson, JSON.stringify(keysPairsData, null, 4));
}

const keysPairsPackage = JSON.parse(fse.readFileSync("./package.nls.json").toString());
fse.writeFileSync("./i18n/sample/package.i18n.json", JSON.stringify(keysPairsPackage, null, 4));
