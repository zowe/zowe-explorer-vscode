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

// import { ZosmfUssApi, ZosmfMvsApi } from "../../../src/api/ZoweExplorerZosmfApi";
import * as zowe from "@zowe/cli";
import { AbstractSession } from "@zowe/imperative";
import { ZoweExplorerApiRegister } from "../../../src/api/ZoweExplorerApiRegister";
import { createISession, createValidIProfile } from "../../../__mocks__/mockCreators/shared";
// import * as profileUtils from "../../../src/profiles/utils";
import { ZosmfMvsApi, ZosmfUssApi } from "../../../src/api/ZoweExplorerZosmfApi";

export declare enum TaskStage {
    IN_PROGRESS = 0,
    COMPLETE = 1,
    NOT_STARTED = 2,
    FAILED = 3
}

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

    it("should test putContent method passes all options to Zowe api method", async () => {
        const fileToUssFile = jest.fn(async (session: AbstractSession, inputFile: string, ussname: string, options?: zowe.IUploadOptions) => {
            expect(options).toMatchSnapshot();
            return { api: "", commandResponse: "", success: true };
        });

        (zowe as any).Upload = { fileToUssFile };

        const api = new ZosmfUssApi();
        api.getSession = jest.fn();

        await api.putContent("someLocalFile.txt", "/some/remote", {
            encoding: 285
        });
    });
});

describe("ZosmfApiCommon Unit Tests - Function getStatus", () => {
    async function createBlockMocks() {
        const newMocks = {
            baseProfile: createValidIProfile(),
            testSession: createISession(),
            commonApi: null,
            mockGetCommonApi: jest.fn()
        };

        // Common API mocks
        newMocks.commonApi = ZoweExplorerApiRegister.getCommonApi(newMocks.baseProfile);
        ZoweExplorerApiRegister.getCommonApi = newMocks.mockGetCommonApi.bind(ZoweExplorerApiRegister);
        newMocks.mockGetCommonApi.mockReturnValue(newMocks.commonApi);
        Object.defineProperty(zowe.CheckStatus, "getZosmfInfo", { value: jest.fn().mockReturnValue(true), configurable: true });
        Object.defineProperty(newMocks.commonApi, "getValidSession", { value: jest.fn().mockReturnValue(newMocks.testSession), configurable: true });

        return newMocks;
    }
    it("Tests that getStatus returns Unverified if profileType is not zosmf", async () => {
        const blockMocks = await createBlockMocks();

        const newStatus = await ZoweExplorerApiRegister.getCommonApi(blockMocks.baseProfile).getStatus(null, "alternate");

        expect(newStatus).toEqual("unverified");
    });

    it("Tests that getStatus returns Active if a valid session can be retrieved", async () => {
        const blockMocks = await createBlockMocks();

        const newStatus = await ZoweExplorerApiRegister.getCommonApi(blockMocks.baseProfile).getStatus(blockMocks.baseProfile, "zosmf");

        expect(newStatus).toEqual("active");
    });

    it("Tests that getStatus returns Inactive if a valid session cannot be retrieved", async () => {
        const blockMocks = await createBlockMocks();

        jest.spyOn(blockMocks.commonApi, "getValidSession").mockReturnValueOnce(null);

        const newStatus = await ZoweExplorerApiRegister.getCommonApi(blockMocks.baseProfile).getStatus(blockMocks.baseProfile, "zosmf");

        expect(newStatus).toEqual("inactive");
    });

    it("Tests that getStatus throws an error if getValidSession fails", async () => {
        const blockMocks = await createBlockMocks();

        jest.spyOn(blockMocks.commonApi, "getValidSession").mockRejectedValueOnce(new Error("Test error"));

        let error;
        try {
            await ZoweExplorerApiRegister.getCommonApi(blockMocks.baseProfile).getStatus(blockMocks.baseProfile, "zosmf");
        } catch (err) {
            error = err;
        }

        expect(error.message).toEqual("Error: Test error");
    });
});
