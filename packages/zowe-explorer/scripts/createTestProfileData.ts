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

const fs = require("fs");
const util = require("util");

const testProfileData = "./resources/testProfileData.ts";
const testProfileDataExample = "./resources/testProfileData.example.ts";

(async () => {
    try {
        await util.promisify(fs.access)(testProfileData);
        console.log(testProfileData, "- File already exists");
    } catch (err) {
        await util.promisify(fs.copyFile)(testProfileDataExample, testProfileData);
        console.log(testProfileData, "- File created");
    }
})();
