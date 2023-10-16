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
import { initDatasetProvider } from "../dataset/init";
import { initUSSProvider } from "../uss/init";
import { initJobsProvider } from "../job/init";
import { IZoweTree, IZoweTreeNode } from "@zowe/zowe-explorer-api";
import { IZoweProviders } from "./init";

export class TreeProviders {
    static #ds: IZoweTree<IZoweTreeNode>;
    static #uss: IZoweTree<IZoweTreeNode>;
    static #job: IZoweTree<IZoweTreeNode>;

    public static async initializeProviders(context: vscode.ExtensionContext): Promise<void> {
        TreeProviders.#ds = await initDatasetProvider(context);
        TreeProviders.#uss = await initUSSProvider(context);
        TreeProviders.#job = await initJobsProvider(context);
    }

    public static get ds(): IZoweTree<IZoweTreeNode> {
        return TreeProviders.#ds;
    }

    public static get uss(): IZoweTree<IZoweTreeNode> {
        return TreeProviders.#uss;
    }

    public static get job(): IZoweTree<IZoweTreeNode> {
        return TreeProviders.#job;
    }

    public static get providers(): IZoweProviders {
        return {
            ds: TreeProviders.#ds,
            uss: TreeProviders.#uss,
            job: TreeProviders.#job,
        };
    }
}
