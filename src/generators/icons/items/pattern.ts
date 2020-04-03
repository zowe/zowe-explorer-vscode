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

import { IconHierarchyType, IconId, IIconItem } from "../index";
import { getIconPathInResources } from "../../../shared/utils";
import * as globals from "../../../globals";

const icon: IIconItem = {
    id: IconId.pattern,
    type: IconHierarchyType.base,
    path: getIconPathInResources("pattern.svg"),
    check: (node) => {
        const contexts = [
            globals.DS_SESSION_CONTEXT + globals.FAV_SUFFIX,
            globals.JOBS_SESSION_CONTEXT + globals.FAV_SUFFIX,
            globals.USS_SESSION_CONTEXT + globals.FAV_SUFFIX
        ];

        return contexts.indexOf(node.contextValue) > -1;
    }
};

export default icon;
