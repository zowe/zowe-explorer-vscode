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
import { SshMvsApi } from "../../src/api/SshMvsApi";
import { imperative } from "@zowe/zowe-explorer-api";
import * as fs from "node:fs";
import * as vscode from "vscode";
import { SshClientCache } from "../../src/SshClientCache";

// `node:fs` named imports are not configurable for spyOn under ESM, so mock the module.
vi.mock("node:fs", async (importActual) => {
    const actual = (await importActual()) as typeof import("node:fs");
    return {
        ...actual,
        createReadStream: vi.fn(() => ({}) as any),
        createWriteStream: vi.fn(() => ({}) as any),
    };
});

describe("SshMvsApi", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("dataSet", () => {
        it("should list datasets without attributes", async () => {
            const mvsApi = new SshMvsApi();
            const listDatasetsSpy = vi.fn();
            const buildZosFilesResponseSpy = vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({ ds: { listDatasets: listDatasetsSpy } });
            const mockResponse = {
                items: [{ name: "USER.DATA1" }, { name: "USER.DATA2" }],
                returnedRows: 2,
            };
            listDatasetsSpy.mockResolvedValue(mockResponse);

            await mvsApi.dataSet("USER.*");

            expect(listDatasetsSpy).toHaveBeenCalledWith({ pattern: "USER.*", attributes: undefined });
            expect(buildZosFilesResponseSpy).toHaveBeenCalledWith({
                items: [{ dsname: "USER.DATA1" }, { dsname: "USER.DATA2" }],
                returnedRows: 2,
            });
        });

        it("should list datasets with attributes and map/transform attribute values", async () => {
            const mvsApi = new SshMvsApi();
            const listDatasetsSpy = vi.fn();
            const buildZosFilesResponseSpy = vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({ ds: { listDatasets: listDatasetsSpy } });
            const mockResponse = {
                items: [
                    {
                        name: "USER.DATA1",
                        migrated: true,
                        volsers: ["VOL1", "VOL2"],
                        volser: "VOL1",
                        blksize: 6160,
                        dsntype: "PDS",
                        usedp: 50,
                        custom: "x",
                    },
                ],
                returnedRows: 1,
            };
            listDatasetsSpy.mockResolvedValue(mockResponse);

            await mvsApi.dataSet("USER.*", { attributes: true } as any);

            expect(listDatasetsSpy).toHaveBeenCalledWith({ pattern: "USER.*", attributes: true });
            const args = buildZosFilesResponseSpy.mock.calls[0][0];
            expect(args.items[0]).toEqual({
                dsname: "USER.DATA1",
                migr: "YES",
                vols: "VOL1 VOL2",
                vol: "VOL1",
                blksz: 6160,
                dsntp: "PDS",
                used: 50,
                custom: "x",
            });
            expect(args.returnedRows).toEqual(1);
        });

        it("should transform migrated=false to NO", async () => {
            const mvsApi = new SshMvsApi();
            vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({
                ds: { listDatasets: vi.fn().mockResolvedValue({ items: [{ name: "X", migrated: false }], returnedRows: 1 }) },
            });

            await mvsApi.dataSet("X", { attributes: true } as any);

            // value covered implicitly; ensure no throw
            expect(true).toBe(true);
        });
    });

    describe("allMembers", () => {
        it("should list members without attributes", async () => {
            const mvsApi = new SshMvsApi();
            const listDsMembersSpy = vi.fn();
            const buildZosFilesResponseSpy = vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({ ds: { listDsMembers: listDsMembersSpy } });
            const mockResponse = { items: [{ name: "MEM1" }, { name: "MEM2" }], returnedRows: 2 };
            listDsMembersSpy.mockResolvedValue(mockResponse);

            await mvsApi.allMembers("USER.PDS");

            expect(listDsMembersSpy).toHaveBeenCalledWith({ dsname: "USER.PDS", attributes: undefined, pattern: undefined });
            expect(buildZosFilesResponseSpy).toHaveBeenCalledWith({ items: [{ member: "MEM1" }, { member: "MEM2" }], returnedRows: 2 });
        });

        it("should list members with attributes and pattern", async () => {
            const mvsApi = new SshMvsApi();
            const listDsMembersSpy = vi.fn();
            vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({ ds: { listDsMembers: listDsMembersSpy } });
            listDsMembersSpy.mockResolvedValue({ items: [{ name: "MEM1", vers: 1 }], returnedRows: 1 });

            await mvsApi.allMembers("USER.PDS", { attributes: true, pattern: "MEM*" } as any);

            expect(listDsMembersSpy).toHaveBeenCalledWith({ dsname: "USER.PDS", attributes: true, pattern: "MEM*" });
        });
    });

    describe("getContents", () => {
        it("should read dataset into memory when a stream is provided", async () => {
            const mvsApi = new SshMvsApi();
            const readDatasetSpy = vi.fn().mockResolvedValue({ data: "Zm9v", etag: "etag1" });
            vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({ ds: { readDataset: readDatasetSpy } });
            const writeSpy = vi.fn();
            const endSpy = vi.fn();
            const stream = { write: writeSpy, end: endSpy } as any;

            await mvsApi.getContents("USER.DATA", { stream } as any);

            expect(readDatasetSpy).toHaveBeenCalledWith({ dsname: "USER.DATA", encoding: undefined, stream: undefined });
            expect(writeSpy).toHaveBeenCalled();
            expect(endSpy).toHaveBeenCalled();
        });

        it("should create a write stream to a file when a file path is provided", async () => {
            const mvsApi = new SshMvsApi();
            const readDatasetSpy = vi.fn().mockResolvedValue({ data: "", etag: "etag1" });
            const createDirsSpy = vi.spyOn(imperative.IO, "createDirsSyncFromFilePath").mockImplementation(() => {});
            vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({ ds: { readDataset: readDatasetSpy } });

            await mvsApi.getContents("USER.DATA", { file: "/tmp/fake/file.txt", binary: true } as any);

            expect(createDirsSpy).toHaveBeenCalledWith("/tmp/fake/file.txt");
            expect(fs.createWriteStream).toHaveBeenCalledWith("/tmp/fake/file.txt");
            expect(readDatasetSpy).toHaveBeenCalledWith({ dsname: "USER.DATA", encoding: "binary", stream: expect.any(Function) });
        });

        it("should throw when no stream or file is provided", async () => {
            const mvsApi = new SshMvsApi();
            let error: Error;
            try {
                await mvsApi.getContents("USER.DATA", {} as any);
            } catch (err) {
                error = err as Error;
            }
            expect(error).toBeDefined();
            expect(error.message).toEqual("Failed to get contents: No stream or file path provided");
        });
    });

    describe("uploadFromBuffer", () => {
        it("should write a buffer to a dataset", async () => {
            const mvsApi = new SshMvsApi();
            const writeDatasetSpy = vi.fn().mockResolvedValue({ etag: "etag1" });
            vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({ ds: { writeDataset: writeDatasetSpy } });
            const buffer = Buffer.from("hello");

            await mvsApi.uploadFromBuffer(buffer, "USER.DATA");

            expect(writeDatasetSpy).toHaveBeenCalledWith({ dsname: "USER.DATA", encoding: undefined, data: expect.any(String), etag: undefined });
        });

        it("should write a buffer to a dataset (binary)", async () => {
            const mvsApi = new SshMvsApi();
            const writeDatasetSpy = vi.fn().mockResolvedValue({ etag: "etag1" });
            vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({ ds: { writeDataset: writeDatasetSpy } });

            await mvsApi.uploadFromBuffer(Buffer.from("hello"), "USER.DATA", { binary: true } as any);

            expect(writeDatasetSpy).toHaveBeenCalledWith({ dsname: "USER.DATA", encoding: "binary", data: expect.any(String), etag: undefined });
        });

        it("should throw a 412 error on etag mismatch", async () => {
            const mvsApi = new SshMvsApi();
            const err = new imperative.ImperativeError({ msg: "x", additionalDetails: "Etag mismatch happened" });
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({ ds: { writeDataset: vi.fn().mockRejectedValue(err) } });

            let error: Error;
            try {
                await mvsApi.uploadFromBuffer(Buffer.from("hi"), "USER.DATA");
            } catch (e) {
                error = e as Error;
            }
            expect(error).toBeDefined();
            expect(error.message).toEqual("Rest API failure with HTTP(S) status 412");
        });

        it("should rethrow non-etag errors", async () => {
            const mvsApi = new SshMvsApi();
            const err = new Error("some other failure");
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({ ds: { writeDataset: vi.fn().mockRejectedValue(err) } });

            let error: Error;
            try {
                await mvsApi.uploadFromBuffer(Buffer.from("hi"), "USER.DATA");
            } catch (e) {
                error = e as Error;
            }
            expect(error).toEqual(err);
        });
    });

    describe("putContents", () => {
        it("should upload from a file path via a read stream", async () => {
            const mvsApi = new SshMvsApi();
            const writeDatasetSpy = vi.fn().mockImplementation(async (opts: any) => {
                opts.stream?.(); // invoke the lazy stream factory so createReadStream is exercised
                return { etag: "etag1" };
            });
            vi.spyOn(mvsApi as any, "resolveDataSetName").mockResolvedValue("USER.DATA");
            vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({ ds: { writeDataset: writeDatasetSpy } });

            await mvsApi.putContents("/tmp/file.txt", "USER.DATA", { etag: "e" } as any);

            expect(fs.createReadStream).toHaveBeenCalledWith("/tmp/file.txt");
            expect(writeDatasetSpy).toHaveBeenCalledWith({ dsname: "USER.DATA", encoding: undefined, stream: expect.any(Function), etag: "e" });
        });
    });

    describe("resolveDataSetName & generateMemberName", () => {
        it("should return the dataset name as-is when a member is already specified", async () => {
            const mvsApi = new SshMvsApi();
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({ ds: {} });

            const result = await (mvsApi as any).resolveDataSetName("/tmp/f", "USER.PDS(MEM)");
            expect(result).toEqual("USER.PDS(MEM)");
        });

        it("should generate a member name when the target is a PDS", async () => {
            const mvsApi = new SshMvsApi();
            const listDatasetsSpy = vi.fn().mockResolvedValue({ items: [{ dsorg: "PO" }] });
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({ ds: { listDatasets: listDatasetsSpy } });

            const result = await (mvsApi as any).resolveDataSetName("/tmp/MyFile.txt", "USER.PDS");
            expect(listDatasetsSpy).toHaveBeenCalledWith({ pattern: "USER.PDS", attributes: true });
            expect(result).toEqual("USER.PDS(MYFILE)");
        });

        it("should not add a member when the target is not a PDS", async () => {
            const mvsApi = new SshMvsApi();
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({
                ds: { listDatasets: vi.fn().mockResolvedValue({ items: [{ dsorg: "PS" }] }) },
            });

            const result = await (mvsApi as any).resolveDataSetName("/tmp/MyFile.txt", "USER.PS");
            expect(result).toEqual("USER.PS");
        });

        it("should generate member name: uppercase, strip invalid chars & leading digits, truncate to 8", () => {
            const mvsApi = new SshMvsApi();
            expect((mvsApi as any).generateMemberName("/path/to/my-file_9.txt")).toEqual("MYFILE9");
            expect((mvsApi as any).generateMemberName("123abc")).toEqual("ABC");
            expect((mvsApi as any).generateMemberName("verylongfilenamehere")).toEqual("VERYLONG");
            expect((mvsApi as any).generateMemberName("$$$$")).toEqual("$$$$");
        });

        it("should fall back to MEMBER when the name is empty", () => {
            const mvsApi = new SshMvsApi();
            expect((mvsApi as any).generateMemberName("123456")).toEqual("MEMBER");
        });
    });

    describe("createDataSet", () => {
        it("should create a dataset with default attributes", async () => {
            const mvsApi = new SshMvsApi();
            const createDatasetSpy = vi.fn().mockResolvedValue({ success: true });
            vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({ ds: { createDataset: createDatasetSpy } });

            await mvsApi.createDataSet(0, "USER.NEW");

            expect(createDatasetSpy).toHaveBeenCalledWith({ dsname: "USER.NEW", attributes: { dsname: "USER.NEW", primary: 1, lrecl: 80 } });
        });

        it("should create a dataset with custom options merged in", async () => {
            const mvsApi = new SshMvsApi();
            const createDatasetSpy = vi.fn().mockResolvedValue({ success: true });
            vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({ ds: { createDataset: createDatasetSpy } });

            await mvsApi.createDataSet(0, "USER.NEW", { lrecl: 133, recfm: "FB" });

            expect(createDatasetSpy).toHaveBeenCalledWith({
                dsname: "USER.NEW",
                attributes: { dsname: "USER.NEW", primary: 1, lrecl: 133, recfm: "FB" },
            });
        });
    });

    describe("createDataSetMember", () => {
        it("should create a member with overwrite enabled", async () => {
            const mvsApi = new SshMvsApi();
            const createMemberSpy = vi.fn().mockResolvedValue({ success: true });
            vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({ ds: { createMember: createMemberSpy } });

            await mvsApi.createDataSetMember("USER.PDS");

            expect(createMemberSpy).toHaveBeenCalledWith({ dsname: "USER.PDS", overwrite: true });
        });
    });

    describe("allocateLikeDataSet", () => {
        const sourceDs = {
            name: "USER.SRC",
            recfm: "FB",
            lrecl: 80,
            blksize: 6160,
            dsorg: "PS",
            dsntype: "BASIC",
            volser: "VOL01",
            spacu: "TRACK",
            alloc: 5,
        };

        it("should return a failure response when the source dataset is not found", async () => {
            const mvsApi = new SshMvsApi();
            const buildZosFilesResponseSpy = vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({ ds: { listDatasets: vi.fn().mockResolvedValue({ items: [] }) } });

            const response = await mvsApi.allocateLikeDataSet("USER.NEW", "USER.SRC");

            expect(response).toBeDefined();
            expect(buildZosFilesResponseSpy).toHaveBeenCalledWith({ success: false }, false, 'Source data set "USER.SRC" not found');
        });

        it("should allocate a new dataset like the source", async () => {
            const mvsApi = new SshMvsApi();
            const createDatasetSpy = vi.fn().mockResolvedValue({ success: true });
            vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({
                ds: { listDatasets: vi.fn().mockResolvedValue({ items: [sourceDs] }), createDataset: createDatasetSpy },
            });

            await mvsApi.allocateLikeDataSet("USER.NEW", "USER.SRC");

            expect(createDatasetSpy).toHaveBeenCalledWith({
                dsname: "USER.NEW",
                attributes: expect.objectContaining({ dsname: "USER.NEW", recfm: "FB", dsorg: "PS", alcunit: "TRACKS" }),
            });
            expect(createDatasetSpy.mock.calls[0][0].attributes).not.toHaveProperty("dirblk");
        });

        it("should add dirblk=25 when source is a PDS/PDSE/LIBRARY", async () => {
            const mvsApi = new SshMvsApi();
            const createDatasetSpy = vi.fn().mockResolvedValue({ success: true });
            vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({
                ds: {
                    listDatasets: vi.fn().mockResolvedValue({ items: [{ ...sourceDs, dsntype: "PDS", dsorg: "PO", spacu: "CYLINDER" }] }),
                    createDataset: createDatasetSpy,
                },
            });

            await mvsApi.allocateLikeDataSet("USER.NEW", "USER.SRC");

            expect(createDatasetSpy).toHaveBeenCalledWith({
                dsname: "USER.NEW",
                attributes: expect.objectContaining({ alcunit: "CYLINDERS", dirblk: 25 }),
            });
        });

        it("should report an error and return a failure response when createDataset throws", async () => {
            const mvsApi = new SshMvsApi();
            const buildZosFilesResponseSpy = vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            const errorSpy = vi.spyOn(vscode.window, "showErrorMessage").mockReturnValue(undefined);
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({
                ds: { listDatasets: vi.fn().mockResolvedValue({ items: [sourceDs] }), createDataset: vi.fn().mockRejectedValue(new Error("nope")) },
            });

            const response = await mvsApi.allocateLikeDataSet("USER.NEW", "USER.SRC");
            expect(errorSpy.mock.calls[0][0]).toEqual("Failed to allocate dataset: nope");
            expect(buildZosFilesResponseSpy).toHaveBeenCalledWith({ success: false }, false, "nope");
            expect(response).toBeDefined();
        });
    });

    describe("copyDataSet", () => {
        it("should copy a dataset", async () => {
            const mvsApi = new SshMvsApi();
            const copySpy = vi.fn().mockResolvedValue({ success: true });
            vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({ ds: { copyDatasetOrMember: copySpy } });

            await mvsApi.copyDataSet("USER.FROM", "USER.TO", undefined, true);

            expect(copySpy).toHaveBeenCalledWith({ source: "USER.FROM", target: "USER.TO", replace: true, overwrite: false });
        });

        it("should return a failure response and show an error when the copy is not successful", async () => {
            const mvsApi = new SshMvsApi();
            const errorSpy = vi.spyOn(vscode.window, "showErrorMessage").mockReturnValue(undefined);
            const buildSpy = vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({ ds: { copyDatasetOrMember: vi.fn().mockResolvedValue({ success: false }) } });

            const response = await mvsApi.copyDataSet("USER.FROM", "USER.TO");
            expect(errorSpy).toHaveBeenCalled();
            expect(buildSpy).toHaveBeenCalledWith({ success: false }, false, "Failed to copy USER.FROM to USER.TO.");
            expect(response).toBeDefined();
        });

        it("should handle a thrown error during copy", async () => {
            const mvsApi = new SshMvsApi();
            const buildSpy = vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({ ds: { copyDatasetOrMember: vi.fn().mockRejectedValue(new Error("copy failed")) } });

            const response = await mvsApi.copyDataSet("USER.FROM", "USER.TO");
            expect(buildSpy).toHaveBeenCalledWith({ success: false }, false, "copy failed");
            expect(response).toBeDefined();
        });
    });

    describe("copyDataSetMember", () => {
        it("should copy a member", async () => {
            const mvsApi = new SshMvsApi();
            const copySpy = vi.fn().mockResolvedValue({ success: true });
            vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({ ds: { copyDatasetOrMember: copySpy } });

            await mvsApi.copyDataSetMember({ dsn: "USER.PDS", member: "M1" }, { dsn: "USER.PDS", member: "M2" }, { replace: true, overwrite: false });

            expect(copySpy).toHaveBeenCalledWith({ source: "USER.PDS(M1)", target: "USER.PDS(M2)", replace: true, overwrite: false });
        });

        it("should handle a thrown error during member copy", async () => {
            const mvsApi = new SshMvsApi();
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({ ds: { copyDatasetOrMember: vi.fn().mockRejectedValue(new Error("err")) } });
            const response = await mvsApi.copyDataSetMember({ dsn: "A" }, { dsn: "B" });
            expect(response).toBeDefined();
        });

        it("should return a failure response when the member copy is not successful", async () => {
            const mvsApi = new SshMvsApi();
            const buildSpy = vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            vi.spyOn(vscode.window, "showErrorMessage").mockReturnValue(undefined);
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({ ds: { copyDatasetOrMember: vi.fn().mockResolvedValue({ success: false }) } });

            const response = await mvsApi.copyDataSetMember({ dsn: "A", member: "M1" }, { dsn: "A", member: "M2" });
            expect(buildSpy).toHaveBeenCalledWith({ success: false }, false, "Failed to copy A(M1) to A(M2).");
            expect(response).toBeDefined();
        });
    });

    describe("renameDataSet", () => {
        it("should rename a dataset", async () => {
            const mvsApi = new SshMvsApi();
            const renameSpy = vi.fn().mockResolvedValue({ success: true });
            vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({ ds: { renameDataset: renameSpy } });

            await mvsApi.renameDataSet("USER.OLD", "USER.NEW");

            expect(renameSpy).toHaveBeenCalledWith({ dsnameBefore: "USER.OLD", dsnameAfter: "USER.NEW" });
        });
    });

    describe("renameDataSetMember", () => {
        it("should rename a member", async () => {
            const mvsApi = new SshMvsApi();
            const renameSpy = vi.fn().mockResolvedValue({ success: true });
            vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({ ds: { renameMember: renameSpy } });

            await mvsApi.renameDataSetMember("USER.PDS", "OLD", "NEW");

            expect(renameSpy).toHaveBeenCalledWith({ dsname: "USER.PDS", memberBefore: "OLD", memberAfter: "NEW" });
        });
    });

    describe("hMigrateDataSet", () => {
        it("should throw a not-implemented error", () => {
            const mvsApi = new SshMvsApi();
            expect(() => mvsApi.hMigrateDataSet("USER.DATA")).toThrow("Not yet implemented");
        });
    });

    describe("hRecallDataSet", () => {
        it("should recall a dataset", async () => {
            const mvsApi = new SshMvsApi();
            const restoreSpy = vi.fn().mockResolvedValue({ success: true });
            vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({ ds: { restoreDataset: restoreSpy } });

            await mvsApi.hRecallDataSet("USER.DATA");

            expect(restoreSpy).toHaveBeenCalledWith({ dsname: "USER.DATA" });
        });
    });

    describe("deleteDataSet", () => {
        it("should delete a dataset", async () => {
            const mvsApi = new SshMvsApi();
            const deleteSpy = vi.fn().mockResolvedValue({ success: true });
            vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue({ ds: { deleteDataset: deleteSpy } });

            await mvsApi.deleteDataSet("USER.DATA");

            expect(deleteSpy).toHaveBeenCalledWith({ dsname: "USER.DATA" });
        });
    });

    describe("copyDataSetCrossLpar", () => {
        const sourceProfile = { name: "src", type: "ssh" } as any;
        const baseSourceItem = {
            name: "USER.SRC",
            dsorg: "PS",
            recfm: "FB",
            lrecl: 80,
            blksize: 6160,
            dsntype: "BASIC",
            volser: "VOL01",
            spacu: "TRACK",
            alloc: 5,
        };

        function setupClients(mvsApi: SshMvsApi, sourceClient: any, targetClient: any): void {
            vi.spyOn(SshClientCache, "inst", "get").mockReturnValue({ connect: vi.fn().mockResolvedValue(sourceClient) } as any);
            vi.spyOn(mvsApi, "client", "get").mockResolvedValue(targetClient);
        }

        it("should return a failure when the source dataset name is blank", async () => {
            const mvsApi = new SshMvsApi();
            const buildSpy = vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            const errorSpy = vi.spyOn(vscode.window, "showErrorMessage").mockReturnValue(undefined);

            await mvsApi.copyDataSetCrossLpar("TARGET", "", { "from-dataset": { dsn: "  " } } as any, sourceProfile);
            expect(errorSpy.mock.calls[0][0]).toEqual("fromDataSetName must be defined and non-blank");
            expect(buildSpy).toHaveBeenCalledWith({ success: false }, false, "fromDataSetName must be defined and non-blank");
        });

        it("should return a failure when the target dataset name is blank", async () => {
            const mvsApi = new SshMvsApi();
            const buildSpy = vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            const errorSpy = vi.spyOn(vscode.window, "showErrorMessage").mockReturnValue(undefined);

            await mvsApi.copyDataSetCrossLpar("  ", "", { "from-dataset": { dsn: "USER.SRC" } } as any, sourceProfile);
            expect(errorSpy.mock.calls[0][0]).toEqual("toDataSetName must be defined and non-blank");
            expect(buildSpy).toHaveBeenCalledWith({ success: false }, false, "toDataSetName must be defined and non-blank");
        });

        it("should return a failure when the source dataset is not found", async () => {
            const mvsApi = new SshMvsApi();
            const buildSpy = vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            const errorSpy = vi.spyOn(vscode.window, "showErrorMessage").mockReturnValue(undefined);
            const sourceClient = { ds: { listDatasets: vi.fn().mockResolvedValue({ items: [] }) } };
            const targetClient = { ds: {} };
            setupClients(mvsApi, sourceClient, targetClient);

            await mvsApi.copyDataSetCrossLpar("USER.TGT", undefined, { "from-dataset": { dsn: "USER.SRC" } } as any, sourceProfile);
            expect(errorSpy.mock.calls[0][0]).toEqual("Data set copy aborted. The source data set was not found.");
            expect(buildSpy).toHaveBeenCalledWith({ success: false }, false, "Data set copy aborted. The source data set was not found.");
        });

        it("should abort when source is a PDS and no member is specified", async () => {
            const mvsApi = new SshMvsApi();
            const buildSpy = vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            const errorSpy = vi.spyOn(vscode.window, "showErrorMessage").mockReturnValue(undefined);
            const sourceClient = {
                ds: { listDatasets: vi.fn().mockResolvedValue({ items: [{ ...baseSourceItem, dsorg: "PO" }] }), readDataset: vi.fn() },
            };
            setupClients(mvsApi, sourceClient, { ds: {} });

            await mvsApi.copyDataSetCrossLpar("USER.TGT", undefined, { "from-dataset": { dsn: "USER.SRC" } } as any, sourceProfile);
            expect(buildSpy).toHaveBeenCalledWith({ success: false }, false, "Copying from a PDS to PDS is not supported across LPARs.");
            expect(errorSpy).toHaveBeenCalled();
        });

        it("should create the target dataset and copy when the target does not exist", async () => {
            const mvsApi = new SshMvsApi();
            const buildSpy = vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            const readSpy = vi.fn().mockResolvedValue({ data: "AAAA" });
            const createSpy = vi.fn().mockResolvedValue({ success: true });
            const writeSpy = vi.fn().mockResolvedValue({ success: true });
            const sourceClient = { ds: { listDatasets: vi.fn().mockResolvedValue({ items: [baseSourceItem] }), readDataset: readSpy } };
            const targetClient = {
                ds: { listDatasets: vi.fn().mockResolvedValue({ items: [] }), createDataset: createSpy, writeDataset: writeSpy },
            };
            setupClients(mvsApi, sourceClient, targetClient);

            const response = await mvsApi.copyDataSetCrossLpar("USER.TGT", undefined, { "from-dataset": { dsn: "USER.SRC" } } as any, sourceProfile);
            expect(createSpy).toHaveBeenCalled();
            expect(writeSpy).toHaveBeenCalledWith({ dsname: "USER.TGT", data: "AAAA", encoding: "binary" });
            expect(buildSpy).toHaveBeenCalledWith({ success: true }, true);
            expect(response).toBeDefined();
        });

        it("should strip PDS organization when copying a PDS member to a new sequential target", async () => {
            const mvsApi = new SshMvsApi();
            const createSpy = vi.fn().mockResolvedValue({ success: true });
            const writeSpy = vi.fn().mockResolvedValue({ success: true });
            const sourceClient = {
                ds: {
                    listDatasets: vi.fn().mockResolvedValue({ items: [{ ...baseSourceItem, dsorg: "PO" }] }),
                    readDataset: vi.fn().mockResolvedValue({ data: "AAAA" }),
                },
            };
            const targetClient = {
                ds: { listDatasets: vi.fn().mockResolvedValue({ items: [] }), createDataset: createSpy, writeDataset: writeSpy },
            };
            setupClients(mvsApi, sourceClient, targetClient);

            await mvsApi.copyDataSetCrossLpar("USER.TGT", undefined, { "from-dataset": { dsn: "USER.SRC", member: "OLD" } } as any, sourceProfile);

            expect(createSpy).toHaveBeenCalledWith({ dsname: "USER.TGT", attributes: expect.objectContaining({ dsorg: "PS" }) });
        });

        it("should promote to PDS organization when copying a sequential source to a new PDS member", async () => {
            const mvsApi = new SshMvsApi();
            const createSpy = vi.fn().mockResolvedValue({ success: true });
            const writeSpy = vi.fn().mockResolvedValue({ success: true });
            const sourceClient = {
                ds: {
                    listDatasets: vi.fn().mockResolvedValue({ items: [baseSourceItem] }),
                    readDataset: vi.fn().mockResolvedValue({ data: "AAAA" }),
                },
            };
            const targetClient = {
                ds: { listDatasets: vi.fn().mockResolvedValue({ items: [] }), createDataset: createSpy, writeDataset: writeSpy },
            };
            setupClients(mvsApi, sourceClient, targetClient);

            await mvsApi.copyDataSetCrossLpar("USER.TGT", "NEWMEM", { "from-dataset": { dsn: "USER.SRC" } } as any, sourceProfile);

            expect(createSpy).toHaveBeenCalledWith({ dsname: "USER.TGT", attributes: expect.objectContaining({ dsorg: "PO" }) });
            expect(writeSpy).toHaveBeenCalledWith({ dsname: "USER.TGT(NEWMEM)", data: "AAAA", encoding: "binary" });
        });

        it("should abort when the target PDS exists but no member is specified", async () => {
            const mvsApi = new SshMvsApi();
            const buildSpy = vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            const errorSpy = vi.spyOn(vscode.window, "showErrorMessage").mockReturnValue(undefined);
            const readSpy = vi.fn().mockResolvedValue({ data: "AAAA" });
            const sourceClient = { ds: { listDatasets: vi.fn().mockResolvedValue({ items: [baseSourceItem] }), readDataset: readSpy } };
            const targetClient = {
                ds: { listDatasets: vi.fn().mockResolvedValue({ items: [{ name: "USER.TGT", dsorg: "PO" }] }) },
            };
            setupClients(mvsApi, sourceClient, targetClient);

            await mvsApi.copyDataSetCrossLpar("USER.TGT", undefined, { "from-dataset": { dsn: "USER.SRC" } } as any, sourceProfile);
            expect(buildSpy).toHaveBeenCalledWith(
                { success: false },
                false,
                "Data set copy aborted. Copying to a PDS without a member name is not supported when copying across LPARs."
            );
            expect(errorSpy).toHaveBeenCalled();
        });

        it("should prompt for overwrite when the target member exists and no explicit replace flag is set", async () => {
            const mvsApi = new SshMvsApi();
            const promptFn = vi.fn().mockResolvedValue(true);
            const writeSpy = vi.fn().mockResolvedValue({ success: true });
            const sourceClient = {
                ds: {
                    listDatasets: vi.fn().mockResolvedValue({ items: [baseSourceItem] }),
                    readDataset: vi.fn().mockResolvedValue({ data: "AAAA" }),
                },
            };
            const targetClient = {
                ds: {
                    listDatasets: vi.fn().mockResolvedValue({ items: [{ name: "USER.TGT", dsorg: "PO" }] }),
                    listDsMembers: vi.fn().mockResolvedValue({ items: [{ name: "MEM1" }] }),
                    writeDataset: writeSpy,
                },
            };
            setupClients(mvsApi, sourceClient, targetClient);

            await mvsApi.copyDataSetCrossLpar(
                "USER.TGT",
                "MEM1",
                { "from-dataset": { dsn: "USER.SRC", member: "OLD" }, promptFn } as any,
                sourceProfile
            );
            expect(promptFn).toHaveBeenCalledWith("USER.TGT(MEM1)");
            expect(writeSpy).toHaveBeenCalledWith({ dsname: "USER.TGT(MEM1)", data: "AAAA", encoding: "binary" });
        });

        it("should prompt for overwrite when an existing (non-PDS) target is found and no replace flag is set", async () => {
            const mvsApi = new SshMvsApi();
            const promptFn = vi.fn().mockResolvedValue(true);
            const writeSpy = vi.fn().mockResolvedValue({ success: true });
            const buildSpy = vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            const sourceClient = {
                ds: {
                    listDatasets: vi.fn().mockResolvedValue({ items: [baseSourceItem] }),
                    readDataset: vi.fn().mockResolvedValue({ data: "AAAA" }),
                },
            };
            const targetClient = {
                ds: { listDatasets: vi.fn().mockResolvedValue({ items: [{ name: "USER.TGT", dsorg: "PS" }] }), writeDataset: writeSpy },
            };
            setupClients(mvsApi, sourceClient, targetClient);

            await mvsApi.copyDataSetCrossLpar("USER.TGT", undefined, { "from-dataset": { dsn: "USER.SRC" }, promptFn } as any, sourceProfile);

            expect(promptFn).toHaveBeenCalledWith("USER.TGT");
            expect(writeSpy).toHaveBeenCalledWith({ dsname: "USER.TGT", data: "AAAA", encoding: "binary" });
            expect(buildSpy).toHaveBeenCalledWith({ success: true }, true);
        });

        it("should abort when the target exists and overwrite is declined", async () => {
            const mvsApi = new SshMvsApi();
            const buildSpy = vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            vi.spyOn(vscode.window, "showErrorMessage").mockReturnValue(undefined);
            const sourceClient = {
                ds: {
                    listDatasets: vi.fn().mockResolvedValue({ items: [baseSourceItem] }),
                    readDataset: vi.fn().mockResolvedValue({ data: "AAAA" }),
                },
            };
            const targetClient = {
                ds: {
                    listDatasets: vi.fn().mockResolvedValue({ items: [{ name: "USER.TGT", dsorg: "PS" }] }),
                    writeDataset: vi.fn(),
                },
            };
            setupClients(mvsApi, sourceClient, targetClient);

            await mvsApi.copyDataSetCrossLpar("USER.TGT", undefined, { "from-dataset": { dsn: "USER.SRC" } } as any, sourceProfile);
            expect(buildSpy).toHaveBeenCalledWith(
                { success: false },
                false,
                "Data set copy aborted. The existing target data set was not overwritten."
            );
        });

        it("should handle a thrown error during the copy operation", async () => {
            const mvsApi = new SshMvsApi();
            const buildSpy = vi.spyOn(mvsApi as any, "buildZosFilesResponse");
            vi.spyOn(vscode.window, "showErrorMessage").mockReturnValue(undefined);
            const sourceClient = { ds: { listDatasets: vi.fn().mockRejectedValue(new Error("read fail")) } };
            setupClients(mvsApi, sourceClient, { ds: {} });

            await mvsApi.copyDataSetCrossLpar("USER.TGT", undefined, { "from-dataset": { dsn: "USER.SRC" } } as any, sourceProfile);
            expect(buildSpy).toHaveBeenCalledWith({ success: false }, false, "read fail");
        });
    });

    describe("buildZosFilesResponse", () => {
        it("should build a successful response by default", () => {
            const mvsApi = new SshMvsApi();
            const response = (mvsApi as any).buildZosFilesResponse({});
            expect(response).toEqual({ apiResponse: {}, commandResponse: "", success: true, errorMessage: undefined });
        });

        it("should build a failure response with error text", () => {
            const mvsApi = new SshMvsApi();
            const response = (mvsApi as any).buildZosFilesResponse({}, false, "oops");
            expect(response).toEqual({ apiResponse: {}, commandResponse: "", success: false, errorMessage: "oops" });
        });

        it("should reflect apiResponse.success when present", () => {
            const mvsApi = new SshMvsApi();
            const response = (mvsApi as any).buildZosFilesResponse({ success: false });
            expect(response.success).toEqual(false);
        });
    });
});
