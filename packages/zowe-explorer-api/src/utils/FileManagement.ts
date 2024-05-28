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

import { realpathSync } from "fs";
import { platform } from "os";
import { Constants } from "../globals";
import { ProfileInfo } from "@zowe/imperative";

export class FileManagement {
    public static permStringToOctal(perms: string): number {
        const permsWithoutDirFlag = perms.substring(1);
        let octalValue = "";
        const offset = 3;
        for (let i = 0; i + offset <= permsWithoutDirFlag.length; i += offset) {
            const group = permsWithoutDirFlag.slice(i, i + offset);
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
        return ProfileInfo.getZoweDir();
    }

    public static getFullPath(anyPath: string): string {
        if (platform() === "win32") {
            try {
                return realpathSync.native(anyPath);
            } catch (err) {
                // Fallback to realpathSync below
            }
        }
        return realpathSync(anyPath);
    }
}
