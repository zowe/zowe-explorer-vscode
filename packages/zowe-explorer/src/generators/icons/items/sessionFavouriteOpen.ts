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
import sessionFavouriteIcon from "./sessionFavourite";
import { TreeItemCollapsibleState } from "vscode";

const icon: IIconItem = {
    id: IconId.sessionFavouriteOpen,
    type: IconHierarchyType.derived,
    path: getIconPathInResources("folder-root-favorite-star-open.svg"),
    check: (node) => {
        const parentCheck = sessionFavouriteIcon.check(node);
        return parentCheck && node.collapsibleState === TreeItemCollapsibleState.Expanded;
    },
};

export default icon;
