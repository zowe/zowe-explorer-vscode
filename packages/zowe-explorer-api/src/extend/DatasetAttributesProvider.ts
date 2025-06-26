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

export type attributeInfo = Array<{
    title: string;
    reference?: string;
    keys: Map<string, { displayName?: string; description?: string; value: any }>;
}>;

export type dsInfo = {
    profile: any;
    dsName: string;
};

export interface IAttributesProvider {
    fetchAttributes(context: dsInfo): attributeInfo | Promise<attributeInfo>;
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

    public async fetchAll(context: dsInfo): Promise<attributeInfo> {
        const attributes: attributeInfo = [];
        for (const provider of this.providers) {
            try {
                attributes.push(...(await provider.fetchAttributes(context)));
            } catch (e) {
                // Catch Error
            }
        }
        return attributes;
    }
}
