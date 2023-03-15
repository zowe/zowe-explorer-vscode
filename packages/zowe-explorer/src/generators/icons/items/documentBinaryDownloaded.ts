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
import documentBinaryIcon from "./documentBinary";

const icon: IIconItem = {
    id: IconId.documentBinaryDownloaded,
    type: IconHierarchyType.derived,
    path: getIconPathInResources("document-binary-downloaded.svg"),
    check: (node) => {
        // Here we need to do check for potentially derived class, that's why any is required
        const generalizedNode = node as any;
        if (typeof generalizedNode.downloaded !== "undefined") {
            const parentCheck = documentBinaryIcon.check(generalizedNode);
            return parentCheck && (generalizedNode.downloaded as boolean);
        }

        return false;
    },
};

export default icon;
