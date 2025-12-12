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

import * as fsPromises from "fs/promises";
import { existsSync } from "fs";
import { FeatureFlags } from "../../../src";

jest.mock("fs/promises");

jest.mock("fs", () => {
    const originalFs = jest.requireActual("fs");
    return {
        ...originalFs,
        existsSync: jest.fn(),
    };
});

describe("FeatureFlags", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        const currentFlags = (FeatureFlags as any).flags;
        for (const key in currentFlags) delete currentFlags[key];
    });

    it("should initialize and load flags from disk", async () => {
        const mockFlags = { featureA: true, limit: 10 };
        (existsSync as jest.Mock).mockReturnValue(true);
        (fsPromises.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockFlags));

        await FeatureFlags.init();

        expect(fsPromises.readFile).toHaveBeenCalled();
        expect(FeatureFlags.get("featureA")).toBe(true);
        expect(FeatureFlags.get("limit")).toBe(10);
    });

    it("should set and get values in memory without writing to disk by default", async () => {
        await FeatureFlags.set("newFeature", "active");

        expect(FeatureFlags.get("newFeature")).toBe("active");

        expect(fsPromises.writeFile).not.toHaveBeenCalled();
    });

    it("should persist flags to disk when save is set to true", async () => {
        (existsSync as jest.Mock).mockReturnValue(true);

        await FeatureFlags.set("persistedFeature", 123, true);

        expect(FeatureFlags.get("persistedFeature")).toBe(123);
        expect(fsPromises.writeFile).toHaveBeenCalledWith(
            expect.stringContaining("feature-flags.json"),
            expect.stringContaining('"persistedFeature": 123'),
            "utf-8"
        );
    });

    it("should remove a flag from memory", async () => {
        await FeatureFlags.set("tempFeature", true);
        expect(FeatureFlags.get("tempFeature")).toBe(true);

        await FeatureFlags.remove("tempFeature");

        expect(FeatureFlags.get("tempFeature")).toBeUndefined();
    });
});
