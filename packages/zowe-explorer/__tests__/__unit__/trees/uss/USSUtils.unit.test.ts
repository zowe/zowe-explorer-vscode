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

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { imperative, IZoweUSSTreeNode } from "@zowe/zowe-explorer-api";
import { USSUtils } from "../../../../src/trees/uss/USSUtils";
import { ZoweExplorerApiRegister } from "../../../../src/extending/ZoweExplorerApiRegister";
import { ZoweLogger } from "../../../../src/tools/ZoweLogger";
import { SharedContext } from "../../../../src/trees/shared/SharedContext";
import { MockedProperty } from "../../../__mocks__/mockUtils";

jest.mock("../../../../src/tools/ZoweLogger");
jest.mock("fs");

function createGlobalMocks() {
    const globalMocks = {
        writeText: jest.fn(),
        l10nT: jest.fn(),
        readdirSync: jest.fn(),
        dirname: jest.fn(),
        basename: jest.fn(),
        getTag: jest.fn(),
        isFileTagBinOrAscii: jest.fn(),
        getUssApi: jest.fn(),
        isUssDirectory: jest.fn(),
        getChildren: jest.fn(),
        getEncoding: jest.fn(),
        setEncoding: jest.fn(),
        getProfile: jest.fn(),
    };

    new MockedProperty(vscode.env.clipboard, "writeText", undefined, globalMocks.writeText);
    new MockedProperty(vscode.l10n, "t", undefined, globalMocks.l10nT);
    new MockedProperty(fs, "readdirSync", undefined, globalMocks.readdirSync);
    new MockedProperty(path, "dirname", undefined, globalMocks.dirname);
    new MockedProperty(path, "basename", undefined, globalMocks.basename);
    new MockedProperty(ZoweExplorerApiRegister, "getUssApi", undefined, globalMocks.getUssApi);
    new MockedProperty(SharedContext, "isUssDirectory", undefined, globalMocks.isUssDirectory);

    return globalMocks;
}

describe("USSUtils Unit Tests - fileExistsCaseSensitiveSync", () => {
    let globalMocks: any;

    beforeEach(() => {
        globalMocks = createGlobalMocks();
        jest.clearAllMocks();
    });

    it("should return true when at root directory", () => {
        globalMocks.dirname.mockImplementation((filePath: any) => {
            if (filePath === "/") return "/";
            return "/parent";
        });

        const result = USSUtils.fileExistsCaseSensitiveSync("/");

        expect(result).toBe(true);
        expect(ZoweLogger.trace).toHaveBeenCalledWith("uss.utils.fileExistsCaseSensitveSync called.");
    });

    it("should return true when file exists with correct case", () => {
        globalMocks.dirname.mockReturnValueOnce("/parent").mockReturnValueOnce("/");
        globalMocks.basename.mockReturnValue("testFile.txt");
        globalMocks.readdirSync.mockReturnValue(["testFile.txt", "otherFile.txt"]);

        const result = USSUtils.fileExistsCaseSensitiveSync("/parent/testFile.txt");

        expect(result).toBe(true);
        expect(globalMocks.readdirSync).toHaveBeenCalledWith("/parent");
        expect(globalMocks.basename).toHaveBeenCalledWith("/parent/testFile.txt");
    });

    it("should return false when file does not exist", () => {
        globalMocks.dirname.mockReturnValueOnce("/parent").mockReturnValueOnce("/");
        globalMocks.basename.mockReturnValue("missingFile.txt");
        globalMocks.readdirSync.mockReturnValue(["testFile.txt", "otherFile.txt"]);

        const result = USSUtils.fileExistsCaseSensitiveSync("/parent/missingFile.txt");

        expect(result).toBe(false);
        expect(globalMocks.readdirSync).toHaveBeenCalledWith("/parent");
    });

    it("should return false when file exists with different case", () => {
        globalMocks.dirname.mockReturnValueOnce("/parent").mockReturnValueOnce("/");
        globalMocks.basename.mockReturnValue("TestFile.txt");
        globalMocks.readdirSync.mockReturnValue(["testFile.txt", "otherFile.txt"]);

        const result = USSUtils.fileExistsCaseSensitiveSync("/parent/TestFile.txt");

        expect(result).toBe(false);
        expect(globalMocks.readdirSync).toHaveBeenCalledWith("/parent");
    });

    it("should recursively check parent directories", () => {
        globalMocks.dirname.mockReturnValueOnce("/parent/subdir").mockReturnValueOnce("/parent").mockReturnValueOnce("/");
        globalMocks.basename.mockReturnValueOnce("testFile.txt").mockReturnValueOnce("subdir");
        globalMocks.readdirSync.mockReturnValueOnce(["testFile.txt"]).mockReturnValueOnce(["subdir"]);

        const result = USSUtils.fileExistsCaseSensitiveSync("/parent/subdir/testFile.txt");

        expect(result).toBe(true);
        expect(globalMocks.readdirSync).toHaveBeenCalledTimes(2);
    });
});

