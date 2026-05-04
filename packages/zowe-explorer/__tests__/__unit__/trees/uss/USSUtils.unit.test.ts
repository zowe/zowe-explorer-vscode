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
import { MockInstance } from "vitest";

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { imperative, IZoweUSSTreeNode } from "@zowe/zowe-explorer-api";
import { USSUtils } from "../../../../src/trees/uss/USSUtils";
import { ZoweExplorerApiRegister } from "../../../../src/extending/ZoweExplorerApiRegister";
import { ZoweLogger } from "../../../../src/tools/ZoweLogger";
import { SharedContext } from "../../../../src/trees/shared/SharedContext";
import { MockedProperty } from "../../../__mocks__/mockUtils";

vi.mock("../../../../src/tools/ZoweLogger");
vi.mock("fs");

function createGlobalMocks() {
    const globalMocks = {
        writeText: vi.fn(),
        l10nT: vi.fn(),
        readdirSync: vi.fn(),
        dirname: vi.fn(),
        basename: vi.fn(),
        getTag: vi.fn(),
        isFileTagBinOrAscii: vi.fn(),
        getUssApi: vi.fn(),
        isUssDirectory: vi.fn(),
        getChildren: vi.fn(),
        getEncoding: vi.fn(),
        setEncoding: vi.fn(),
        getProfile: vi.fn(),
        spies: {
            writeText: null as MockInstance | null,
            l10nT: null as MockInstance | null,
            readdirSync: null as MockInstance | null,
            dirname: null as MockInstance | null,
            basename: null as MockInstance | null,
            getUssApi: null as MockInstance | null,
            isUssDirectory: null as MockInstance | null,
        },
        vscodeMocks: [] as MockedProperty[],
    };

    return globalMocks;
}

function setupSpies(globalMocks: any) {
    globalMocks.spies.readdirSync = vi.spyOn(fs, "readdirSync").mockImplementation(globalMocks.readdirSync);
    globalMocks.spies.getUssApi = vi.spyOn(ZoweExplorerApiRegister, "getUssApi").mockImplementation(globalMocks.getUssApi);
    globalMocks.spies.isUssDirectory = vi.spyOn(SharedContext, "isUssDirectory").mockImplementation(globalMocks.isUssDirectory);
    globalMocks.vscodeMocks.push(new MockedProperty(vscode.env.clipboard, "writeText", undefined, globalMocks.writeText));
    globalMocks.vscodeMocks.push(new MockedProperty(vscode.l10n, "t", undefined, globalMocks.l10nT));
}

function cleanupSpies(globalMocks: any) {
    Object.values(globalMocks.spies).forEach((spy: any) => {
        if (spy) {
            spy.mockRestore();
        }
    });

    globalMocks.vscodeMocks.forEach((mock: MockedProperty) => mock[Symbol.dispose]());
    globalMocks.vscodeMocks = [];
}

describe("USSUtils Unit Tests - fileExistsCaseSensitiveSync", () => {
    let globalMocks: any;

    beforeEach(() => {
        globalMocks = createGlobalMocks();
        setupSpies(globalMocks);
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanupSpies(globalMocks);
    });

    it("should return true when at root directory", () => {
        const result = USSUtils.fileExistsCaseSensitiveSync("/");

        expect(result).toBe(true);
        expect(ZoweLogger.trace).toHaveBeenCalledWith("uss.utils.fileExistsCaseSensitveSync called.");
    });

    it("should return true when file exists with correct case", () => {
        globalMocks.readdirSync.mockReturnValue(["testFile.txt", "otherFile.txt"]);

        const result = USSUtils.fileExistsCaseSensitiveSync("/parent/testFile.txt");

        expect(result).toBe(true);
        expect(globalMocks.readdirSync).toHaveBeenCalledWith(path.dirname("/parent/testFile.txt"));
    });

    it("should return false when file does not exist", () => {
        globalMocks.readdirSync.mockReturnValue(["testFile.txt", "otherFile.txt"]);

        const result = USSUtils.fileExistsCaseSensitiveSync("/parent/missingFile.txt");

        expect(result).toBe(false);
        expect(globalMocks.readdirSync).toHaveBeenCalledWith(path.dirname("/parent/missingFile.txt"));
    });

    it("should return false when file exists with different case", () => {
        globalMocks.readdirSync.mockReturnValue(["testFile.txt", "otherFile.txt"]);

        const result = USSUtils.fileExistsCaseSensitiveSync("/parent/TestFile.txt");

        expect(result).toBe(false);
        expect(globalMocks.readdirSync).toHaveBeenCalledWith(path.dirname("/parent/TestFile.txt"));
    });

    it("should recursively check parent directories", () => {
        globalMocks.readdirSync.mockImplementation((dir: string) => {
            if (dir === path.dirname("/parent/subdir/testFile.txt")) return ["testFile.txt"];
            if (dir === path.dirname("/parent/subdir")) return ["subdir"];
            return [];
        });

        const result = USSUtils.fileExistsCaseSensitiveSync("/parent/subdir/testFile.txt");

        expect(result).toBe(true);
        expect(globalMocks.readdirSync).toHaveBeenCalledTimes(2);
    });
});

