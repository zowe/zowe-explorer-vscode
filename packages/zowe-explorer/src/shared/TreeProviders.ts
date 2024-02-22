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
import { IZoweProviders } from "./IZoweProviders";
import { Types } from "@zowe/zowe-explorer-api";
import { getSessionType } from "./context";

type ProviderFunctions = {
    ds: (context: vscode.ExtensionContext) => Promise<Types.IZoweDatasetTreeType>;
    uss: (context: vscode.ExtensionContext) => Promise<Types.IZoweUSSTreeType>;
    job: (context: vscode.ExtensionContext) => Promise<Types.IZoweJobTreeType>;
};

export class TreeProviders {
    static #ds: Types.IZoweDatasetTreeType;
    static #uss: Types.IZoweUSSTreeType;
    static #job: Types.IZoweJobTreeType;

    public static async initializeProviders(context: vscode.ExtensionContext, initializers: ProviderFunctions): Promise<IZoweProviders> {
        TreeProviders.#ds = await initializers.ds(context);
        TreeProviders.#uss = await initializers.uss(context);
        TreeProviders.#job = await initializers.job(context);
        return TreeProviders.providers;
    }

    public static get ds(): Types.IZoweDatasetTreeType {
        return TreeProviders.#ds;
    }

    public static get uss(): Types.IZoweUSSTreeType {
        return TreeProviders.#uss;
    }

    public static get job(): Types.IZoweJobTreeType {
        return TreeProviders.#job;
    }

    public static get providers(): IZoweProviders {
        return {
            ds: TreeProviders.#ds,
            uss: TreeProviders.#uss,
            job: TreeProviders.#job,
        };
    }

    public static getSessionForAllTrees(name: string): Types.IZoweNodeType[] {
        const sessions: Types.IZoweNodeType[] = [];
        for (const key of Object.keys(TreeProviders.providers)) {
            const provider = TreeProviders.providers[key];
            const session = provider.mSessionNodes.find((mSessionNode: Types.IZoweNodeType) => mSessionNode.getLabel().toString() === name);
            if (session) {
                sessions.push(session);
            }
        }
        return sessions;
    }

    public static sessionIsPresentInOtherTrees(sessionName: string): boolean {
        const sessions = this.getSessionForAllTrees(sessionName);
        return sessions.length > 1;
    }

    public static contextValueExistsAcrossTrees(node: Types.IZoweNodeType, contextValue: string): boolean {
        const sessions = this.getSessionForAllTrees(node.getLabel().toString());
        const sessionContextInOtherTree = sessions.find(
            (session) => session.contextValue.includes(contextValue) && getSessionType(session) !== getSessionType(node)
        );
        return sessionContextInOtherTree !== undefined;
    }
}
