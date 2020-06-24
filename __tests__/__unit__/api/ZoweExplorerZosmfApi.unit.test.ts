/*
* This program and the accompanying materials are made available under the terms of the *
* Eclipse Public License v2.0 which accompanies this distribution, and is available at *
* https://www.eclipse.org/legal/epl-v20.html                                      *
*                                                                                 *
* SPDX-License-Identifier: EPL-2.0                                                *
*                                                                                 *
* Copyright Contributors to the Zowe Project.                                     *
*                                                                                 *
*/

import { ZosmfUssApi, ZosmfMvsApi } from "../../../src/api/ZoweExplorerZosmfApi";
import * as zowe from "@zowe/cli";

describe("Zosmf API tests", () => {

    it("should test that copy data set uses default options", async () => {

        const dataSet = jest.fn(async (session, toDataSet, options) => {
            expect(options).toMatchSnapshot();
            return { api: "", commandResponse: "", success: true };
        });

        (zowe as any).Copy = { dataSet };

        const api = new ZosmfMvsApi();
        api.getSession = jest.fn();
        await api.copyDataSetMember({ dataSetName: "IBM.FROM", memberName: "IEFBR14" }, { dataSetName: "IBM.TO", memberName: "IEFBR15" });

    });

    it("should test that copy data set uses enq", async () => {

        const dataSet = jest.fn(async (session, toDataSet, options) => {
            expect(options).toMatchSnapshot();
            return { api: "", commandResponse: "", success: true };
        });

        (zowe as any).Copy = { dataSet };

        const api = new ZosmfMvsApi();
        api.getSession = jest.fn();
        await api.copyDataSetMember({ dataSetName: "IBM.FROM", memberName: "IEFBR14" }, { dataSetName: "IBM.TO", memberName: "IEFBR15" },
            { enq: "SHR", fromDataSet: { dataSetName: "BROADCOM.FROM" } });

    });

    it("should test that copy data set uses enq only", async () => {

        const dataSet = jest.fn(async (session, toDataSet, options) => {
            expect(options).toMatchSnapshot();
            return { api: "", commandResponse: "", success: true };
        });

        (zowe as any).Copy = { dataSet };

        const api = new ZosmfMvsApi();
        api.getSession = jest.fn();
        await api.copyDataSetMember({ dataSetName: "IBM.FROM", memberName: "IEFBR14" }, { dataSetName: "IBM.TO", memberName: "IEFBR15" },
            { enq: "SHR" } as any);

    });

    it("should test that common putContent is called by putContents", async () => {

        const api = new ZosmfUssApi();

        (api.putContent as any) = jest.fn<ReturnType<typeof api.putContents>, Parameters<typeof api.putContents>>(
            async (inputFilePath: string, ussFilePath: string,
                binary?: boolean, localEncoding?: string,
                etag?: string, returnEtag?: boolean) => {

                return {
                    success: true,
                    commandResponse: "whatever"
                };

            });

        await api.putContents("someLocalFile.txt", "/some/remote", true);

        expect(api.putContent).toBeCalledTimes(1);
        expect(api.putContent).toBeCalledWith("someLocalFile.txt", "/some/remote", {
            binary: true,
        });

    });

});
