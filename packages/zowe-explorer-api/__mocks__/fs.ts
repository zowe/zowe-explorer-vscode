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

const fs = jest.genMockFromModule("fs") as any;
const origExistsSync = jest.requireActual("fs").existsSync;
const origReadFileSync = jest.requireActual("fs").readFileSync;
const mockReadFileSync = fs.readFileSync;

function readFileSync(filePath: string, encoding?: string) {
    // Don't mock if yargs is trying to load a locale json file
    if (filePath.match(/node_modules.yargs/)) {
        return origReadFileSync(filePath, encoding);
    }
    return mockReadFileSync(filePath, encoding);
}

function realpathSync(path: string): string {
    return path;
}

fs.readFileSync = readFileSync;
fs.realpathSync = realpathSync;
fs.realpathSync.native = realpathSync;
fs.existsSync = origExistsSync;

module.exports = fs;
