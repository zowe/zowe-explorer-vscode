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

import { IJob, imperative } from "@zowe/cli";
import { IZoweTreeNode, ZosEncoding } from "@zowe/zowe-explorer-api";
import * as vscode from "vscode";

export interface IZoweTreeOpts {
    label: string;
    collapsibleState: vscode.TreeItemCollapsibleState;
    parentNode?: IZoweTreeNode;
    session?: imperative.Session;
    profile?: imperative.IProfileLoaded;
    contextOverride?: string;
}

export interface IZoweDatasetTreeOpts extends IZoweTreeOpts {
    encoding?: ZosEncoding;
    etag?: string;
}

export interface IZoweUssTreeOpts extends IZoweTreeOpts {
    parentPath?: string;
    encoding?: ZosEncoding;
    etag?: string;
}

export interface IZoweJobTreeOpts extends IZoweTreeOpts {
    job?: IJob;
}
