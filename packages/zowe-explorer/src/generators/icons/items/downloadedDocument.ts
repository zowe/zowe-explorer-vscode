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
import documentIcon from "./document";
import { getIconPathInResources } from "../../../shared/utils";

const icon: IIconItem = {
    id: IconId.downloadedDocument,
    type: IconHierarchyType.derived,
    path: getIconPathInResources("document-downloaded.svg"),
    check: (node) => {
        // Here we need to do check for potentially derived class, that's why any is required
        const generalizedNode = node as any;
        if (typeof generalizedNode.downloaded !== "undefined") {
            const parentCheck = documentIcon.check(generalizedNode);
            return parentCheck && (generalizedNode.downloaded as boolean);
        }

        return false;
    },
};

export default icon;
