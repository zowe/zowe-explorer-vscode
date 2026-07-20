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

import * as path from "path";
import * as globals from "../../../src/globals";
import { ZoweLogger } from "../../../src/utils/LoggerUtils";
import { isValidUssFileTree, UssFileType, UssFileUtils } from "../../../src/uss/FileStructure";

describe("FileStructure unit tests - function isValidUssFileTree", () => {
    it("accepts a minimal valid file node", () => {
        expect(isValidUssFileTree({ ussPath: "/a/b", type: UssFileType.File })).toBe(true);
    });

    it("accepts a valid directory node with optional fields and nested children", () => {
        const node = {
            ussPath: "/a",
            type: UssFileType.Directory,
            baseName: "a",
            sessionName: "sestest",
            binary: false,
            children: [{ ussPath: "/a/b", type: UssFileType.File }],
        };
        expect(isValidUssFileTree(node)).toBe(true);
    });

    it("rejects values that are not objects", () => {
        expect(isValidUssFileTree(null)).toBe(false);
        expect(isValidUssFileTree("not an object")).toBe(false);
        expect(isValidUssFileTree(42)).toBe(false);
    });

    it("rejects a node with a missing or non-string ussPath", () => {
        expect(isValidUssFileTree({ type: UssFileType.File })).toBe(false);
        expect(isValidUssFileTree({ ussPath: 5, type: UssFileType.File })).toBe(false);
    });

    it("rejects a node with an invalid type", () => {
        expect(isValidUssFileTree({ ussPath: "/a", type: 99 })).toBe(false);
        expect(isValidUssFileTree({ ussPath: "/a", type: "File" })).toBe(false);
        expect(isValidUssFileTree({ ussPath: "/a" })).toBe(false);
    });

    it("rejects a node with wrong optional field types", () => {
        expect(isValidUssFileTree({ ussPath: "/a", type: UssFileType.File, baseName: 1 })).toBe(false);
        expect(isValidUssFileTree({ ussPath: "/a", type: UssFileType.File, sessionName: {} })).toBe(false);
        expect(isValidUssFileTree({ ussPath: "/a", type: UssFileType.File, binary: "true" })).toBe(false);
    });

    it("rejects a node whose children are not an array or contain an invalid child", () => {
        expect(isValidUssFileTree({ ussPath: "/a", type: UssFileType.Directory, children: "nope" })).toBe(false);
        expect(
            isValidUssFileTree({
                ussPath: "/a",
                type: UssFileType.Directory,
                children: [{ ussPath: "/a/b", type: 99 }],
            })
        ).toBe(false);
    });
});

describe("FileStructure unit tests - function UssFileUtils.resolveLocalPath", () => {
    let ussDir: string;

    beforeAll(() => {
        jest.spyOn(ZoweLogger, "trace").mockImplementation();
        // Set USS_DIR directly rather than calling defineGlobals(), which reaches into vscode.env/Uri.
        Object.defineProperty(globals, "USS_DIR", { value: path.join("/test/path/temp", "_U_"), configurable: true });
        ussDir = path.resolve(globals.USS_DIR);
    });

    it("recomputes a path under USS_DIR from the profile name and USS path", () => {
        const result = UssFileUtils.resolveLocalPath("sestest", "/u/users/test/file.txt");
        expect(result).toBe(path.resolve(ussDir, "sestest", "u", "users", "test", "file.txt"));
        expect(result.startsWith(ussDir + path.sep)).toBe(true);
    });

    it("ignores leading slashes and '.' segments in the USS path", () => {
        const result = UssFileUtils.resolveLocalPath("sestest", "///u/./users//file");
        expect(result).toBe(path.resolve(ussDir, "sestest", "u", "users", "file"));
    });

    it("throws when the USS path is missing or empty", () => {
        expect(() => UssFileUtils.resolveLocalPath("sestest", "")).toThrow(/missing or invalid USS path/);
        expect(() => UssFileUtils.resolveLocalPath("sestest", undefined as unknown as string)).toThrow(/missing or invalid USS path/);
    });

    it("rejects '..' traversal segments that would escape USS_DIR", () => {
        expect(() => UssFileUtils.resolveLocalPath("sestest", "/../../../../etc/passwd")).toThrow(/missing or invalid USS path/);
        expect(() => UssFileUtils.resolveLocalPath("sestest", "a/../../b")).toThrow(/missing or invalid USS path/);
    });

    it("rejects backslash-separated '..' traversal segments", () => {
        expect(() => UssFileUtils.resolveLocalPath("sestest", "..\\..\\Windows\\System32")).toThrow(/missing or invalid USS path/);
    });

    it("rejects drive-letter / absolute-path roots supplied via the USS path", () => {
        expect(() => UssFileUtils.resolveLocalPath("sestest", "C:/Windows/System32")).toThrow(/missing or invalid USS path/);
        expect(() => UssFileUtils.resolveLocalPath("sestest", "/D:/data")).toThrow(/missing or invalid USS path/);
    });

    it("never lets a hostile profile name escape USS_DIR", () => {
        // Even if a caller passes traversal via the profile name, the containment
        // assertion must reject the resolved path.
        expect(() => UssFileUtils.resolveLocalPath("../../..", "/file")).toThrow(/missing or invalid USS path/);
    });
});
