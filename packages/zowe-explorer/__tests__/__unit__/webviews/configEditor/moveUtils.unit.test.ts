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

import { updateDefaultsAfterRename } from "../../../../src/webviews/src/config-editor/utils/moveUtils";
import { IConfigLayer } from "../../../../src/webviews/src/config-editor/types";
import { vi, type MockInstance } from "vitest";

describe("MoveUtils", () => {
    let mockLayer: IConfigLayer;
    let warn: MockInstance;
    let mockLayerActive: ReturnType<typeof vi.fn<() => IConfigLayer>>;
    const mockLayerActiveFn = () => mockLayerActive;
    beforeEach(() => {
        vi.restoreAllMocks();
        warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        mockLayer = { properties: { profiles: {}, defaults: { zosmf: "profile1", tso: "profile2" } } };
        mockLayerActive = vi.fn(() => mockLayer);
    });
    afterEach(() => vi.restoreAllMocks());
    describe("updateDefaultsAfterRename", () => {
        it("should update defaults after profile rename", () => {
            const updateTeamConfig = vi.fn();

            updateDefaultsAfterRename(mockLayerActive, "profile1", "renamedProfile1", updateTeamConfig);

            expect(mockLayer.properties.defaults?.zosmf).toBe("renamedProfile1");
            expect(updateTeamConfig).toHaveBeenCalledWith(mockLayer.properties.defaults);
        });

        it("should update child profile defaults", () => {
            mockLayer.properties.defaults = {
                zosmf: "profile1.child",
                tso: "profile2",
            };

            updateDefaultsAfterRename(mockLayerActive, "profile1", "renamedProfile1");

            expect(mockLayer.properties.defaults?.zosmf).toBe("renamedProfile1.child");
            expect(mockLayer.properties.defaults?.tso).toBe("profile2");
        });

        it("should handle missing defaults", () => {
            mockLayer.properties.defaults = undefined;

            expect(() => {
                updateDefaultsAfterRename(mockLayerActive, "profile1", "renamedProfile1");
            }).not.toThrow();
        });

        it("should handle errors gracefully", () => {
            mockLayerActiveFn().mockImplementation(() => {
                throw new Error("Layer error");
            });

            expect(() => {
                updateDefaultsAfterRename(mockLayerActive, "profile1", "renamedProfile1");
            }).not.toThrow();

            expect(warn).toHaveBeenCalledWith("Failed to update defaults after profile rename: Error: Layer error");
        });
    });
});
