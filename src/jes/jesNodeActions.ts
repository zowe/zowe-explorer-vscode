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

import { IJobFile } from "@brightside/core";

export function getSpoolLanguage(spool: IJobFile) {
    const name = spool.ddname.toLocaleUpperCase();
    const JESMSGLG = "JESMSGLG";
    const JESJCL = "JESJCL";
    const JESYSMSG = "JESYSMSG";
    if (name === JESMSGLG) {
        return JESMSGLG.toLowerCase();
    }
    if (name === JESJCL) {
        return JESJCL.toLowerCase();
    }
    if (name === JESYSMSG) {
        return JESYSMSG.toLowerCase();
    }
    return undefined;
}
