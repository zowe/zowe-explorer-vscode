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
import { isMigrated } from "../../../shared/context";

const migrated: IIconItem = {
    id: IconId.migrated,
    type: IconHierarchyType.base,
    path: getIconPathInResources("migrated.svg"),
    check: (node) => isMigrated(node),
};

export default migrated;
