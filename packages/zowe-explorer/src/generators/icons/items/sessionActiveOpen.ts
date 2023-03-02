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

import { IconHierarchyType, IconId, IIconItem } from "../index";
import { getIconPathInResources } from "../../../shared/utils";
import sessionActive from "./sessionActive";
import { TreeItemCollapsibleState } from "vscode";
import { ACTIVE_CONTEXT } from "../../../globals";

const icon: IIconItem = {
    id: IconId.sessionActiveOpen,
    type: IconHierarchyType.derived,
    path: getIconPathInResources("folder-root-connected-open.svg"),
    check: (node) => {
        const parentCheck = sessionActive.check(node);
        return parentCheck && node.collapsibleState === TreeItemCollapsibleState.Expanded && node.contextValue.includes(ACTIVE_CONTEXT);
    },
};

export default icon;
