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

import * as zosfiles from "@zowe/zos-files-for-zowe-sdk";
import { imperative, ZoweExplorerZosmf } from "@zowe/zowe-explorer-api";

export declare enum TaskStage {
    IN_PROGRESS = 0,
    COMPLETE = 1,
    NOT_STARTED = 2,
    FAILED = 3,
}

describe("Zosmf API tests", () => {
    it("should test that copy data set uses default options", async () => {
        const dataSet = jest.fn((_session, _toDataSet, options) => {
            expect(options).toMatchSnapshot();
            return { api: "", commandResponse: "", success: true };
        });

        (zosfiles as any).Copy = { dataSet };

        const api = new ZoweExplorerZosmf.MvsApi();
        api.getSession = jest.fn();
        await api.copyDataSetMember({ dsn: "IBM.FROM", member: "IEFBR14" }, { dsn: "IBM.TO", member: "IEFBR15" }, {
            responseTimeout: undefined,
        } as any);
    });

    it("should test that copy data set uses enq", async () => {
        const dataSet = jest.fn((_session, _toDataSet, options) => {
            expect(options).toMatchSnapshot();
            return { api: "", commandResponse: "", success: true };
        });

        (zosfiles as any).Copy = { dataSet };

        const api = new ZoweExplorerZosmf.MvsApi();
        api.getSession = jest.fn();
        await api.copyDataSetMember(
            { dsn: "IBM.FROM", member: "IEFBR14" },
            { dsn: "IBM.TO", member: "IEFBR15" },
            { enq: "SHR", "from-dataset": { dsn: "BROADCOM.FROM" }, responseTimeout: undefined }
        );
    });

    it("should test that copy data set uses enq only", async () => {
        const dataSet = jest.fn((_session, _toDataSet, options) => {
            expect(options).toMatchSnapshot();
            return { api: "", commandResponse: "", success: true };
        });

        (zosfiles as any).Copy = { dataSet };

        const api = new ZoweExplorerZosmf.MvsApi();
        api.getSession = jest.fn();
        await api.copyDataSetMember({ dsn: "IBM.FROM", member: "IEFBR14" }, { dsn: "IBM.TO", member: "IEFBR15" }, {
            enq: "SHR",
            responseTimeout: undefined,
        } as any);
    });

    it("should test putContent method passes all options to Zowe api method", async () => {
        const fileToUssFile = jest.fn(
            (_session: imperative.AbstractSession, _inputFile: string, _ussname: string, options?: zosfiles.IUploadOptions) => {
                expect(options).toMatchSnapshot();
                return { api: "", commandResponse: "", success: true };
            }
        );

        (zosfiles as any).Upload = { fileToUssFile };

        const api = new ZoweExplorerZosmf.UssApi();
        api.getSession = jest.fn();

        await api.putContent("someLocalFile.txt", "/some/remote", {
            encoding: "285",
            responseTimeout: undefined,
        });
    });

    it("should test that getContents calls zowe.Download.ussFile", async () => {
        const api = new ZoweExplorerZosmf.UssApi();
        api.getSession = jest.fn();
        const response = { shouldMatch: true };

        Object.defineProperty(zosfiles, "Download", {
            value: {
                ussFile: jest.fn().mockResolvedValue(response),
            },
            configurable: true,
        });

        await expect(api.getContents("/some/input/path", {})).resolves.toEqual(response);
    });

    it("should update the tag attribute of a USS file if a new change is made", async () => {
        const api = new ZoweExplorerZosmf.UssApi();
        const changeTagSpy = jest.fn();
        Object.defineProperty(zosfiles, "Utilities", {
            value: {
                putUSSPayload: changeTagSpy,
            },
            configurable: true,
        });
        await expect(api.updateAttributes("/test/path", { tag: "utf-8" })).resolves.not.toThrow();
        expect(changeTagSpy).toHaveBeenCalledTimes(1);
    });

    it("should get the tag of a file successfully", async () => {
        const api = new ZoweExplorerZosmf.UssApi();
        jest.spyOn(JSON, "parse").mockReturnValue({
            stdout: ["-t UTF-8 tesfile.txt"],
        });
        Object.defineProperty(zosfiles, "Utilities", {
            value: {
                putUSSPayload: () => Buffer.from(""),
            },
            configurable: true,
        });
        await expect(api.getTag("testfile.txt")).resolves.toEqual("UTF-8");
    });
});
