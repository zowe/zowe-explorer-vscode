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
import { isDocument } from "../../../shared/context";

const icon: IIconItem = {
    id: IconId.document,
    type: IconHierarchyType.base,
    path: getIconPathInResources("document.svg"),
    check: (node) => isDocument(node),
};

export default icon;
