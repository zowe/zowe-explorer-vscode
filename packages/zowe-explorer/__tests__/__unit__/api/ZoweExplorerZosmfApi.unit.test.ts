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

import { ZosmfUssApi, ZosmfMvsApi } from "@zowe/zowe-explorer-api";
import * as zowe from "@zowe/cli";

export declare enum TaskStage {
    IN_PROGRESS = 0,
    COMPLETE = 1,
    NOT_STARTED = 2,
    FAILED = 3,
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
        await api.copyDataSetMember({ dsn: "IBM.FROM", member: "IEFBR14" }, { dsn: "IBM.TO", member: "IEFBR15" });
    });

    it("should test that copy data set uses enq", async () => {
        const dataSet = jest.fn(async (session, toDataSet, options) => {
            expect(options).toMatchSnapshot();
            return { api: "", commandResponse: "", success: true };
        });

        (zowe as any).Copy = { dataSet };

        const api = new ZosmfMvsApi();
        api.getSession = jest.fn();
        await api.copyDataSetMember(
            { dsn: "IBM.FROM", member: "IEFBR14" },
            { dsn: "IBM.TO", member: "IEFBR15" },
            { enq: "SHR", "from-dataset": { dsn: "BROADCOM.FROM" } }
        );
    });

    it("should test that copy data set uses enq only", async () => {
        const dataSet = jest.fn(async (session, toDataSet, options) => {
            expect(options).toMatchSnapshot();
            return { api: "", commandResponse: "", success: true };
        });

        (zowe as any).Copy = { dataSet };

        const api = new ZosmfMvsApi();
        api.getSession = jest.fn();
        await api.copyDataSetMember({ dsn: "IBM.FROM", member: "IEFBR14" }, { dsn: "IBM.TO", member: "IEFBR15" }, {
            enq: "SHR",
        } as any);
    });

    it("should test that common putContent is called by putContents", async () => {
        const api = new ZosmfUssApi();

        (api.putContent as any) = jest.fn<ReturnType<typeof api.putContents>, Parameters<typeof api.putContents>>(
            async (inputFilePath: string, ussFilePath: string, binary?: boolean, localEncoding?: string, etag?: string, returnEtag?: boolean) => {
                return {
                    success: true,
                    commandResponse: "whatever",
                };
            }
        );

        await api.putContents("someLocalFile.txt", "/some/remote", true);

        expect(api.putContent).toBeCalledTimes(1);
        expect(api.putContent).toBeCalledWith("someLocalFile.txt", "/some/remote", {
            binary: true,
        });
    });

    it("should test putContent method passes all options to Zowe api method", async () => {
        const fileToUssFile = jest.fn(
            async (session: zowe.imperative.AbstractSession, inputFile: string, ussname: string, options?: zowe.IUploadOptions) => {
                expect(options).toMatchSnapshot();
                return { api: "", commandResponse: "", success: true };
            }
        );

        (zowe as any).Upload = { fileToUssFile };

        const api = new ZosmfUssApi();
        api.getSession = jest.fn();

        await api.putContent("someLocalFile.txt", "/some/remote", {
            encoding: "285",
        });
    });

    it("should test that getContents calls zowe.Download.ussFile", async () => {
        const api = new ZosmfUssApi();
        api.getSession = jest.fn();

        Object.defineProperty(zowe, "Download", {
            value: {
                ussFile: jest.fn().mockResolvedValue({
                    shouldMatch: true,
                }),
            },
            configurable: true,
        });

        expect(api.getContents("/some/input/path", {})).toStrictEqual(
            Promise.resolve(zowe.Download.ussFile(api.getSession(), "/some/input/path", {}))
        );
    });

    it("should test that fileUtils calls zowe.Utilities.putUSSPayload", async () => {
        const api = new ZosmfUssApi();
        api.getSession = jest.fn();

        Object.defineProperty(zowe, "Utilities", {
            value: {
                putUSSPayload: jest.fn().mockResolvedValue(Buffer.from("hello world!")),
            },
            configurable: true,
        });

        expect(api.fileUtils("/", {})).toStrictEqual(Promise.resolve(zowe.Utilities.putUSSPayload(api.getSession(), "/", {})));
    });
});
