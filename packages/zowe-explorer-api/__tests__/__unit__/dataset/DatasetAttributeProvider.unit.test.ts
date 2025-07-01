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
    beforeEach(() => {
        const instance = DataSetAttributesProvider.getInstance();
        instance.providers.length = 0;
    });
    it("Should be able register a DataSetAttributeProvider", () => {
        const DataSetAttrProv = DataSetAttributesProvider.getInstance();
        DataSetAttrProv.register(new ExtenderAttr());
        expect(DataSetAttrProv.providers.length).toBe(1);
    });
    it("Should be able register multiple DataSetAttributeProviders", () => {
        const DataSetAttrProv = DataSetAttributesProvider.getInstance();
        DataSetAttrProv.register(new ExtenderAttr());
        DataSetAttrProv.register(new ExtenderAttr());
        expect(DataSetAttrProv.providers.length).toBe(2);
    });
    it("Should be able to fetchAll implementations from DataSetAttributeProviders", async () => {
        const fetchAttributeProv = DataSetAttributesProvider.getInstance();
        fetchAttributeProv.register(new ExtenderAttr());
        const fetchAll = await fetchAttributeProv.fetchAll({ dsName: "TEST", profile: {} as IProfileLoaded });
        expect(fetchAll.length).toBe(1);
        expect(fetchAll[0].keys.size).toBe(4);
    });
    it("Should handle a fetching attributes from an extender failing", async () => {
        const fetchAttributeProv = DataSetAttributesProvider.getInstance();
        fetchAttributeProv.register(new FailExtenderAttr());
        fetchAttributeProv.register(new ExtenderAttr());
        fetchAttributeProv.register(new FailExtenderAttr());

        const mockLogger = {
            error: jest.fn(),
        };
        jest.spyOn(Logger, "getAppLogger").mockReturnValue(mockLogger as any);
        const fetchAll = await fetchAttributeProv.fetchAll({ dsName: "TEST", profile: {} as IProfileLoaded });

        expect(fetchAll.length).toBe(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                message: "TEST: Fetching attributes failed",
            })
        );
    });
});
