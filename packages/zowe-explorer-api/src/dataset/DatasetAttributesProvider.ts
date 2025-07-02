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

import { Logger, IProfileLoaded } from "@zowe/imperative";

export type AttributeInfo = {
    title: string;
    reference?: string;
    keys: Map<string, { displayName?: string; description?: string; value: boolean | number | string }>;
}[];

export type DsInfo = {
    profile: IProfileLoaded;
    dsName: string;
};

export interface IAttributesProvider {
    fetchAttributes(context: DsInfo): AttributeInfo | Promise<AttributeInfo>;
}

export class DataSetAttributesProvider {
    private static instance: DataSetAttributesProvider;

    public providers: IAttributesProvider[] = [];

    // Make the constructor private to prevent direct instantiation
    private constructor() {}

    // Add a static method to get the singleton instance
    public static getInstance(): DataSetAttributesProvider {
        if (!DataSetAttributesProvider.instance) {
            DataSetAttributesProvider.instance = new DataSetAttributesProvider();
        }
        return DataSetAttributesProvider.instance;
    }

    public register(attributeExtender: any): void {
        this.providers.push(attributeExtender);
    }

    public async fetchAll(context: DsInfo): Promise<AttributeInfo> {
        const attributes: AttributeInfo = [];

        for (const provider of this.providers) {
            try {
                attributes.push(...(await provider.fetchAttributes(context)));
            } catch (e) {
                Logger.getAppLogger().error(e);
            }
        }

        attributes.sort((a, b) => {
            const titleA = a.title.toLowerCase() || "";
            const titleB = b.title.toLowerCase() || "";
            return titleA.localeCompare(titleB);
        });

        return attributes;
    }
}
/*        const keys = new Map<string, { displayName?: string; description?: string; value: any }>([
            [
                "DescriptionAndDisplayName",
                {
                    displayName: "DisplayName",
                    description: "Description",
                    value: "Value1",
                },
            ],
            [
                "NoDescNoDisplayName",
                {
                    value: "Value2",
                },
            ],
            [
                "descNoDN",
                {
                    description: "Description - No Display Name",
                    value: "Value3",
                },
            ],
            [
                "DNnoDesc",
                {
                    displayName: "DisplayName - No Description",
                    value: "Value4",
                },
            ],
        ]);

        return [
            {
                title: "Dummy Extender",
                reference: "https://github.com/zowe/zowe-explorer-vscode",
                keys,
            },
        ]; */
