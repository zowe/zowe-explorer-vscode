/*
* This program and the accompanying materials are made available under the terms of the *
* Eclipse Public License v2.0 which accompanies this distribution, and is available at *
* https://www.eclipse.org/legal/epl-v20.html                                      *
*                                                                                 *
* SPDX-License-Identifier: EPL-2.0                                                *
*                                                                                 *
* Copyright Contributors to the Zowe Project.                                     *
*                                                                                 *
*/

// This script creates the i18n/sample template used for adding/updating i18n files
import * as fs from "fs";

for (const metadataJson of require("glob").sync("./out/src/**/*.nls.metadata.json")) {
    // Read localization metadata files
    // Consider adding support for creating directories in the filepath if they don't exist yet
    const parsedData = JSON.parse(fs.readFileSync(metadataJson).toString());
    const keysPairsData = {};

    // Extract localization key/value pairs from metadata files
    parsedData.keys.forEach((key, i) => keysPairsData[key] = parsedData.messages[i]);

    // Write to i18n sample folder to create template for new languages
    const i18nJson = metadataJson.replace("./out/", "./i18n/sample/").replace(".nls.metadata.json", ".i18n.json");
    fs.writeFileSync(i18nJson, JSON.stringify(keysPairsData, null, 4));
}

const keysPairsPackage = JSON.parse(fs.readFileSync("./package.nls.json").toString());
fs.writeFileSync("./i18n/sample/package.i18n.json", JSON.stringify(keysPairsPackage, null, 4));
