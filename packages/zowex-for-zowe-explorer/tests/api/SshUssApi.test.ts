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
import { imperative } from "@zowe/zowe-explorer-api";
import * as fs from "node:fs";

// `node:fs` named imports are not configurable for spyOn under ESM, so mock the module.
vi.mock("node:fs", async (importActual) => {
    const actual = (await importActual()) as typeof import("node:fs");
    return {
        ...actual,
        createReadStream: vi.fn(() => ({}) as any),
        createWriteStream: vi.fn(() => ({}) as any),
    };
});

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

        it("should propagate a rejection from listFiles", async () => {
            const ussApi = new SshUssApi();
            vi.spyOn(ussApi, "client", "get").mockResolvedValue({ uss: { listFiles: vi.fn().mockRejectedValue(new Error("listFiles failed")) } });
            await expect(ussApi.fileList("fakePath")).rejects.toThrow("listFiles failed");
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

    describe("getContents", () => {
        it("should read a file into memory when a stream is provided", async () => {
            const ussApi = new SshUssApi();
            const readFileSpy = vi.fn().mockResolvedValue({ data: "Zm9v", etag: "etag1" });
            vi.spyOn(ussApi, "client", "get").mockResolvedValue({ uss: { readFile: readFileSpy } });
            vi.spyOn(ussApi as any, "buildZosFilesResponse");
            const writeSpy = vi.fn();
            const endSpy = vi.fn();

            await ussApi.getContents("/u/file", { stream: { write: writeSpy, end: endSpy } as any });

            expect(readFileSpy).toHaveBeenCalledWith({ fspath: "/u/file", encoding: undefined, stream: undefined });
            expect(writeSpy).toHaveBeenCalled();
            expect(endSpy).toHaveBeenCalled();
        });

        it("should create a write stream to a file when a file path is provided (binary)", async () => {
            const ussApi = new SshUssApi();
            const readFileSpy = vi.fn().mockResolvedValue({ data: "", etag: "etag1" });
            const createDirsSpy = vi.spyOn(imperative.IO, "createDirsSyncFromFilePath").mockImplementation(() => {});
            vi.spyOn(ussApi, "client", "get").mockResolvedValue({ uss: { readFile: readFileSpy } });
            vi.spyOn(ussApi as any, "buildZosFilesResponse");

            await ussApi.getContents("/u/file", { file: "/tmp/fake/file.txt", binary: true } as any);

            expect(createDirsSpy).toHaveBeenCalledWith("/tmp/fake/file.txt");
            expect(fs.createWriteStream).toHaveBeenCalledWith("/tmp/fake/file.txt");
            expect(readFileSpy).toHaveBeenCalledWith({ fspath: "/u/file", encoding: "binary", stream: expect.any(Function) });
        });

        it("should throw when no stream or file is provided", async () => {
            const ussApi = new SshUssApi();
            let error: Error;
            try {
                await ussApi.getContents("/u/file", {} as any);
            } catch (err) {
                error = err as Error;
            }
            expect(error).toBeDefined();
            expect(error.message).toEqual("Failed to get contents: No stream or file path provided");
        });
    });

    describe("uploadFromBuffer", () => {
        it("should write a buffer to a USS file", async () => {
            const ussApi = new SshUssApi();
            const writeFileSpy = vi.fn().mockResolvedValue({ etag: "etag1" });
            vi.spyOn(ussApi, "client", "get").mockResolvedValue({ uss: { writeFile: writeFileSpy } });
            vi.spyOn(ussApi as any, "buildZosFilesResponse");

            await ussApi.uploadFromBuffer(Buffer.from("hello"), "/u/file");

            expect(writeFileSpy).toHaveBeenCalledWith({ fspath: "/u/file", encoding: undefined, data: expect.any(String), etag: undefined });
        });

        it("should throw a 412 error on etag mismatch", async () => {
            const ussApi = new SshUssApi();
            const err = new imperative.ImperativeError({ msg: "x", additionalDetails: "Etag mismatch happened" });
            vi.spyOn(ussApi, "client", "get").mockResolvedValue({ uss: { writeFile: vi.fn().mockRejectedValue(err) } });

            let error: Error;
            try {
                await ussApi.uploadFromBuffer(Buffer.from("hi"), "/u/file");
            } catch (e) {
                error = e as Error;
            }
            expect(error.message).toEqual("Rest API failure with HTTP(S) status 412");
        });

        it("should rethrow non-etag errors", async () => {
            const ussApi = new SshUssApi();
            const err = new Error("some other failure");
            vi.spyOn(ussApi, "client", "get").mockResolvedValue({ uss: { writeFile: vi.fn().mockRejectedValue(err) } });

            let error: Error;
            try {
                await ussApi.uploadFromBuffer(Buffer.from("hi"), "/u/file");
            } catch (e) {
                error = e as Error;
            }
            expect(error).toEqual(err);
        });
    });

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

    describe("copy", () => {
        it("should copy a USS file", async () => {
            const ussApi = new SshUssApi();
            const copyUssSpy = vi.fn().mockResolvedValue({ success: true });
            vi.spyOn(ussApi, "client", "get").mockResolvedValue({ uss: { copyUss: copyUssSpy } });

            const response = await ussApi.copy("/u/dest", {
                from: "/u/src",
                recursive: true,
                overwrite: true,
                followSymlinks: true,
                preserveAttributes: true,
            });

            expect(copyUssSpy).toHaveBeenCalledWith({
                srcFsPath: "/u/src",
                dstFsPath: "/u/dest",
                recursive: true,
                followSymlinks: true,
                preserveAttributes: true,
                force: true,
            });
            expect(JSON.parse(response.toString())).toEqual(expect.objectContaining({ success: true }));
        });

        it("should use default option values when none are provided", async () => {
            const ussApi = new SshUssApi();
            const copyUssSpy = vi.fn().mockResolvedValue({ success: true });
            vi.spyOn(ussApi, "client", "get").mockResolvedValue({ uss: { copyUss: copyUssSpy } });

            await ussApi.copy("/u/dest", { from: "/u/src" });

            expect(copyUssSpy).toHaveBeenCalledWith({
                srcFsPath: "/u/src",
                dstFsPath: "/u/dest",
                recursive: false,
                followSymlinks: false,
                preserveAttributes: false,
                force: false,
            });
        });

        it("should throw when the source path is not provided", async () => {
            const ussApi = new SshUssApi();
            let error: Error;
            try {
                await ussApi.copy("/u/dest", {});
            } catch (err) {
                error = err as Error;
            }
            expect(error).toBeDefined();
            expect(error.message).toEqual("Error: unix copy 'source' cannot be undefined");
        });
    });

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
        it("should propagate a rejection from deleteFile", async () => {
            const ussApi = new SshUssApi();
            vi.spyOn(ussApi, "client", "get").mockResolvedValue({ uss: { deleteFile: vi.fn().mockRejectedValue(new Error("deleteFile failed")) } });
            await expect(ussApi.delete("fakePath")).rejects.toThrow("deleteFile failed");
        });

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

        it("should propagate a rejection from moveFile", async () => {
            const ussApi = new SshUssApi();
            vi.spyOn(ussApi, "client", "get").mockResolvedValue({ uss: { moveFile: vi.fn().mockRejectedValue(new Error("moveFile failed")) } });
            await expect(ussApi.move("fakePath", "fakeNewPath")).rejects.toThrow("moveFile failed");
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

        it("should propagate a rejection from moveFile", async () => {
            const ussApi = new SshUssApi();
            vi.spyOn(ussApi, "client", "get").mockResolvedValue({ uss: { moveFile: vi.fn().mockRejectedValue(new Error("moveFile failed")) } });
            await expect(ussApi.rename("fakePath", "fakeNewPath")).rejects.toThrow("moveFile failed");
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

    describe("updateAttributes", () => {
        it("should throw when the file no longer exists", async () => {
            const ussApi = new SshUssApi();
            vi.spyOn(ussApi, "fileList").mockResolvedValue({ success: false } as any);

            let error: Error;
            try {
                await ussApi.updateAttributes("/u/file", { tag: "IBM-1047" });
            } catch (err) {
                error = err as Error;
            }
            expect(error).toBeDefined();
            expect(error.message).toEqual("File no longer exists");
        });

        it("should update the tag of a file", async () => {
            const ussApi = new SshUssApi();
            const chtagFileSpy = vi.fn().mockResolvedValue({ success: true });
            vi.spyOn(ussApi, "fileList").mockResolvedValue({ success: true, apiResponse: { items: [{ mode: "-rw-r--r--" }] } } as any);
            vi.spyOn(ussApi, "client", "get").mockResolvedValue({ uss: { chtagFile: chtagFileSpy } });
            vi.spyOn(ussApi as any, "buildZosFilesResponse");

            await ussApi.updateAttributes("/u/file", { tag: "IBM-1047" });

            expect(chtagFileSpy).toHaveBeenCalledWith({ fspath: "/u/file", tag: "IBM-1047", recursive: false });
        });

        it("should update the owner of a directory recursively", async () => {
            const ussApi = new SshUssApi();
            const chownFileSpy = vi.fn().mockResolvedValue({ success: true });
            vi.spyOn(ussApi, "fileList").mockResolvedValue({ success: true, apiResponse: { items: [{ mode: "drwxr-xr-x" }] } } as any);
            vi.spyOn(ussApi, "client", "get").mockResolvedValue({ uss: { chownFile: chownFileSpy } });
            vi.spyOn(ussApi as any, "buildZosFilesResponse");

            await ussApi.updateAttributes("/u/dir", { uid: "100", gid: "200" });

            expect(chownFileSpy).toHaveBeenCalledWith({ fspath: "/u/dir", owner: "100:200", recursive: true });
        });

        it("should update the owner using the owner/group aliases", async () => {
            const ussApi = new SshUssApi();
            const chownFileSpy = vi.fn().mockResolvedValue({ success: true });
            vi.spyOn(ussApi, "fileList").mockResolvedValue({ success: true, apiResponse: { items: [{ mode: "-rw-r--r--" }] } } as any);
            vi.spyOn(ussApi, "client", "get").mockResolvedValue({ uss: { chownFile: chownFileSpy } });
            vi.spyOn(ussApi as any, "buildZosFilesResponse");

            await ussApi.updateAttributes("/u/file", { owner: "myuser", group: "grp" });

            expect(chownFileSpy).toHaveBeenCalledWith({ fspath: "/u/file", owner: "myuser:grp", recursive: false });
        });

        it("should update the permissions of a file", async () => {
            const ussApi = new SshUssApi();
            const chmodFileSpy = vi.fn().mockResolvedValue({ success: true });
            vi.spyOn(ussApi, "fileList").mockResolvedValue({ success: true, apiResponse: { items: [{ mode: "-rw-r--r--" }] } } as any);
            vi.spyOn(ussApi, "client", "get").mockResolvedValue({ uss: { chmodFile: chmodFileSpy } });
            vi.spyOn(ussApi as any, "buildZosFilesResponse");

            await ussApi.updateAttributes("/u/file", { perms: "755" });

            expect(chmodFileSpy).toHaveBeenCalledWith({ fspath: "/u/file", mode: "755", recursive: false });
        });

        it("should combine multiple attribute updates into the success result", async () => {
            const ussApi = new SshUssApi();
            vi.spyOn(ussApi, "fileList").mockResolvedValue({ success: true, apiResponse: { items: [{ mode: "-rw-r--r--" }] } } as any);
            vi.spyOn(ussApi, "client", "get").mockResolvedValue({
                uss: {
                    chtagFile: vi.fn().mockResolvedValue({ success: true }),
                    chmodFile: vi.fn().mockResolvedValue({ success: false }),
                },
            });
            const buildSpy = vi.spyOn(ussApi as any, "buildZosFilesResponse");

            await ussApi.updateAttributes("/u/file", { tag: "IBM-1047", perms: "755" });

            expect(buildSpy).toHaveBeenCalledWith(undefined, false);
        });
    });

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
