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

import { FtpUssApi } from "../../../src/ZoweExplorerFtpUssApi";
import { UssUtils } from "@zowe/zos-ftp-for-zowe-cli";
import TestUtils from "../utils/TestUtils";
import * as zowe from "@zowe/cli";
import { ZoweLogger, sessionMap } from "../../../src/extension";
import { ZoweFtpExtensionError } from "../../../src/ZoweFtpExtensionError";
import * as tmp from "tmp";

// two methods to mock modules: create a __mocks__ file for zowe-explorer-api.ts and direct mock for extension.ts
jest.mock("../../../__mocks__/@zowe/zowe-explorer-api.ts");
jest.mock("../../../src/extension.ts");

const stream = require("stream");

const readableStream = stream.Readable.from([]);
const fs = require("fs");

fs.createReadStream = jest.fn().mockReturnValue(readableStream);
const UssApi = new FtpUssApi();

describe("FtpUssApi", () => {
    beforeEach(() => {
        UssApi.checkedProfile = jest.fn().mockReturnValue({ message: "success", type: "zftp", failNotFound: false });
        UssApi.ftpClient = jest.fn().mockReturnValue({ host: "", user: "", password: "", port: "" });
        UssApi.releaseConnection = jest.fn();
        sessionMap.get = jest.fn().mockReturnValue({ ussListConnection: { connected: true } });
        ZoweLogger.getExtensionName = jest.fn().mockReturnValue("Zowe Explorer FTP Extension");
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should list uss files.", async () => {
        const response = [
            { name: "file1", size: "123" },
            { name: "dir1", size: "456" },
        ];
        UssUtils.listFiles = jest.fn().mockReturnValue(response);
        const mockParams = {
            ussFilePath: "/a/b/c",
        };
        const result = await UssApi.fileList(mockParams.ussFilePath);

        expect(result.apiResponse.items[0].name).toContain("file1");
        expect(UssUtils.listFiles).toBeCalledTimes(1);
        expect(UssApi.releaseConnection).toHaveBeenCalledTimes(0);
    });

    it("should view uss files.", async () => {
        const localFile = tmp.tmpNameSync({ tmpdir: "/tmp" });
        const response = TestUtils.getSingleLineStream();
        UssUtils.downloadFile = jest.fn().mockReturnValue(response);

        const mockParams = {
            ussFilePath: "/a/b/c.txt",
            options: {
                file: localFile,
            },
        };
        const result = await UssApi.getContents(mockParams.ussFilePath, mockParams.options);

        expect(result.apiResponse.etag).toHaveLength(40);
        expect(UssUtils.downloadFile).toBeCalledTimes(1);
        expect(UssApi.releaseConnection).toBeCalled();

        expect(response._readableState.buffer.head.data.toString()).toContain("Hello world");
    });

    const mockUssFileParams = {
        inputFilePath: "/tmp/testfile1.txt",
        ussFilePath: "/a/b/c.txt",
        etag: "123",
        returnEtag: true,
        options: {
            file: "/tmp/testfile1.txt",
        },
    };

    it("should upload uss files.", async () => {
        const localFile = tmp.tmpNameSync({ tmpdir: "/tmp" });
        const response = TestUtils.getSingleLineStream();
        UssUtils.uploadFile = jest.fn().mockReturnValue(response);
        jest.spyOn(UssApi, "getContents").mockResolvedValue({ apiResponse: { etag: "test" } } as any);
        const mockParams = {
            inputFilePath: localFile,
            ussFilePath: "/a/b/c.txt",
            etag: "test",
            returnEtag: true,
            options: {
                file: localFile,
            },
        };
        const result = await UssApi.putContents(mockParams.inputFilePath, mockParams.ussFilePath, undefined, undefined, "test", true);
        jest.spyOn(UssApi as any, "getContentsTag").mockReturnValue("test");
        expect(result.commandResponse).toContain("File uploaded successfully.");
        expect(UssUtils.downloadFile).toBeCalledTimes(1);
        expect(UssUtils.uploadFile).toBeCalledTimes(1);
        expect(UssApi.releaseConnection).toBeCalled();
    });

    it("should call putContents when calling putContent", async () => {
        const putContentsMock = jest.spyOn(UssApi, "putContents").mockImplementation();
        await UssApi.putContent(mockUssFileParams.inputFilePath, mockUssFileParams.ussFilePath);
        expect(putContentsMock).toHaveBeenCalled();
    });

    it("should upload uss directory.", async () => {
        const localpath = "/tmp";
        const files = ["file1", "file2"];
        zowe.ZosFilesUtils.getFileListFromPath = jest.fn().mockReturnValue(files);
        const mockParams = {
            inputDirectoryPath: localpath,
            ussDirectoryPath: "/a/b/c",
            options: {},
        };
        const response = {};
        jest.spyOn(UssApi, "putContents").mockResolvedValue(response as any);
        await UssApi.uploadDirectory(mockParams.inputDirectoryPath, mockParams.ussDirectoryPath, mockParams.options);

        // One call to make the folder, one call per file
        expect(UssApi.putContents).toBeCalledTimes(3);
    });

    it("should create uss directory.", async () => {
        UssUtils.makeDirectory = jest.fn();
        UssUtils.uploadFile = jest.fn();
        const mockParams = {
            ussPath: "/a/b/c",
            type: "directory",
        };
        const result = await UssApi.create(mockParams.ussPath, mockParams.type);
        expect(result.commandResponse).toContain("Directory or file created.");
        expect(UssUtils.makeDirectory).toBeCalledTimes(1);
        expect(UssUtils.uploadFile).not.toBeCalled();
        expect(UssApi.releaseConnection).toBeCalled();
    });

    it("should create uss file.", async () => {
        UssUtils.makeDirectory = jest.fn();
        UssUtils.uploadFile = jest.fn();
        const mockParams = {
            ussPath: "/a/b/c",
            type: "file",
        };
        const result = await UssApi.create(mockParams.ussPath, mockParams.type);
        expect(result.commandResponse).toContain("Directory or file created.");
        expect(UssUtils.uploadFile).toBeCalledTimes(1);
        expect(UssUtils.makeDirectory).not.toBeCalled();
        expect(UssApi.releaseConnection).toBeCalled();
    });

    it("should delete uss directory with recursive.", async () => {
        UssUtils.deleteDirectory = jest.fn();
        UssUtils.deleteFile = jest.fn();
        const mockParams = {
            ussPath: "/a/b/c",
            recursive: true,
        };
        const result = await UssApi.delete(mockParams.ussPath, mockParams.recursive);
        expect(result.commandResponse).toContain("Delete completed.");
        expect(UssUtils.deleteDirectory).toBeCalledTimes(1);
        expect(UssUtils.deleteFile).not.toBeCalled();
        expect(UssApi.releaseConnection).toBeCalled();
    });

    it("should delete uss file.", async () => {
        UssUtils.deleteDirectory = jest.fn();
        UssUtils.deleteFile = jest.fn();
        const mockParams = {
            ussPath: "/a/b/c",
            recursive: false,
        };
        const result = await UssApi.delete(mockParams.ussPath, mockParams.recursive);
        expect(result.commandResponse).toContain("Delete completed.");
        expect(UssUtils.deleteFile).toBeCalledTimes(1);
        expect(UssUtils.deleteDirectory).not.toBeCalled();
        expect(UssApi.releaseConnection).toBeCalled();
    });

    it("should rename uss file or directory.", async () => {
        UssUtils.renameFile = jest.fn();
        const mockParams = {
            currentUssPath: "/a/b/c",
            newUssPath: "/d/e/f",
        };
        const result = await UssApi.rename(mockParams.currentUssPath, mockParams.newUssPath);
        expect(result.commandResponse).toContain("Rename completed.");
        expect(UssUtils.renameFile).toBeCalledTimes(1);
        expect(UssApi.releaseConnection).toBeCalled();
    });

    it("should receive false from isFileTagBinOrAscii as it is not implemented in the FTP extension.", async () => {
        expect(await UssApi.isFileTagBinOrAscii("")).toBe(false);
    });

    it("should throw error when list files failed", async () => {
        jest.spyOn(UssUtils, "listFiles").mockImplementationOnce(
            jest.fn((val) => {
                throw new Error("List files failed.");
            })
        );
        await expect(async () => {
            await UssApi.fileList("/a/b/c");
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw error when get content failed", async () => {
        jest.spyOn(UssUtils, "downloadFile").mockImplementationOnce(() => {
            throw new Error("Download file failed.");
        });
        const localFile = tmp.tmpNameSync({ tmpdir: "/tmp" });
        const mockParams = {
            ussFilePath: "/a/b/d.txt",
            options: {
                file: localFile,
            },
        };
        await expect(async () => {
            await UssApi.getContents(mockParams.ussFilePath, mockParams.options);
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw error when put content failed", async () => {
        jest.spyOn(UssUtils, "uploadFile").mockImplementationOnce(() => {
            throw new Error("Upload file failed.");
        });
        const mockParams = {
            inputFilePath: "/a/b/c.txt",
            ussFilePath: "/a/b/c.txt",
            etag: "test",
            returnEtag: false,
            options: {
                file: "c.txt",
            },
        };
        await expect(async () => {
            await UssApi.putContent(mockParams.inputFilePath, mockParams.ussFilePath);
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw error when upload directory failed", async () => {
        jest.spyOn(UssUtils, "uploadFile").mockImplementationOnce(
            jest.fn((val) => {
                throw new Error("Upload file failed.");
            })
        );
        const mockParams = {
            inputDirectoryPath: "/a/b/c",
            ussDirectoryPath: "/a/b/c",
            options: {},
        };
        await expect(async () => {
            await UssApi.uploadDirectory(mockParams.inputDirectoryPath, mockParams.ussDirectoryPath, mockParams.options);
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw error when create file failed", async () => {
        jest.spyOn(UssUtils, "uploadFile").mockImplementationOnce(
            jest.fn((val) => {
                throw new Error("Upload file failed.");
            })
        );
        await expect(async () => {
            await UssApi.create("/a/b/c", "file");
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw error when delete file failed", async () => {
        jest.spyOn(UssUtils, "deleteFile").mockImplementationOnce(
            jest.fn((val) => {
                throw new Error("Delete file failed.");
            })
        );
        await expect(async () => {
            await UssApi.delete("/a/b/c");
        }).rejects.toThrow(ZoweFtpExtensionError);
    });

    it("should throw error when rename file failed", async () => {
        jest.spyOn(UssUtils, "renameFile").mockImplementationOnce(
            jest.fn((val) => {
                throw new Error("Rename file failed.");
            })
        );
        await expect(async () => {
            await UssApi.rename("/a/b/c", "a/b/d");
        }).rejects.toThrow(ZoweFtpExtensionError);
    });
});
