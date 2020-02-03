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
    id: IconId.documentBinary,
    type: IconHierarchyType.base,
    path: getIconPathInResources("document-binary.svg"),
    check: (node) => {
        // TODO: Move contexts to constants file and do constructor as well
        const contexts = [extension.DS_BINARY_FILE_CONTEXT,
            extension.DS_BINARY_FILE_CONTEXT + extension.FAV_SUFFIX];

        return contexts.indexOf(node.contextValue) > -1;
    }
};

export default icon;