describe("USSUtils Unit Tests - autoDetectEncoding", () => {
    let globalMocks: any;

    beforeEach(() => {
        globalMocks = createGlobalMocks();
        setupSpies(globalMocks);
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanupSpies(globalMocks);
    });

    it("should return early when node already has binary encoding", async () => {
        const mockNode = {
            getEncoding: vi.fn().mockResolvedValue({ kind: "binary" }),
            setEncoding: vi.fn(),
            fullPath: "/test/file.txt",
            getProfile: vi.fn(),
        } as unknown as IZoweUSSTreeNode;

        await USSUtils.autoDetectEncoding(mockNode);

        expect(mockNode.setEncoding).not.toHaveBeenCalled();
        expect(globalMocks.getUssApi).not.toHaveBeenCalled();
    });

    it("should return early when node already has defined encoding", async () => {
        const mockNode = {
            getEncoding: vi.fn().mockResolvedValue({ kind: "other", codepage: "IBM-1047" }),
            setEncoding: vi.fn(),
            fullPath: "/test/file.txt",
            getProfile: vi.fn(),
        } as unknown as IZoweUSSTreeNode;

        await USSUtils.autoDetectEncoding(mockNode);

        expect(mockNode.setEncoding).not.toHaveBeenCalled();
        expect(globalMocks.getUssApi).not.toHaveBeenCalled();
    });

    it("should use getTag when available and set binary encoding for binary tag", async () => {
        const mockNode = {
            getEncoding: vi.fn().mockResolvedValue(undefined),
            setEncoding: vi.fn(),
            fullPath: "/test/file.txt",
            getProfile: vi.fn().mockReturnValue({ profile: {} }),
        } as unknown as IZoweUSSTreeNode;

        const mockApi = {
            getTag: vi.fn().mockResolvedValue("binary"),
        };

        globalMocks.getUssApi.mockReturnValue(mockApi);

        await USSUtils.autoDetectEncoding(mockNode);

        expect(mockApi.getTag).toHaveBeenCalledWith("/test/file.txt");
        expect(mockNode.setEncoding).toHaveBeenCalledWith({ kind: "binary" });
    });

    it("should use getTag when available and set binary encoding for mixed tag", async () => {
        const mockNode = {
            getEncoding: vi.fn().mockResolvedValue(undefined),
            setEncoding: vi.fn(),
            fullPath: "/test/file.txt",
            getProfile: vi.fn().mockReturnValue({ profile: {} }),
        } as unknown as IZoweUSSTreeNode;

        const mockApi = {
            getTag: vi.fn().mockResolvedValue("mixed"),
        };

        globalMocks.getUssApi.mockReturnValue(mockApi);

        await USSUtils.autoDetectEncoding(mockNode);

        expect(mockApi.getTag).toHaveBeenCalledWith("/test/file.txt");
        expect(mockNode.setEncoding).toHaveBeenCalledWith({ kind: "binary" });
    });

    it("should use getTag when available and set codepage encoding for tagged file", async () => {
        const mockNode = {
            getEncoding: vi.fn().mockResolvedValue(undefined),
            setEncoding: vi.fn(),
            fullPath: "/test/file.txt",
            getProfile: vi.fn().mockReturnValue({ profile: {} }),
        } as unknown as IZoweUSSTreeNode;

        const mockApi = {
            getTag: vi.fn().mockResolvedValue("utf-8"),
        };

        globalMocks.getUssApi.mockReturnValue(mockApi);

        await USSUtils.autoDetectEncoding(mockNode);

        expect(mockApi.getTag).toHaveBeenCalledWith("/test/file.txt");
        expect(mockNode.setEncoding).toHaveBeenCalledWith({ kind: "other", codepage: "utf-8" });
    });

    it("should use getTag when available and set undefined encoding for untagged file", async () => {
        const mockNode = {
            getEncoding: vi.fn().mockResolvedValue(undefined),
            setEncoding: vi.fn(),
            fullPath: "/test/file.txt",
            getProfile: vi.fn().mockReturnValue({ profile: {} }),
        } as unknown as IZoweUSSTreeNode;

        const mockApi = {
            getTag: vi.fn().mockResolvedValue("untagged"),
        };

        globalMocks.getUssApi.mockReturnValue(mockApi);

        await USSUtils.autoDetectEncoding(mockNode);

        expect(mockApi.getTag).toHaveBeenCalledWith("/test/file.txt");
        expect(mockNode.setEncoding).toHaveBeenCalledWith(undefined);
    });

    it("should use isFileTagBinOrAscii when getTag is not available and file is binary", async () => {
        const mockNode = {
            getEncoding: vi.fn().mockResolvedValue(undefined),
            setEncoding: vi.fn(),
            fullPath: "/test/file.txt",
            getProfile: vi.fn().mockReturnValue({ profile: {} }),
        } as unknown as IZoweUSSTreeNode;

        const mockApi = {
            getTag: null,
            isFileTagBinOrAscii: vi.fn().mockResolvedValue(true),
        };

        globalMocks.getUssApi.mockReturnValue(mockApi);

        await USSUtils.autoDetectEncoding(mockNode);

        expect(mockApi.isFileTagBinOrAscii).toHaveBeenCalledWith("/test/file.txt");
        expect(mockNode.setEncoding).toHaveBeenCalledWith({ kind: "binary" });
    });

    it("should use isFileTagBinOrAscii when getTag is not available and file is text", async () => {
        const mockNode = {
            getEncoding: vi.fn().mockResolvedValue(undefined),
            setEncoding: vi.fn(),
            fullPath: "/test/file.txt",
            getProfile: vi.fn().mockReturnValue({ profile: {} }),
        } as unknown as IZoweUSSTreeNode;

        const mockApi = {
            getTag: null,
            isFileTagBinOrAscii: vi.fn().mockResolvedValue(false),
        };

        globalMocks.getUssApi.mockReturnValue(mockApi);

        await USSUtils.autoDetectEncoding(mockNode);

        expect(mockApi.isFileTagBinOrAscii).toHaveBeenCalledWith("/test/file.txt");
        expect(mockNode.setEncoding).toHaveBeenCalledWith(undefined);
    });

    it("should use provided profile instead of node profile", async () => {
        const mockNode = {
            getEncoding: vi.fn().mockResolvedValue(undefined),
            setEncoding: vi.fn(),
            fullPath: "/test/file.txt",
            getProfile: vi.fn().mockReturnValue({ profile: {} }),
        } as unknown as IZoweUSSTreeNode;

        const providedProfile = { profile: { name: "testProfile" } } as unknown as imperative.IProfileLoaded;

        const mockApi = {
            getTag: vi.fn().mockResolvedValue("untagged"),
        };

        globalMocks.getUssApi.mockReturnValue(mockApi);

        await USSUtils.autoDetectEncoding(mockNode, providedProfile);

        expect(globalMocks.getUssApi).toHaveBeenCalledWith(providedProfile);
        expect(mockNode.getProfile).not.toHaveBeenCalled();
    });
});
