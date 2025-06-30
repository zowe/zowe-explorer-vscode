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
import { extenderAttr } from "../../../__mocks__/mockCreators/shared";

describe("DatasetAttributeProvider", () => {
    beforeEach(() => {
        const instance = DataSetAttributesProvider.getInstance();
        instance.providers.length = 0;
    });
    it("Should be able register a DataSetAttributeProvider", () => {
        const DataSetAttrProv = DataSetAttributesProvider.getInstance();
        DataSetAttrProv.register(new extenderAttr());
        expect(DataSetAttrProv.providers.length).toBe(1);
    });
    it("Should be able register multiple DataSetAttributeProviders", () => {
        const DataSetAttrProv = DataSetAttributesProvider.getInstance();
        DataSetAttrProv.register(new extenderAttr());
        DataSetAttrProv.register(new extenderAttr());
        expect(DataSetAttrProv.providers.length).toBe(2);
    });
    it("Should be able to fetchAll implementations from DataSetAttributeProviders", async () => {
        const fetchAttributeProv = DataSetAttributesProvider.getInstance();
        fetchAttributeProv.register(new extenderAttr());
        const fetchAll = await fetchAttributeProv.fetchAll({ dsName: "TEST", profile: undefined });
        expect(fetchAll.length).toBe(1);
        expect(fetchAll[0].keys.size).toBe(4);
    });
});
