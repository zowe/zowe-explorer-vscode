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

jest.mock("fs");
jest.unmock("@zowe/cli");
jest.unmock("@zowe/imperative");

import { getZoweDir, imperative } from "@zowe/cli";
import { ProfilesCache } from "@zowe/zowe-explorer-api";

describe("ProfilesCache API", () => {
    const zoweDir = getZoweDir();

    beforeAll(() => {
        // Disable loading credential manager in ProfileInfo API
        Object.defineProperty(imperative.ProfileCredentials.prototype, "isSecured", { get: () => false });
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    it("should load profiles from both home directory and current directory", async () => {
        const profilesCache = new ProfilesCache(imperative.Logger.getAppLogger(), __dirname);
        const config = (await profilesCache.getProfileInfo()).getTeamConfig();
        expect(config.layers[0].path).toContain(__dirname);
        expect(config.layers[1].path).toContain(__dirname);
        expect(config.layers[2].path).toContain(zoweDir);
        expect(config.layers[3].path).toContain(zoweDir);
        expect(config.layers.map((layer) => layer.exists)).toEqual([true, true, true, true]);
    });

    it("should not load project profiles from same directory as global profiles", async () => {
        const profilesCache = new ProfilesCache(imperative.Logger.getAppLogger(), zoweDir);
        const config = (await profilesCache.getProfileInfo()).getTeamConfig();
        expect(config.layers[0].path).not.toContain(zoweDir);
        expect(config.layers[1].path).not.toContain(zoweDir);
        expect(config.layers.map((layer) => layer.exists)).toEqual([true, true, true, true]);
    });
});
