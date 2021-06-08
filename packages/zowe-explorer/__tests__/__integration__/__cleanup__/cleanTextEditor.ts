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

import * as fs from "fs";
import * as path from "path";
import { ZOWETEMPFOLDER } from "../../../src/globals";
import { checkTextFileIsOpened, closeOpenedTextFile } from "../../../src/utils/workspace";

/**
 * Recursively look for open files in the text editor and close them
 *
 * @param directory path to check for file in editor that is to be closed
 */
export async function cleanTextEditor(directory) {
    if (!fs.existsSync(directory)) {
        return;
    }
    fs.readdirSync(directory).forEach(async (file) => {
        try {
            const fullpath = path.join(directory, file);
            const lstat = fs.lstatSync(fullpath);
            if (lstat.isFile()) {
                const isOpen = await checkTextFileIsOpened(fullpath);
                if (isOpen) {
                    closeOpenedTextFile(fullpath);
                }
            } else {
                cleanTextEditor(fullpath);
            }
        } catch (err) {
            // do nothing
        }
    });
}

/**
 * Passes temp directory to look for open files in text editor and close them
 *
 * @export
 */
export async function cleanOpenTextFiles() {
    if (!fs.existsSync(ZOWETEMPFOLDER)) {
        return;
    }
    try {
        await cleanTextEditor(ZOWETEMPFOLDER);
    } catch (err) {}
}
