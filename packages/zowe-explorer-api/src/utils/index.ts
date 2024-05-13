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

import { IZoweTreeNode } from "../tree";
import { workspace } from "vscode";

export * from "./Poller";
export * from "./FileManagement";

/**
 * Getter to check dirty flag for nodes opened in the editor.
 *
 * NOTE: Only works for nodes that use resource URIs (see the `resourceUri` variable in IZoweTreeNode)
 * @returns {boolean} whether the URI is open in the editor and unsaved
 */
export function isNodeInEditor(node: IZoweTreeNode): boolean {
    return workspace.textDocuments.some(({ uri, isDirty }) => uri.path === node.resourceUri?.path && isDirty);
}
