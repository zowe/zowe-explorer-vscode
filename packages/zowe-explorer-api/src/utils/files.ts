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

export const PERM_VALUES = {
    r: 4,
    w: 2,
    x: 1,
};

export type FileAttributes = {
    gid: number;
    group: string;
    owner: string;
    uid: number;
    perms: string;
    tag?: string;
};

export function permStringToOctal(perms: string): number {
    const permsWithoutDirFlag = perms.substring(1);
    let octalValue = "";
    for (let i = 0; i + 3 <= permsWithoutDirFlag.length; i += 3) {
        const group = permsWithoutDirFlag.slice(i, i + 3);
        let groupValue = 0;
        for (const char of group) {
            if (char in PERM_VALUES) {
                groupValue += PERM_VALUES[char];
            }
        }
        octalValue = octalValue.concat(groupValue.toString());
    }

    return parseInt(octalValue);
}
