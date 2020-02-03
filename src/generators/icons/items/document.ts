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
import * as extension from "../../../extension";
import { getIconPathInResources } from "../../../utils/icon";

const icon: IIconItem = {
    id: IconId.document,
    type: IconHierarchyType.base,
    path: getIconPathInResources("document.svg"),
    check: (node) => {
        // TODO: Move contexts to constants file and do constructor as well
        const contexts = [extension.DS_DS_CONTEXT,
            extension.DS_DS_CONTEXT + extension.FAV_SUFFIX,
            extension.DS_MEMBER_CONTEXT,
            extension.DS_TEXT_FILE_CONTEXT,
            extension.DS_TEXT_FILE_CONTEXT + extension.FAV_SUFFIX,
            extension.JOBS_SPOOL_CONTEXT,
            extension.DS_MIGRATED_FILE_CONTEXT,
            extension.DS_MIGRATED_FILE_CONTEXT + extension.FAV_SUFFIX];

        return contexts.indexOf(node.contextValue) > -1;
    }
};

export default icon;
