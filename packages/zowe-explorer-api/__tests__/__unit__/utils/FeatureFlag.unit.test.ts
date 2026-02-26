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

import * as fs from "fs";
import * as fsPromises from "fs/promises";
import { FeatureFlags, FeatureFlagsAccess, FlagAccessLevel } from "../../../src";

const FLAGS_FILE = "feature-flags.json";
jest.mock("fs");

describe("FeatureFlags", () => {
    let readFileSpy: jest.SpyInstance;
    let writeFileSpy: jest.SpyInstance;
    let mkdirSpy: jest.SpyInstance;
    let existsSyncSpy: jest.SpyInstance;

    beforeEach(() => {
        const currentFlags = (FeatureFlags as any).flags;
        for (const key in currentFlags) delete currentFlags[key];

        if (typeof (FeatureFlags as any).initialized !== "undefined") {
            (FeatureFlags as any).initialized = false;
        }

        readFileSpy = jest.spyOn(fsPromises, "readFile").mockResolvedValue("{}");
        writeFileSpy = jest.spyOn(fsPromises, "writeFile").mockResolvedValue(undefined);
        mkdirSpy = jest.spyOn(fsPromises, "mkdir").mockResolvedValue(undefined as any);
        existsSyncSpy = jest.spyOn(fs, "existsSync").mockReturnValue(true);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should initialize and load flags from disk", async () => {
        const mockFlags = { featureA: true, limit: 10 };
        readFileSpy.mockResolvedValue(JSON.stringify(mockFlags));

        await FeatureFlags.init();

        expect(readFileSpy).toHaveBeenCalledWith(expect.stringContaining(FLAGS_FILE), expect.anything());
        expect(FeatureFlags.get("featureA")).toBe(true);
        expect(FeatureFlags.get("limit")).toBe(10);
    });

    it("should handle missing file in loadFromDisk (return early)", async () => {
        existsSyncSpy.mockReturnValue(false);

        await FeatureFlags.init();

        expect(readFileSpy).not.toHaveBeenCalled();
        expect(FeatureFlags.get("featureA")).toBeUndefined();
    });

    it("should handle empty file content in loadFromDisk", async () => {
        readFileSpy.mockResolvedValue("   ");

        await FeatureFlags.init();

        expect(readFileSpy).toHaveBeenCalled();
        expect(FeatureFlags.get("anything")).toBeUndefined();
    });

    it("should catch errors during loadFromDisk and reset flags", async () => {
        readFileSpy.mockRejectedValue(new Error("Disk read failure"));

        await FeatureFlags.init();

        expect(FeatureFlags.get("anything")).toBeUndefined();
    });

    it("should set and get values in memory without writing to disk by default", async () => {
        await FeatureFlags.set("newFeature", "active");

        expect(FeatureFlags.get("newFeature")).toBe("active");
        expect(writeFileSpy).not.toHaveBeenCalled();
    });

    it("should persist flags to disk when save is set to true", async () => {
        await FeatureFlags.set("persistedFeature", 123, true);

        expect(FeatureFlags.get("persistedFeature")).toBe(123);

        expect(writeFileSpy).toHaveBeenCalledWith(
            expect.stringContaining(FLAGS_FILE),
            expect.stringContaining('"persistedFeature": 123'),
            expect.anything()
        );
    });

    it("should create directory if it does not exist during saveToDisk", async () => {
        existsSyncSpy.mockReturnValue(false);

        await FeatureFlags.set("persistedFeature", 123, true);

        expect(mkdirSpy).toHaveBeenCalledWith(expect.any(String), { recursive: true });
        expect(writeFileSpy).toHaveBeenCalled();
    });

    it("should remove a flag from memory", async () => {
        await FeatureFlags.set("tempFeature", true);
        expect(FeatureFlags.get("tempFeature")).toBe(true);

        FeatureFlags.remove("tempFeature");

        expect(FeatureFlags.get("tempFeature")).toBeUndefined();
    });
});

describe("FeatureFlagsAccess (ACL)", () => {
    beforeEach(async () => {
        (FeatureFlags as any).flags = {};
        jest.clearAllMocks();
        (FeatureFlagsAccess as any).accessControl = {
            goodTestKey: FlagAccessLevel.Read | FlagAccessLevel.Write,
        };
    });

    it("should allow reading a key with Read permissions", () => {
        const key = "goodTestKey";
        (FeatureFlags as any).flags[key] = true;
        expect(FeatureFlagsAccess.get(key)).toBe(true);
    });

    it("should throw error when reading a key without Read permissions", () => {
        const restrictedKey = "unknownKey";
        expect(() => {
            FeatureFlagsAccess.get(restrictedKey);
        }).toThrow("Insufficient read permissions for unknownKey in feature flags.");
    });

    it("should allow writing a key with Write permissions", async () => {
        const key = "goodTestKey";
        const value = false;
        await FeatureFlagsAccess.set(key, value);
        expect(FeatureFlags.get(key)).toBe(value);
    });

    it("should throw error when writing a key without Write permissions", async () => {
        const restrictedKey = "readOnlyOrNoAccessKey";
        await expect(FeatureFlagsAccess.set(restrictedKey, true)).rejects.toThrow(
            "Insufficient write permissions for readOnlyOrNoAccessKey in feature flags."
        );
    });

    it("should list correct readable keys", () => {
        const readableKeys = FeatureFlagsAccess.getReadableKeys();
        expect(readableKeys).toContain("goodTestKey");
    });

    it("should list correct writable keys", () => {
        const writableKeys = FeatureFlagsAccess.getWritableKeys();
        expect(writableKeys).toContain("goodTestKey");
    });
});
