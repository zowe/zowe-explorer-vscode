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

import * as vscode from "vscode";

/**
 * Describes a change to which data sets, members and USS resources Zowe Explorer treats as read-only
 */
export interface IReadOnlyChangeEvent {
    /**
     * The resource whose read-only state changed.
     * Resources beneath it (e.g. members of a PDS, or files in a directory) may have changed too.
     * Undefined when the `zowe.readOnly.rules` setting changed, where any resource may have changed.
     */
    uri?: vscode.Uri;
}
