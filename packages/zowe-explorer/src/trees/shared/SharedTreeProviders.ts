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

import { IZoweTree, Types } from "@zowe/zowe-explorer-api";
import { SharedContext } from "./SharedContext";
import type { Definitions } from "../../configuration/Definitions";

export class SharedTreeProviders {
    static #ds: Types.IZoweDatasetTreeType;
    static #uss: Types.IZoweUSSTreeType;
    static #job: Types.IZoweJobTreeType;

    public static async initializeProviders(initializers: Definitions.ProviderFunctions): Promise<Definitions.IZoweProviders> {
        SharedTreeProviders.#ds = await initializers.ds();
        SharedTreeProviders.#uss = await initializers.uss();
        SharedTreeProviders.#job = await initializers.job();
        return SharedTreeProviders.providers;
    }

    public static get ds(): Types.IZoweDatasetTreeType {
        return SharedTreeProviders.#ds;
    }

    public static get uss(): Types.IZoweUSSTreeType {
        return SharedTreeProviders.#uss;
    }

    public static get job(): Types.IZoweJobTreeType {
        return SharedTreeProviders.#job;
    }

    public static get providers(): Definitions.IZoweProviders {
        return {
            ds: SharedTreeProviders.#ds,
            uss: SharedTreeProviders.#uss,
            job: SharedTreeProviders.#job,
        };
    }

    public static getSessionForAllTrees(name: string): Types.IZoweNodeType[] {
        const sessions: Types.IZoweNodeType[] = [];
        for (const key of Object.keys(SharedTreeProviders.providers)) {
            const provider = SharedTreeProviders.providers[key];
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
            (session) => session.contextValue.includes(contextValue) && SharedContext.getSessionType(session) !== SharedContext.getSessionType(node)
        );
        return sessionContextInOtherTree !== undefined;
    }

    public static getProviderForNode(node: Types.IZoweNodeType): IZoweTree<any> {
        if (SharedContext.isDsSession(node)) {
            return SharedTreeProviders.ds;
        } else if (SharedContext.isUssSession(node)) {
            return SharedTreeProviders.uss;
        } else {
            return SharedTreeProviders.job;
        }
    }
}
