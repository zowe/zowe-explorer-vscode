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

// TODO: Evolve these interfaces for additional refactoring of the commonalities of
//       the three tree views. Consider adding also abstract base classes as well.

import * as vscode from "vscode";

/**
 * The base interface for Zowe tree brosers that implement the
 * vscode.TreeDataProvider.
 *
 * @export
 * @interface IZoweTree
 * @extends {vscode.TreeDataProvider<T>}
 * @template T provide a subtype of vscode.TreeItem
 */
export interface IZoweTree<T> extends vscode.TreeDataProvider<T> {
    mSessionNodes: T[];
    mFavoriteSession: T;
    mFavorites: T[];

    addSession(sessionName?: string): Promise<void>;
    refresh(): void;
}
/**
 * The base interface for Zowe tree nodes.
 *
 * @export
 * @interface IZoweTreeNode
 */
export interface IZoweTreeNode {
    getProfileName(): string;
}