describe("USSUtils Unit Tests - autoDetectEncoding", () => {
    let globalMocks: any;

    beforeEach(() => {
        globalMocks = createGlobalMocks();
        jest.clearAllMocks();
    });

    it("should return early when node already has binary encoding", async () => {
        const mockNode = {
            getEncoding: jest.fn().mockResolvedValue({ kind: "binary" }),
            setEncoding: jest.fn(),
            fullPath: "/test/file.txt",
            getProfile: jest.fn(),
        } as unknown as IZoweUSSTreeNode;

        await USSUtils.autoDetectEncoding(mockNode);

        expect(mockNode.setEncoding).not.toHaveBeenCalled();
        expect(globalMocks.getUssApi).not.toHaveBeenCalled();
    });

    it("should return early when node already has defined encoding", async () => {
        const mockNode = {
            getEncoding: jest.fn().mockResolvedValue({ kind: "other", codepage: "IBM-1047" }),
            setEncoding: jest.fn(),
            fullPath: "/test/file.txt",
            getProfile: jest.fn(),
        } as unknown as IZoweUSSTreeNode;

        await USSUtils.autoDetectEncoding(mockNode);

        expect(mockNode.setEncoding).not.toHaveBeenCalled();
        expect(globalMocks.getUssApi).not.toHaveBeenCalled();
    });

    it("should use getTag when available and set binary encoding for binary tag", async () => {
        const mockNode = {
            getEncoding: jest.fn().mockResolvedValue(undefined),
            setEncoding: jest.fn(),
            fullPath: "/test/file.txt",
            getProfile: jest.fn().mockReturnValue({ profile: {} }),
        } as unknown as IZoweUSSTreeNode;

        const mockApi = {
            getTag: jest.fn().mockResolvedValue("binary"),
        };

        globalMocks.getUssApi.mockReturnValue(mockApi);

        await USSUtils.autoDetectEncoding(mockNode);

        expect(mockApi.getTag).toHaveBeenCalledWith("/test/file.txt");
        expect(mockNode.setEncoding).toHaveBeenCalledWith({ kind: "binary" });
    });

    it("should use getTag when available and set binary encoding for mixed tag", async () => {
        const mockNode = {
            getEncoding: jest.fn().mockResolvedValue(undefined),
            setEncoding: jest.fn(),
            fullPath: "/test/file.txt",
            getProfile: jest.fn().mockReturnValue({ profile: {} }),
        } as unknown as IZoweUSSTreeNode;

        const mockApi = {
            getTag: jest.fn().mockResolvedValue("mixed"),
        };

        globalMocks.getUssApi.mockReturnValue(mockApi);

        await USSUtils.autoDetectEncoding(mockNode);

        expect(mockApi.getTag).toHaveBeenCalledWith("/test/file.txt");
        expect(mockNode.setEncoding).toHaveBeenCalledWith({ kind: "binary" });
    });

    it("should use getTag when available and set codepage encoding for tagged file", async () => {
        const mockNode = {
            getEncoding: jest.fn().mockResolvedValue(undefined),
            setEncoding: jest.fn(),
            fullPath: "/test/file.txt",
            getProfile: jest.fn().mockReturnValue({ profile: {} }),
        } as unknown as IZoweUSSTreeNode;

        const mockApi = {
            getTag: jest.fn().mockResolvedValue("utf-8"),
        };

        globalMocks.getUssApi.mockReturnValue(mockApi);

        await USSUtils.autoDetectEncoding(mockNode);

        expect(mockApi.getTag).toHaveBeenCalledWith("/test/file.txt");
        expect(mockNode.setEncoding).toHaveBeenCalledWith({ kind: "other", codepage: "utf-8" });
    });

    it("should use getTag when available and set undefined encoding for untagged file", async () => {
        const mockNode = {
            getEncoding: jest.fn().mockResolvedValue(undefined),
            setEncoding: jest.fn(),
            fullPath: "/test/file.txt",
            getProfile: jest.fn().mockReturnValue({ profile: {} }),
        } as unknown as IZoweUSSTreeNode;

        const mockApi = {
            getTag: jest.fn().mockResolvedValue("untagged"),
        };

        globalMocks.getUssApi.mockReturnValue(mockApi);

        await USSUtils.autoDetectEncoding(mockNode);

        expect(mockApi.getTag).toHaveBeenCalledWith("/test/file.txt");
        expect(mockNode.setEncoding).toHaveBeenCalledWith(undefined);
    });

    it("should use isFileTagBinOrAscii when getTag is not available and file is binary", async () => {
        const mockNode = {
            getEncoding: jest.fn().mockResolvedValue(undefined),
            setEncoding: jest.fn(),
            fullPath: "/test/file.txt",
            getProfile: jest.fn().mockReturnValue({ profile: {} }),
        } as unknown as IZoweUSSTreeNode;

        const mockApi = {
            getTag: null,
            isFileTagBinOrAscii: jest.fn().mockResolvedValue(true),
        };

        globalMocks.getUssApi.mockReturnValue(mockApi);

        await USSUtils.autoDetectEncoding(mockNode);

        expect(mockApi.isFileTagBinOrAscii).toHaveBeenCalledWith("/test/file.txt");
        expect(mockNode.setEncoding).toHaveBeenCalledWith({ kind: "binary" });
    });

    it("should use isFileTagBinOrAscii when getTag is not available and file is text", async () => {
        const mockNode = {
            getEncoding: jest.fn().mockResolvedValue(undefined),
            setEncoding: jest.fn(),
            fullPath: "/test/file.txt",
            getProfile: jest.fn().mockReturnValue({ profile: {} }),
        } as unknown as IZoweUSSTreeNode;

        const mockApi = {
            getTag: null,
            isFileTagBinOrAscii: jest.fn().mockResolvedValue(false),
        };

        globalMocks.getUssApi.mockReturnValue(mockApi);

        await USSUtils.autoDetectEncoding(mockNode);

        expect(mockApi.isFileTagBinOrAscii).toHaveBeenCalledWith("/test/file.txt");
        expect(mockNode.setEncoding).toHaveBeenCalledWith(undefined);
    });

    it("should use provided profile instead of node profile", async () => {
        const mockNode = {
            getEncoding: jest.fn().mockResolvedValue(undefined),
            setEncoding: jest.fn(),
            fullPath: "/test/file.txt",
            getProfile: jest.fn().mockReturnValue({ profile: {} }),
        } as unknown as IZoweUSSTreeNode;

        const providedProfile = { profile: { name: "testProfile" } } as unknown as imperative.IProfileLoaded;

        const mockApi = {
            getTag: jest.fn().mockResolvedValue("untagged"),
        };

        globalMocks.getUssApi.mockReturnValue(mockApi);

        await USSUtils.autoDetectEncoding(mockNode, providedProfile);

        expect(globalMocks.getUssApi).toHaveBeenCalledWith(providedProfile);
        expect(mockNode.getProfile).not.toHaveBeenCalled();
    });
});

