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
const path = require("path");
const packageName = process.argv[2];
const extension = process.argv[3];
const fullPackageName = `${packageName}-${process.env.npm_package_version}.${extension}`;
const targetPath = path.join("..", "..", "dist", fullPackageName);
fs.renameSync(fullPackageName, targetPath);
console.log(`Published package to ${targetPath}.`);
