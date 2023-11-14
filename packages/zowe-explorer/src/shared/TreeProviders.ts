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
import { IZoweTree, IZoweTreeNode } from "@zowe/zowe-explorer-api";
import { IZoweProviders } from "./init";

type ProviderFunction = (context: vscode.ExtensionContext) => Promise<IZoweTree<IZoweTreeNode>>;
export class TreeProviders {
    static #ds: IZoweTree<IZoweTreeNode>;
    static #uss: IZoweTree<IZoweTreeNode>;
    static #job: IZoweTree<IZoweTreeNode>;

    public static async initializeProviders(
        context: vscode.ExtensionContext,
        initializers: { ds: ProviderFunction; uss: ProviderFunction; job: ProviderFunction }
    ): Promise<IZoweProviders> {
        TreeProviders.#ds = await initializers.ds(context);
        TreeProviders.#uss = await initializers.uss(context);
        TreeProviders.#job = await initializers.job(context);
        return TreeProviders.providers;
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
