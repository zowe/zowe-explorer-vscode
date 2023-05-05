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

const chalk = require("chalk");
const fs = require("fs");

require("glob")("{__mocks__,src,__tests__}/**/*.ts", (globErr, filePaths) => {
    if (globErr) {
        throw globErr;
    }
    // turn the license file into a multi line comment
    const header = fs.readFileSync("../../scripts/LICENSE_HEADER", "utf-8") +
        require("os").EOL + require("os").EOL;
    let alreadyContainedCopyright = 0;

    for (const filePath of filePaths) {
        const file = fs.readFileSync(filePath);
        let result = file.toString();
        const resultLines = result.split(/\r?\n/g);
        if (resultLines.join().indexOf(header.split(/\r?\n/g).join()) >= 0) {
            alreadyContainedCopyright++;
            continue; // already has copyright
        }
        const shebangPattern = require("shebang-regex");
        let usedShebang = "";
        result = result.replace(shebangPattern, (fullMatch) => {
            usedShebang = fullMatch + "\n"; // save the shebang that was used, if any
            return "";
        });
        // remove any existing copyright
        // Be very, very careful messing with this regex. Regex is wonderful.
        result = result.replace(/\/\*[\s\S]*?(License|SPDX)[\s\S]*?\*\/[\s\n]*/i, "");
        result = header + result; // add the new header
        result = usedShebang + result; // add the shebang back
        fs.writeFileSync(filePath, result);
    }
    console.log(
        chalk.blue("Ensured that %d files had license information" + " (%d already did)."),
        filePaths.length,
        alreadyContainedCopyright
    );
});
