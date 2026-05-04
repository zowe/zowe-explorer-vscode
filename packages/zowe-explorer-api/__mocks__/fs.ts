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



const actualFs = await vi.importActual<typeof import("fs")>("fs");
const autoMockedFs = await vi.importMock<typeof import("fs")>("fs");

const mockReadFileSync = vi.fn();

function readFileSync(filePath: string, encoding?: any) {
    // Don't mock if yargs is trying to load a locale json file
    if (filePath.match(/node_modules\.yargs/)) {
        return actualFs.readFileSync(filePath as any, encoding);
    }
    return mockReadFileSync(filePath, encoding);
}

function realpathSync(path: string): string {
    return path;
}

autoMockedFs.readFileSync = readFileSync as any;
autoMockedFs.realpathSync = realpathSync as any;
autoMockedFs.realpathSync.native = realpathSync as any;
autoMockedFs.existsSync = vi.fn(actualFs.existsSync);

export default autoMockedFs;
