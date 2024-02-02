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

import * as zowe from "@zowe/cli";
import * as fs from "fs";
import * as os from "os";
import { Constants } from "../globals";

export class FileManagement {
    public static permStringToOctal(perms: string): number {
        const permsWithoutDirFlag = perms.substring(1);
        let octalValue = "";
        for (let i = 0; i + 3 <= permsWithoutDirFlag.length; i += 3) {
            const group = permsWithoutDirFlag.slice(i, i + 3);
            let groupValue = 0;
            for (const char of group) {
                if (char in Constants.PERM_VALUES) {
                    groupValue += Constants.PERM_VALUES[char];
                }
            }
            octalValue = octalValue.concat(groupValue.toString());
        }

        return parseInt(octalValue);
    }

    public static getZoweDir(): string {
        return zowe.getZoweDir();
    }

    public static getFullPath(anyPath: string): string {
        if (os.platform() === "win32") {
            try {
                return fs.realpathSync.native(anyPath);
            } catch (err) {
                // Fallback to realpathSync below
            }
        }
        return fs.realpathSync(anyPath);
    }
}
