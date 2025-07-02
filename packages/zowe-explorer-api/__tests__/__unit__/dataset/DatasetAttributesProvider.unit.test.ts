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

import { DataSetAttributesProvider } from "../../../src";
import { ExtenderAttr, FailExtenderAttr } from "../../../__mocks__/mockCreators/shared";
import { IProfileLoaded, Logger } from "@zowe/imperative";

describe("DatasetAttributeProvider", () => {
    let provider: DataSetAttributesProvider;

    const dsContext = { dsName: "TEST", profile: {} as IProfileLoaded };

    const mockAttr = (title: string) => ({
        fetchAttributes: jest.fn().mockReturnValue([{ title, keys: new Map() }]),
    });

    const mockedReturnValue = [
        {
            title: "Dummy Extender",
            reference: "https://github.com/zowe/zowe-explorer-vscode",
            keys: new Map<string, { displayName?: string; description?: string; value: any }>([
                ["DescriptionAndDisplayName", { displayName: "DisplayName", description: "Description", value: "Value1" }],
                ["NoDescNoDisplayName", { value: "Value2" }],
                ["descNoDN", { description: "Description - No Display Name", value: "Value3" }],
                ["DNnoDesc", { displayName: "DisplayName - No Description", value: "Value4" }],
            ]),
        },
    ];

    beforeEach(() => {
        provider = DataSetAttributesProvider.getInstance();
        provider.providers.length = 0;
        jest.restoreAllMocks();
    });

    it("Should be able to register a DataSetAttributeProvider", () => {
        provider.register(new ExtenderAttr());
        expect(provider.providers.length).toBe(1);
    });

    it("Should be able to register multiple DataSetAttributeProviders", () => {
        provider.register(new ExtenderAttr());
        provider.register(new ExtenderAttr());
        expect(provider.providers.length).toBe(2);
    });

    it("Should be able to fetchAll implementations from DataSetAttributeProviders", async () => {
        jest.spyOn(ExtenderAttr.prototype, "fetchAttributes").mockImplementationOnce(() => mockedReturnValue);
        provider.register(new ExtenderAttr());

        const fetchAll = await provider.fetchAll(dsContext);

        expect(fetchAll.length).toBe(1);
        expect(fetchAll[0].title).toBe("Dummy Extender");
        expect(fetchAll[0].keys.has("DescriptionAndDisplayName")).toBe(true);
    });

    it("should fetch all attributes and sort them by title", async () => {
        provider.register(mockAttr("xyz"));
        provider.register(mockAttr("abc"));
        provider.register(mockAttr("xyz"));

        const result = await provider.fetchAll(dsContext);

        expect(result).toHaveLength(3);
        expect(result.map((r) => r.title)).toEqual(["abc", "xyz", "xyz"]);
    });

    it("Should handle a fetching attributes from an extender failing", async () => {
        provider.register(new ExtenderAttr());
        provider.register(new FailExtenderAttr());

        jest.spyOn(ExtenderAttr.prototype, "fetchAttributes").mockImplementationOnce(() => mockedReturnValue);

        const mockLogger = { error: jest.fn() };
        jest.spyOn(Logger, "getAppLogger").mockReturnValue(mockLogger as any);

        const fetchAll = await provider.fetchAll(dsContext);

        expect(fetchAll).toHaveLength(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                message: "TEST: Fetching attributes failed",
            })
        );
    });
});
