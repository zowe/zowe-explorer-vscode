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

import { describe, afterEach, expect, it, vi } from "vitest";
import { SshUssApi } from "../../src/api/SshUssApi";
import * as fs from "node:fs";

describe("SshUssApi", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("fileList", () => {
        it("should list files", async () => {
            const ussApi = new SshUssApi();
            const clientSpy = vi.spyOn(ussApi, "client", "get");
            const listFilesSpy = vi.fn();
            const buildZosFilesResponseSpy = vi.spyOn(ussApi, "buildZosFilesResponse");
            const mockResponse = { items: [{ filetag: "IBM-1047" }, { filetag: "IBM-939" }], returnedRows: 2 };

            clientSpy.mockResolvedValue({ uss: { listFiles: listFilesSpy } });
            listFilesSpy.mockResolvedValue(mockResponse);
            await ussApi.fileList("fakePath");

            expect(listFilesSpy).toHaveBeenCalledTimes(1);
            expect(listFilesSpy).toHaveBeenCalledWith({ fspath: "fakePath", all: true, long: true });
            expect(buildZosFilesResponseSpy).toHaveBeenCalledTimes(1);
            expect(buildZosFilesResponseSpy).toHaveBeenCalledWith({ items: mockResponse.items, returnedRows: mockResponse.returnedRows });
        });
    });

    describe("isFileTagBinOrAscii", () => {
        it("should return if the file is bin or ascii 1", async () => {
            const ussApi = new SshUssApi();
            const fakeTag = "binary";
            const getTagSpy = vi.spyOn(ussApi, "getTag");

            getTagSpy.mockResolvedValue(fakeTag);
            const response = await ussApi.isFileTagBinOrAscii("fakePath");

            expect(response).toEqual(true);
        });
        it("should return if the file is bin or ascii 2", async () => {
            const ussApi = new SshUssApi();
            const fakeTag = "ISO8859-1";
            const getTagSpy = vi.spyOn(ussApi, "getTag");

            getTagSpy.mockResolvedValue(fakeTag);
            const response = await ussApi.isFileTagBinOrAscii("fakePath");

            expect(response).toEqual(true);
        });
        it("should return if the file is bin or ascii 3", async () => {
            const ussApi = new SshUssApi();
            const fakeTag = "IBM-1047";
            const getTagSpy = vi.spyOn(ussApi, "getTag");

            getTagSpy.mockResolvedValue(fakeTag);
            const response = await ussApi.isFileTagBinOrAscii("fakePath");

            expect(response).toEqual(false);
        });
    });

    describe.skip("getContents", () => {});

    describe.skip("uploadFromBuffer", () => {});

    describe("putContent", () => {
        it("should write file", async () => {
            const ussApi = new SshUssApi();
            const clientSpy = vi.spyOn(ussApi, "client", "get");
            const writeFileSpy = vi.fn();
            const buildZosFilesResponseSpy = vi.spyOn(ussApi, "buildZosFilesResponse");
            const mockResponse = { etag: "ABCDEF" };

            clientSpy.mockResolvedValue({ uss: { writeFile: writeFileSpy } });
            writeFileSpy.mockResolvedValue(mockResponse);
            await ussApi.putContent("fakeLocalPath", "fakePath");

            expect(writeFileSpy).toHaveBeenCalledTimes(1);
            expect(writeFileSpy).toHaveBeenCalledWith({
                fspath: "fakePath",
                encoding: undefined,
                stream: expect.any(Function),
                etag: undefined,
            });
            expect(buildZosFilesResponseSpy).toHaveBeenCalledTimes(1);
            expect(buildZosFilesResponseSpy).toHaveBeenCalledWith({ etag: "ABCDEF" });
        });

        it("should write binary file", async () => {
            const ussApi = new SshUssApi();
            const clientSpy = vi.spyOn(ussApi, "client", "get");
            const writeFileSpy = vi.fn();
            const buildZosFilesResponseSpy = vi.spyOn(ussApi, "buildZosFilesResponse");
            const mockResponse = { etag: "ABCDEF" };

            clientSpy.mockResolvedValue({ uss: { writeFile: writeFileSpy } });
            writeFileSpy.mockResolvedValue(mockResponse);
            await ussApi.putContent("fakeLocalPath", "fakePath", { binary: true });

            expect(writeFileSpy).toHaveBeenCalledTimes(1);
            expect(writeFileSpy).toHaveBeenCalledWith({
                fspath: "fakePath",
                encoding: "binary",
                stream: expect.any(Function),
                etag: undefined,
            });
            expect(buildZosFilesResponseSpy).toHaveBeenCalledTimes(1);
            expect(buildZosFilesResponseSpy).toHaveBeenCalledWith({ etag: "ABCDEF" });
        });

        it("should write encoded file", async () => {
            const ussApi = new SshUssApi();
            const clientSpy = vi.spyOn(ussApi, "client", "get");
            const writeFileSpy = vi.fn();
            const buildZosFilesResponseSpy = vi.spyOn(ussApi, "buildZosFilesResponse");
            const mockResponse = { etag: "ABCDEF" };

            clientSpy.mockResolvedValue({ uss: { writeFile: writeFileSpy } });
            writeFileSpy.mockResolvedValue(mockResponse);
            await ussApi.putContent("fakeLocalPath", "fakePath", { encoding: "IBM-1047" });

            expect(writeFileSpy).toHaveBeenCalledTimes(1);
            expect(writeFileSpy).toHaveBeenCalledWith({
                fspath: "fakePath",
                encoding: "IBM-1047",
                stream: expect.any(Function),
                etag: undefined,
            });
            expect(buildZosFilesResponseSpy).toHaveBeenCalledTimes(1);
            expect(buildZosFilesResponseSpy).toHaveBeenCalledWith({ etag: "ABCDEF" });
        });
    });

    describe("uploadDirectory", () => {
        it("should throw a not implemented error", () => {
            const ussApi = new SshUssApi();
            let error: Error;

            try {
                ussApi.uploadDirectory("fake", "fake", {});
            } catch (err) {
                error = err;
            }

            expect(error).toBeDefined();
            expect(error.message).toEqual("Not yet implemented");
        });
    });

    describe.skip("copy", () => {});

    describe("create", () => {
        it("should create a USS directory", async () => {
            const ussApi = new SshUssApi();
            const clientSpy = vi.spyOn(ussApi, "client", "get");
            const createFileSpy = vi.fn();
            const buildZosFilesResponseSpy = vi.spyOn(ussApi, "buildZosFilesResponse");
            const mockResponse = { data: "fake" };

            clientSpy.mockResolvedValue({ uss: { createFile: createFileSpy } });
            createFileSpy.mockResolvedValue(mockResponse);
            await ussApi.create("fakePath", "directory");

            expect(createFileSpy).toHaveBeenCalledTimes(1);
            expect(createFileSpy).toHaveBeenCalledWith({ fspath: "fakePath", isDir: true, mode: undefined });
            expect(buildZosFilesResponseSpy).toHaveBeenCalledTimes(1);
            expect(buildZosFilesResponseSpy).toHaveBeenCalledWith(mockResponse);
        });

        it("should create a USS file", async () => {
            const ussApi = new SshUssApi();
            const clientSpy = vi.spyOn(ussApi, "client", "get");
            const createFileSpy = vi.fn();
            const buildZosFilesResponseSpy = vi.spyOn(ussApi, "buildZosFilesResponse");
            const mockResponse = { data: "fake" };

            clientSpy.mockResolvedValue({ uss: { createFile: createFileSpy } });
            createFileSpy.mockResolvedValue(mockResponse);
            await ussApi.create("fakePath", "file");

            expect(createFileSpy).toHaveBeenCalledTimes(1);
            expect(createFileSpy).toHaveBeenCalledWith({ fspath: "fakePath", isDir: false, mode: undefined });
            expect(buildZosFilesResponseSpy).toHaveBeenCalledTimes(1);
            expect(buildZosFilesResponseSpy).toHaveBeenCalledWith(mockResponse);
        });
    });

    describe("delete", () => {
        it("should delete a USS file", async () => {
            const ussApi = new SshUssApi();
            const clientSpy = vi.spyOn(ussApi, "client", "get");
            const deleteFileSpy = vi.fn();
            const buildZosFilesResponseSpy = vi.spyOn(ussApi, "buildZosFilesResponse");
            const mockResponse = { data: "fake" };

            clientSpy.mockResolvedValue({ uss: { deleteFile: deleteFileSpy } });
            deleteFileSpy.mockResolvedValue(mockResponse);
            await ussApi.delete("fakePath");

            expect(deleteFileSpy).toHaveBeenCalledTimes(1);
            expect(deleteFileSpy).toHaveBeenCalledWith({ fspath: "fakePath", recursive: undefined });
            expect(buildZosFilesResponseSpy).toHaveBeenCalledTimes(1);
            expect(buildZosFilesResponseSpy).toHaveBeenCalledWith(mockResponse);
        });

        it("should delete a USS file non-recursively", async () => {
            const ussApi = new SshUssApi();
            const clientSpy = vi.spyOn(ussApi, "client", "get");
            const deleteFileSpy = vi.fn();
            const buildZosFilesResponseSpy = vi.spyOn(ussApi, "buildZosFilesResponse");
            const mockResponse = { data: "fake" };

            clientSpy.mockResolvedValue({ uss: { deleteFile: deleteFileSpy } });
            deleteFileSpy.mockResolvedValue(mockResponse);
            await ussApi.delete("fakePath", false);

            expect(deleteFileSpy).toHaveBeenCalledTimes(1);
            expect(deleteFileSpy).toHaveBeenCalledWith({ fspath: "fakePath", recursive: false });
            expect(buildZosFilesResponseSpy).toHaveBeenCalledTimes(1);
            expect(buildZosFilesResponseSpy).toHaveBeenCalledWith(mockResponse);
        });

        it("should delete a USS file recursively", async () => {
            const ussApi = new SshUssApi();
            const clientSpy = vi.spyOn(ussApi, "client", "get");
            const deleteFileSpy = vi.fn();
            const buildZosFilesResponseSpy = vi.spyOn(ussApi, "buildZosFilesResponse");
            const mockResponse = { data: "fake" };

            clientSpy.mockResolvedValue({ uss: { deleteFile: deleteFileSpy } });
            deleteFileSpy.mockResolvedValue(mockResponse);
            await ussApi.delete("fakePath", true);

            expect(deleteFileSpy).toHaveBeenCalledTimes(1);
            expect(deleteFileSpy).toHaveBeenCalledWith({ fspath: "fakePath", recursive: true });
            expect(buildZosFilesResponseSpy).toHaveBeenCalledTimes(1);
            expect(buildZosFilesResponseSpy).toHaveBeenCalledWith(mockResponse);
        });
    });

    describe("move", () => {
        it("should move a USS file", async () => {
            const ussApi = new SshUssApi();
            const clientSpy = vi.spyOn(ussApi, "client", "get");
            const moveFileSpy = vi.fn();
            const buildZosFilesResponseSpy = vi.spyOn(ussApi, "buildZosFilesResponse");
            const mockResponse = { data: "fake" };

            clientSpy.mockResolvedValue({ uss: { moveFile: moveFileSpy } });
            moveFileSpy.mockResolvedValue(mockResponse);
            await ussApi.move("fakePath", "fakeNewPath");

            expect(moveFileSpy).toHaveBeenCalledTimes(1);
            expect(moveFileSpy).toHaveBeenCalledWith({ source: "fakePath", target: "fakeNewPath" });
            expect(buildZosFilesResponseSpy).toHaveBeenCalledTimes(0);
        });
    });

    describe("rename", () => {
        it("should rename a USS file", async () => {
            const ussApi = new SshUssApi();
            const clientSpy = vi.spyOn(ussApi, "client", "get");
            const moveFileSpy = vi.fn();
            const buildZosFilesResponseSpy = vi.spyOn(ussApi, "buildZosFilesResponse");
            const mockResponse = { data: "fake" };

            clientSpy.mockResolvedValue({ uss: { moveFile: moveFileSpy } });
            moveFileSpy.mockResolvedValue(mockResponse);
            await ussApi.rename("fakePath", "fakeNewPath");

            expect(moveFileSpy).toHaveBeenCalledTimes(1);
            expect(moveFileSpy).toHaveBeenCalledWith({ source: "fakePath", target: "fakeNewPath" });
            expect(buildZosFilesResponseSpy).toHaveBeenCalledTimes(1);
            expect(buildZosFilesResponseSpy).toHaveBeenCalledWith(mockResponse);
        });
    });

    describe("getTag", () => {
        it("should get the tag of an untagged file", async () => {
            const ussApi = new SshUssApi();
            const clientSpy = vi.spyOn(ussApi, "client", "get");
            const listFilesSpy = vi.fn();
            const buildZosFilesResponseSpy = vi.spyOn(ussApi, "buildZosFilesResponse");
            const mockResponse = { items: [{ filetag: undefined }] };

            clientSpy.mockResolvedValue({ uss: { listFiles: listFilesSpy } });
            listFilesSpy.mockResolvedValue(mockResponse);
            const response = await ussApi.getTag("fakePath");

            expect(listFilesSpy).toHaveBeenCalledTimes(1);
            expect(listFilesSpy).toHaveBeenCalledWith({ fspath: "fakePath", all: true, long: true });
            expect(buildZosFilesResponseSpy).toHaveBeenCalledTimes(0);
            expect(response).toEqual("untagged");
        });

        it("should get the tag of a tagged file", async () => {
            const ussApi = new SshUssApi();
            const clientSpy = vi.spyOn(ussApi, "client", "get");
            const listFilesSpy = vi.fn();
            const buildZosFilesResponseSpy = vi.spyOn(ussApi, "buildZosFilesResponse");
            const mockResponse = { items: [{ filetag: "IBM-1047" }] };

            clientSpy.mockResolvedValue({ uss: { listFiles: listFilesSpy } });
            listFilesSpy.mockResolvedValue(mockResponse);
            const response = await ussApi.getTag("fakePath");

            expect(listFilesSpy).toHaveBeenCalledTimes(1);
            expect(listFilesSpy).toHaveBeenCalledWith({ fspath: "fakePath", all: true, long: true });
            expect(buildZosFilesResponseSpy).toHaveBeenCalledTimes(0);
            expect(response).toEqual("IBM-1047");
        });
    });

    describe.skip("updateAttributes", () => {});

    describe("buildZosFilesResponse", () => {
        it("should build a successful response 1", () => {
            const ussApi = new SshUssApi();
            const fakeApiResponse = {};
            const response = (ussApi as unknown).buildZosFilesResponse(fakeApiResponse);
            expect(response).toEqual({ apiResponse: {}, commandResponse: "", success: true });
        });
        it("should build a successful response 2", () => {
            const ussApi = new SshUssApi();
            const fakeApiResponse = {};
            const response = (ussApi as unknown).buildZosFilesResponse(fakeApiResponse, true);
            expect(response).toEqual({ apiResponse: {}, commandResponse: "", success: true });
        });
        it("should build a successful response 3", () => {
            const ussApi = new SshUssApi();
            const fakeApiResponse = { success: true };
            const response = (ussApi as unknown).buildZosFilesResponse(fakeApiResponse);
            expect(response).toEqual({ apiResponse: { success: true }, commandResponse: "", success: true });
        });
        it("should build a failed response 1", () => {
            const ussApi = new SshUssApi();
            const fakeApiResponse = {};
            const response = (ussApi as unknown).buildZosFilesResponse(fakeApiResponse, false);
            expect(response).toEqual({ apiResponse: {}, commandResponse: "", success: false });
        });
        it("should build a failed response 2", () => {
            const ussApi = new SshUssApi();
            const fakeApiResponse = { success: false };
            const response = (ussApi as unknown).buildZosFilesResponse(fakeApiResponse);
            expect(response).toEqual({ apiResponse: { success: false }, commandResponse: "", success: false });
        });
    });
});
