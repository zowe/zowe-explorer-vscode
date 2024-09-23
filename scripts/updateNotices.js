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

const fs = require('fs');

const header = fs.readFileSync("../../scripts/NOTICE_HEADER", "utf-8")
const noticesFileData = fs.readFileSync("./NOTICE");
const noticesFile = fs.openSync("./NOTICE", 'w+')
fs.writeSync(noticesFile, header, 0, header.length, 0);
fs.writeSync(noticesFile, noticesFileData, 0, noticesFileData.length, header.length);
fs.close(noticesFile);
