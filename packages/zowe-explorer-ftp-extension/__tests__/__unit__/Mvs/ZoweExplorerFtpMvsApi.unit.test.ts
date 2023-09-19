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

/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-var-requires */

import { FtpMvsApi } from "../../../src/ZoweExplorerFtpMvsApi";
import { DataSetUtils, FTPConfig } from "@zowe/zos-ftp-for-zowe-cli";
import TestUtils from "../utils/TestUtils";
import * as tmp from "tmp";
import { sessionMap, ZoweLogger } from "../../../src/extension";
import { Gui } from "@zowe/zowe-explorer-api";
import { ZoweFtpExtensionError } from "../../../src/ZoweFtpExtensionError";

// two methods to mock modules: create a __mocks__ file for zowe-explorer-api.ts and direct mock for extension.ts
jest.mock("../../../__mocks__/@zowe/zowe-explorer-api.ts");
jest.mock("../../../src/extension.ts");
jest.mock("vscode");

const stream = require("stream");

const readableStream = stream.Readable.from([]);
const fs = require("fs");

fs.createReadStream = jest.fn().mockReturnValue(readableStream);
const MvsApi = new FtpMvsApi();

describe("FtpMvsApi", () => {
    beforeEach(() => {
        MvsApi.checkedProfile = jest.fn().mockReturnValue({ message: "success", type: "zftp", profile: { secureFtp: false }, failNotFound: false });
        MvsApi.ftpClient = jest.fn().mockReturnValue({ host: "", user: "", password: "", port: "" });
        MvsApi.releaseConnection = jest.fn();
        sessionMap.get = jest.fn().mockReturnValue({ mvsListConnection: { connected: true } });
        ZoweLogger.getExtensionName = jest.fn().mockReturnValue("Zowe Explorer FTP Extension");
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });

    it("should list datasets.", async () => {
        const response = [
            { dsname: "IBMUSER.DS1", dsorg: "PO", volume: "MIGRATED" },
            { dsname: "IBMUSER.DS2", dsorg: "PS" },
        ];
        DataSetUtils.listDataSets = jest.fn().mockReturnValue(response);
        const mockParams = {
            filter: "IBMUSER",
        };
        const result = await MvsApi.dataSet(mockParams.filter);

        expect(result.apiResponse.items[0].dsname).toContain("IBMUSER.DS1");
        expect(DataSetUtils.listDataSets).toBeCalledTimes(1);
        expect(MvsApi.releaseConnection).toHaveBeenCalledTimes(0);
    });

    it("should list dataset members.", async () => {
        const response = [{ name: "M1" }, { name: "M2" }];
        DataSetUtils.listMembers = jest.fn().mockReturnValue(response);
        const mockParams = {
            dataSetName: "IBMUSER.DS1",
        };
        const result = await MvsApi.allMembers(mockParams.dataSetName);

        expect(result.apiResponse.items[0].member).toContain("M1");
        expect(DataSetUtils.listMembers).toBeCalledTimes(1);
        expect(MvsApi.releaseConnection).toBeCalled();
    });

    it("should view dataset content.", async () => {
        const localFile = tmp.tmpNameSync({ tmpdir: "/tmp" });
        const response = TestUtils.getSingleLineStream();
        DataSetUtils.downloadDataSet = jest.fn().mockReturnValue(response);

        const mockParams = {
            dataSetName: "IBMUSER.DS2",
            options: {
                file: localFile,
                encoding: "",
            },
        };
        const result = await MvsApi.getContents(mockParams.dataSetName, mockParams.options);

        expect(result.apiResponse.etag).toHaveLength(40);
        expect(DataSetUtils.downloadDataSet).toBeCalledTimes(1);
        expect(MvsApi.releaseConnection).toBeCalled();

        expect(response._readableState.buffer.head.data.toString()).toContain("Hello world");
    });

    it("should upload content to dataset.", async () => {
        const localFile = tmp.tmpNameSync({ tmpdir: "/tmp" });

        fs.writeFileSync(localFile, "hello");
        const response = TestUtils.getSingleLineStream();
        const response2 = [{ dsname: "IBMUSER.DS2", dsorg: "PS", lrecl: 2 }];
        DataSetUtils.listDataSets = jest.fn().mockReturnValue(response2);
        DataSetUtils.uploadDataSet = jest.fn().mockReturnValue(response);
        jest.spyOn(MvsApi, "getContents").mockResolvedValue({ apiResponse: { etag: "123" } } as any);

        const mockParams = {
            inputFilePath: localFile,
            dataSetName: "   (IBMUSER).DS2",
            options: { encoding: "", returnEtag: true, etag: "utf8" },
        };
        jest.spyOn(MvsApi as any, "getContentsTag").mockReturnValue(undefined);
        jest.spyOn(fs, "readFileSync").mockReturnValue("test");
        jest.spyOn(Gui, "warningMessage").mockImplementation();
        const result = await MvsApi.putContents(mockParams.inputFilePath, mockParams.dataSetName, mockParams.options);
        expect(result.commandResponse).toContain("Data set uploaded successfully.");
        expect(DataSetUtils.listDataSets).toBeCalledTimes(1);
        expect(DataSetUtils.uploadDataSet).toBeCalledTimes(1);
        expect(MvsApi.releaseConnection).toBeCalled();
    });

    it("should upload single space to dataset when secureFtp is true and contents are empty", async () => {
        const localFile = tmp.tmpNameSync({ tmpdir: "/tmp" });

        fs.writeFileSync(localFile, "");
        const response = TestUtils.getSingleLineStream();
        DataSetUtils.listDataSets = jest.fn().mockReturnValue([{ dsname: "USER.EMPTYDS", dsorg: "PS", lrecl: 2 }]);
        const uploadDataSetMock = jest.fn().mockReturnValue(response);
        DataSetUtils.uploadDataSet = uploadDataSetMock;
        jest.spyOn(MvsApi, "getContents").mockResolvedValue({ apiResponse: { etag: "123" } } as any);

        const mockParams = {
            inputFilePath: localFile,
            dataSetName: "USER.EMPTYDS",
            options: { encoding: "", returnEtag: true, etag: "utf8" },
        };
        jest.spyOn(MvsApi, "checkedProfile").mockReturnValueOnce({
            type: "zftp",
            message: "",
            profile: {
                secureFtp: true,
            },
            failNotFound: false,
        });

        jest.spyOn(MvsApi as any, "getContentsTag").mockReturnValue(undefined);
        jest.spyOn(fs, "readFileSync").mockReturnValue("");
        await MvsApi.putContents(mockParams.inputFilePath, mockParams.dataSetName, mockParams.options);
        expect(DataSetUtils.uploadDataSet).toHaveBeenCalledWith({ host: "", password: "", port: "", user: "" }, "USER.EMPTYDS", {
            content: " ",
            encoding: "",
            transferType: "ascii",
        });
        // ensure options object at runtime does not have localFile
        expect(Object.keys(uploadDataSetMock.mock.calls[0][2]).find((k) => k === "localFile")).toBe(undefined);
        expect(MvsApi.releaseConnection).toBeCalled();
    });

    it("should create dataset.", async () => {
        DataSetUtils.allocateDataSet = jest.fn();
        const DATA_SET_SEQUENTIAL = 4;
        const mockParams = {
            dataSetName: "IBMUSER.DS3",
            dataSetType: DATA_SET_SEQUENTIAL,
        };
        const result = await MvsApi.createDataSet(mockParams.dataSetType, mockParams.dataSetName, {
            alcunit: "test",
            blksize: 3,
            dirblk: 4,
            dsorg: "test",
            lrecl: 1,
            primary: 3,
            recfm: "test",
            secondary: 2,
        });
        expect(result.commandResponse).toContain("Data set created successfully.");
        expect(DataSetUtils.allocateDataSet).toBeCalledTimes(1);
        expect(MvsApi.releaseConnection).toBeCalled();
    });

    it("should create dataset if no options are passed in", async () => {
        DataSetUtils.allocateDataSet = jest.fn();
        const DATA_SET_SEQUENTIAL = 4;
        const mockParams = {
            dataSetName: "IBMUSER.DS3",
            dataSetType: DATA_SET_SEQUENTIAL,
        };
        const result = await MvsApi.createDataSet(mockParams.dataSetType, mockParams.dataSetName);
        expect(result.commandResponse).toContain("Data set created successfully.");
        expect(DataSetUtils.allocateDataSet).toBeCalledTimes(1);
        expect(MvsApi.releaseConnection).toBeCalled();
    });

    it("should create dataset member.", async () => {
        DataSetUtils.uploadDataSet = jest.fn();
        const mockParams = {
            dataSetName: "IBMUSER.DS2(M1)",
            type: "file",
            options: { encoding: "" },
        };
        const result = await MvsApi.createDataSetMember(mockParams.dataSetName, mockParams.options);
        expect(result.commandResponse).toContain("Member created successfully.");
        expect(DataSetUtils.uploadDataSet).toBeCalledTimes(1);
        expect(MvsApi.releaseConnection).toBeCalled();
    });

    it("should fail to call getContents if an exception occurs in FtpClient.", async () => {
        DataSetUtils.uploadDataSet = jest.fn();
        const mockParams = {
            dataSetName: "IBMUSER.DS2(M1)",
            type: "file",
            options: { encoding: "" },
        };
        jest.spyOn(FTPConfig, "connectFromArguments").mockImplementationOnce((val) => {
            throw new Error("getContents example error");
        });
        await expect(async () => {
            await MvsApi.getContents(mockParams.dataSetName, mockParams.options);
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should rename dataset or dataset member.", async () => {
        DataSetUtils.renameDataSet = jest.fn();
        const mockParams = {
            currentDataSetName: "IBMUSER.DSOLD",
            newDataSetName: "IBMUSER.DSNEW",
            dataSetName: "IBMUSER.DS1",
            currentMemberName: "OLD",
            newMemberName: "NEW",
        };
        const result = await MvsApi.renameDataSet(mockParams.currentDataSetName, mockParams.newDataSetName);
        await MvsApi.renameDataSetMember(mockParams.dataSetName, mockParams.currentMemberName, mockParams.newMemberName);
        expect(result.commandResponse).toContain("Rename completed successfully.");
        expect(DataSetUtils.renameDataSet).toBeCalledTimes(2);
        expect(MvsApi.releaseConnection).toBeCalled();
    });

    it("should delete dataset.", async () => {
        DataSetUtils.deleteDataSet = jest.fn();
        const mockParams = {
            dataSetName: "IBMUSER.DS1",
        };
        const result = await MvsApi.deleteDataSet(mockParams.dataSetName);
        expect(result.commandResponse).toContain("Delete completed successfully.");
        expect(DataSetUtils.deleteDataSet).toBeCalledTimes(1);
        expect(MvsApi.releaseConnection).toBeCalled();
    });

    it("should throw an error when copyDataSet is called", async () => {
        await expect(async () => {
            await MvsApi.copyDataSet(null, null);
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw an error when hMigrateDataSet is called", async () => {
        await expect(async () => {
            await MvsApi.hMigrateDataSet("test");
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw an error when hRecallDataSet is called", async () => {
        await expect(async () => {
            await MvsApi.hRecallDataSet("test");
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw an error when allocateLikeDataset is called", async () => {
        await expect(async () => {
            await MvsApi.allocateLikeDataSet("test", "test2");
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw an error when copyDataSetMember is called", async () => {
        await expect(async () => {
            await MvsApi.copyDataSetMember({} as any, {} as any);
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw error when list dataset failed", async () => {
        jest.spyOn(DataSetUtils, "listDataSets").mockImplementationOnce(
            jest.fn((val) => {
                throw new Error("List dataset failed.");
            })
        );
        await expect(async () => {
            await MvsApi.dataSet("DS*");
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw error when list dataset members failed", async () => {
        jest.spyOn(DataSetUtils, "listMembers").mockImplementationOnce(
            jest.fn((val) => {
                throw new Error("List members failed.");
            })
        );
        await expect(async () => {
            await MvsApi.allMembers("DS");
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw error when get contents failed", async () => {
        jest.spyOn(DataSetUtils, "downloadDataSet").mockImplementationOnce(
            jest.fn((val) => {
                throw new Error("Download dataset failed.");
            })
        );
        const mockParams = {
            dataSetName: "IBMUSER.DS2",
            options: {
                file: "/a/b/c",
                encoding: "",
            },
        };
        await expect(async () => {
            await MvsApi.getContents(mockParams.dataSetName, mockParams.options);
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw error when put contents failed", async () => {
        jest.spyOn(DataSetUtils, "uploadDataSet").mockImplementationOnce(
            jest.fn((val) => {
                throw new Error("Upload dataset failed.");
            })
        );
        const localFile = tmp.tmpNameSync({ tmpdir: "/tmp" });
        const mockParams = {
            inputFilePath: localFile,
            dataSetName: "IBMUSER.DS2",
            options: { encoding: "", returnEtag: false, etag: "utf8" },
        };
        await expect(async () => {
            await MvsApi.putContents(mockParams.inputFilePath, mockParams.dataSetName, mockParams.options);
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw error when create dataset failed", async () => {
        jest.spyOn(DataSetUtils, "allocateDataSet").mockImplementationOnce(
            jest.fn((val) => {
                throw new Error("Allocate dataset failed.");
            })
        );
        const DATA_SET_SEQUENTIAL = 4;
        const mockParams = {
            dataSetName: "IBMUSER.DS3",
            dataSetType: DATA_SET_SEQUENTIAL,
        };
        await expect(async () => {
            await MvsApi.createDataSet(mockParams.dataSetType, mockParams.dataSetName);
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw error when create dataset member failed", async () => {
        jest.spyOn(DataSetUtils, "uploadDataSet").mockImplementationOnce(
            jest.fn((val) => {
                throw new Error("Upload dataset failed.");
            })
        );
        const mockParams = {
            dataSetName: "IBMUSER.DS2(M1)",
            type: "file",
            options: { encoding: "" },
        };
        await expect(async () => {
            await MvsApi.createDataSetMember(mockParams.dataSetName, mockParams.options);
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw error when rename dataset failed", async () => {
        jest.spyOn(DataSetUtils, "renameDataSet").mockImplementationOnce(
            jest.fn((val) => {
                throw new Error("Rename dataset failed.");
            })
        );
        await expect(async () => {
            await MvsApi.renameDataSet("IBMUSER.OLD", "IBMUSER.NEW");
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw error when rename dataset member failed", async () => {
        jest.spyOn(DataSetUtils, "renameDataSet").mockImplementationOnce(
            jest.fn((val) => {
                throw new Error("Rename dataset failed.");
            })
        );
        await expect(async () => {
            await MvsApi.renameDataSetMember("IBMUSER.DS", "OLD", "NEW");
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw error when delete dataset failed", async () => {
        jest.spyOn(DataSetUtils, "deleteDataSet").mockImplementationOnce(
            jest.fn((val) => {
                throw new Error("Delete dataset failed.");
            })
        );
        await expect(async () => {
            await MvsApi.deleteDataSet("IBMUSER.DS");
        }).rejects.toThrow(ZoweFtpExtensionError);
    });
});
