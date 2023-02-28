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
import { hasFileError } from "../../../shared/context";

const fileError: IIconItem = {
    id: IconId.fileError,
    type: IconHierarchyType.base,
    path: getIconPathInResources("fileError.svg"),
    check: (node) => hasFileError(node),
};

export default fileError;