describe("USSUtils Unit Tests - countAllFilesRecursively", () => {
    let globalMocks: any;

    beforeEach(() => {
        globalMocks = createGlobalMocks();
        jest.clearAllMocks();
    });

    it("should return 0 when node has no children", async () => {
        const mockNode = {
            getChildren: jest.fn().mockResolvedValue([]),
            fullPath: "/test/emptyDir",
        } as unknown as IZoweUSSTreeNode;

        const result = await USSUtils.countAllFilesRecursively(mockNode);

        expect(result).toBe(0);
        expect(ZoweLogger.trace).toHaveBeenCalledWith("uss.actions.countAllFilesRecursively called.");
    });

    it("should return 0 when getChildren returns null", async () => {
        const mockNode = {
            getChildren: jest.fn().mockResolvedValue(null),
            fullPath: "/test/emptyDir",
        } as unknown as IZoweUSSTreeNode;

        const result = await USSUtils.countAllFilesRecursively(mockNode);

        expect(result).toBe(0);
    });

    it("should count files but not directories", async () => {
        const mockFile1 = { fullPath: "/test/file1.txt" } as IZoweUSSTreeNode;
        const mockFile2 = { fullPath: "/test/file2.txt" } as IZoweUSSTreeNode;
        const mockDir = { fullPath: "/test/subdir" } as IZoweUSSTreeNode;

        const mockNode = {
            getChildren: jest.fn().mockResolvedValue([mockFile1, mockDir, mockFile2]),
            fullPath: "/test",
        } as unknown as IZoweUSSTreeNode;

        globalMocks.isUssDirectory.mockImplementation((node: any) => node.fullPath === "/test/subdir");

        const result = await USSUtils.countAllFilesRecursively(mockNode);

        expect(result).toBe(2);
        expect(globalMocks.isUssDirectory).toHaveBeenCalledTimes(3);
    });

    it("should recursively count files in subdirectories", async () => {
        const mockFile1 = { fullPath: "/test/file1.txt" } as IZoweUSSTreeNode;
        const mockSubFile1 = { fullPath: "/test/subdir/subfile1.txt" } as IZoweUSSTreeNode;
        const mockSubFile2 = { fullPath: "/test/subdir/subfile2.txt" } as IZoweUSSTreeNode;

        const mockSubDir = {
            getChildren: jest.fn().mockResolvedValue([mockSubFile1, mockSubFile2]),
            fullPath: "/test/subdir",
        } as unknown as IZoweUSSTreeNode;

        const mockNode = {
            getChildren: jest.fn().mockResolvedValue([mockFile1, mockSubDir]),
            fullPath: "/test",
        } as unknown as IZoweUSSTreeNode;

        globalMocks.isUssDirectory.mockImplementation((node: any) => node.fullPath === "/test/subdir");

        const result = await USSUtils.countAllFilesRecursively(mockNode);

        expect(result).toBe(3);
        expect(mockSubDir.getChildren).toHaveBeenCalled();
    });

    it("should handle deeply nested directory structures", async () => {
        const mockFile1 = { fullPath: "/test/file1.txt" } as IZoweUSSTreeNode;
        const mockDeepFile = { fullPath: "/test/sub1/sub2/deepfile.txt" } as IZoweUSSTreeNode;

        const mockSub2 = {
            getChildren: jest.fn().mockResolvedValue([mockDeepFile]),
            fullPath: "/test/sub1/sub2",
        } as unknown as IZoweUSSTreeNode;

        const mockSub1 = {
            getChildren: jest.fn().mockResolvedValue([mockSub2]),
            fullPath: "/test/sub1",
        } as unknown as IZoweUSSTreeNode;

        const mockNode = {
            getChildren: jest.fn().mockResolvedValue([mockFile1, mockSub1]),
            fullPath: "/test",
        } as unknown as IZoweUSSTreeNode;

        globalMocks.isUssDirectory.mockImplementation((node: any) => node.fullPath === "/test/sub1" || node.fullPath === "/test/sub1/sub2");

        const result = await USSUtils.countAllFilesRecursively(mockNode);

        expect(result).toBe(2);
    });

    it("should return 0 and log warning when getChildren throws error", async () => {
        const mockNode = {
            getChildren: jest.fn().mockRejectedValue(new Error("Access denied")),
            fullPath: "/test/restrictedDir",
        } as unknown as IZoweUSSTreeNode;

        const warnSpy = jest.spyOn(ZoweLogger, "warn");

        const result = await USSUtils.countAllFilesRecursively(mockNode);

        expect(result).toBe(0);
        expect(warnSpy).toHaveBeenCalledWith("Failed to count files in directory /test/restrictedDir: Error: Access denied");
    });

    it("should handle mixed file and directory structure with errors", async () => {
        const mockFile1 = { fullPath: "/test/file1.txt" } as IZoweUSSTreeNode;
        const mockFile2 = { fullPath: "/test/file2.txt" } as IZoweUSSTreeNode;

        const mockErrorDir = {
            getChildren: jest.fn().mockRejectedValue(new Error("Permission denied")),
            fullPath: "/test/errordir",
        } as unknown as IZoweUSSTreeNode;

        const mockValidDir = {
            getChildren: jest.fn().mockResolvedValue([]),
            fullPath: "/test/validdir",
        } as unknown as IZoweUSSTreeNode;

        const mockNode = {
            getChildren: jest.fn().mockResolvedValue([mockFile1, mockErrorDir, mockValidDir, mockFile2]),
            fullPath: "/test",
        } as unknown as IZoweUSSTreeNode;

        globalMocks.isUssDirectory.mockImplementation((node: any) => node.fullPath === "/test/errordir" || node.fullPath === "/test/validdir");

        const result = await USSUtils.countAllFilesRecursively(mockNode);

        expect(result).toBe(2);
        expect(ZoweLogger.warn).toHaveBeenCalled();
    });
});
