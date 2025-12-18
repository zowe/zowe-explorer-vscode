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
import { FeatureFlags } from "../../../src";

const FLAGS_FILE = "feature-flags.json";
jest.mock("fs");
describe("FeatureFlags", () => {
    let readFileSpy: jest.SpyInstance;
    let writeFileSpy: jest.SpyInstance;

    beforeEach(() => {
        const currentFlags = (FeatureFlags as any).flags;
        for (const key in currentFlags) delete currentFlags[key];

        if (typeof (FeatureFlags as any).initialized !== "undefined") {
            (FeatureFlags as any).initialized = false;
        }

        readFileSpy = jest.spyOn(fsPromises, "readFile").mockResolvedValue("{}");
        writeFileSpy = jest.spyOn(fsPromises, "writeFile").mockResolvedValue(undefined);
        jest.spyOn(fs, "existsSync").mockReturnValue(true);
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

    it("should remove a flag from memory", async () => {
        await FeatureFlags.set("tempFeature", true);
        expect(FeatureFlags.get("tempFeature")).toBe(true);

        FeatureFlags.remove("tempFeature");

        expect(FeatureFlags.get("tempFeature")).toBeUndefined();
    });
});
