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

import { vi } from "vitest";
import { ConfigChangeHandlers, type ChangeEntry } from "../../../../src/utils/ConfigChangeHandlers";
import { ConfigUtils } from "../../../../src/utils/ConfigUtils";
import { ConfigSchemaHelpers } from "../../../../src/utils/ConfigSchemaHelpers";
import { createEditorConfig, createEditorChange, createEditorLayer } from "../../../__mocks__/mockCreators/configEditor";

vi.mock("../../../../src/configuration/Profiles", () => ({ Profiles: { getInstance: () => ({ overrideWithEnv: false }) } }));

const teamPath = "/mock/team.json";
const userPath = "/mock/user.json";
const hostKey = "profiles.test.properties.host";

describe("ConfigChangeHandlers", () => {
    afterEach(() => vi.restoreAllMocks());

    describe.each([
        { mode: "preview", persist: false },
        { mode: "persisted", persist: true },
    ])("$mode changes", ({ persist }) => {
        let memory: ReturnType<typeof createEditorConfig>;
        let allowed: ReturnType<typeof vi.fn<() => Promise<boolean>>>;
        const defaults = (changes: ChangeEntry[], deletions: ChangeEntry[] = [], configPath = teamPath) =>
            ConfigChangeHandlers.handleDefaultChanges(changes, deletions, configPath, persist ? undefined : memory.config);
        const profiles = (changes: ChangeEntry[], deletions: ChangeEntry[] = [], configPath = teamPath) =>
            ConfigChangeHandlers.handleProfileChanges(changes, deletions, configPath, allowed, persist ? undefined : memory.config);
        const autostore = (configPath = teamPath) =>
            ConfigChangeHandlers.handleAutostoreToggle([{ type: "autostore", value: true, configPath }], persist ? undefined : memory.config);

        beforeEach(() => {
            vi.restoreAllMocks();
            memory = createEditorConfig([
                createEditorLayer({
                    path: teamPath,
                    properties: {
                        $schema: "schema.json",
                        profiles: { test: { properties: { host: "original", port: 80, password: "stored" }, secure: ["password"] } },
                        defaults: { zosmf: "old", ssh: "old", base: "base", tso: "old-tso" },
                    },
                }),
                createEditorLayer({ path: userPath, user: true }),
            ]);
            vi.spyOn(ConfigUtils, "createProfileInfoAndLoad").mockResolvedValue(memory.profileInfo);
            vi.spyOn(ConfigSchemaHelpers, "getProfileProperties").mockReturnValue(new Map());
            vi.spyOn(memory.config, "set");
            vi.spyOn(memory.config, "delete");
            vi.spyOn(memory.config.api.layers, "activate");
            allowed = vi.fn().mockResolvedValue(true);
        });

        it("updates multiple defaults and removes explicitly deleted entries", async () => {
            await defaults(
                [createEditorChange("zosmf", "new", { configPath: teamPath }), createEditorChange("tso", "new-tso", { configPath: teamPath })],
                [createEditorChange("ssh", "", { configPath: teamPath }), createEditorChange("base", "", { configPath: teamPath })]
            );
            expect(memory.config.api.layers.get().properties.defaults).toEqual({ zosmf: "new", tso: "new-tso" });
            expect(memory.save).toHaveBeenCalledTimes(persist ? 1 : 0);
            expect(ConfigUtils.createProfileInfoAndLoad).toHaveBeenCalledTimes(persist ? 1 : 0);
        });

        it.each(["", null, undefined])("clears a default whose value is %s", async (value) => {
            await defaults([createEditorChange("zosmf", "", { configPath: teamPath, value })]);
            expect(memory.config.api.layers.get().properties.defaults).not.toHaveProperty("zosmf");
            expect(memory.save).toHaveBeenCalledTimes(persist ? 1 : 0);
        });

        it("applies multiple property edits and deletions without requesting secure storage", async () => {
            await profiles(
                [
                    createEditorChange(hostKey, "changed", { configPath: teamPath }),
                    createEditorChange("profiles.other.properties.host", "other", { configPath: teamPath }),
                ],
                [createEditorChange("profiles.test.properties.port", "", { configPath: teamPath })]
            );
            expect(memory.config.api.layers.get().properties.profiles).toMatchObject({
                test: { properties: { host: "changed", password: "stored" } },
                other: { properties: { host: "other" } },
            });
            expect(memory.config.api.layers.get().properties.profiles.test.properties).not.toHaveProperty("port");
            expect(allowed).not.toHaveBeenCalled();
            expect(memory.save).toHaveBeenCalledTimes(persist ? 1 : 0);
        });

        it("rejects the whole batch before edits or deletions when secure storage is unavailable", async () => {
            allowed.mockResolvedValue(false);
            await expect(
                profiles(
                    [
                        createEditorChange(hostKey, "changed", { configPath: teamPath }),
                        createEditorChange("profiles.test.secure.password", "synthetic", { configPath: teamPath, secure: true }),
                    ],
                    [createEditorChange("profiles.test.properties.port", "", { configPath: teamPath })]
                )
            ).rejects.toThrow("Secure storage is unavailable");
            expect(memory.config.set).not.toHaveBeenCalled();
            expect(memory.config.delete).not.toHaveBeenCalled();
            expect(memory.save).not.toHaveBeenCalled();
        });

        it("translates secure edit and deletion paths into properties", async () => {
            await profiles([createEditorChange("profiles.test.secure.password", "synthetic", { configPath: teamPath, secure: true })]);
            expect(memory.config.set).toHaveBeenCalledWith("profiles.test.properties.password", "synthetic", { parseString: false, secure: true });
            expect(memory.config.api.layers.get().properties.profiles.test).toMatchObject({
                properties: { password: "synthetic" },
                secure: ["password"],
            });
            expect(allowed).toHaveBeenCalledOnce();
            expect(memory.save).toHaveBeenCalledTimes(persist ? 1 : 0);
            await profiles([], [createEditorChange("profiles.test.secure.password", "", { configPath: teamPath })]);
            expect(memory.config.delete).toHaveBeenCalledWith("profiles.test.properties.password");
            expect(memory.config.api.layers.get().properties.profiles.test.properties).not.toHaveProperty("password");
        });

        it("does not rewrite the input profile field", async () => {
            const change = createEditorChange(hostKey, "changed", { configPath: teamPath, profile: "profiles.test.secure.password" });
            const original = structuredClone(change);
            await profiles([change]);
            expect(change).toEqual(original);
            expect(memory.config.set).toHaveBeenCalledWith(hostKey, "changed", { parseString: false, secure: false });
        });

        it("uses the active schema for typed property conversion", async () => {
            vi.mocked(ConfigSchemaHelpers.getProfileProperties).mockReturnValue(new Map([["port", { type: "number", path: "port" }]]));
            await profiles([createEditorChange("profiles.test.properties.port", "443", { configPath: teamPath })]);
            expect(ConfigSchemaHelpers.getProfileProperties).toHaveBeenCalledWith("/mock/schema.json");
            expect(memory.config.set).toHaveBeenCalledWith("profiles.test.properties.port", "443", { parseString: true, secure: false });
            expect(memory.config.api.layers.get().properties.profiles.test.properties.port).toBe(443);
        });

        it("applies properties without a schema", async () => {
            await profiles([createEditorChange(hostKey, "changed", { configPath: userPath })], [], userPath);
            expect(ConfigSchemaHelpers.getProfileProperties).not.toHaveBeenCalled();
            expect(memory.config.set).toHaveBeenCalledWith(hostKey, "changed", { parseString: false, secure: false });
        });

        it.each(["set", "delete"] as const)("propagates a %s failure without saving", async (operation) => {
            vi.spyOn(memory.config, operation).mockImplementationOnce(() => {
                throw new Error(`${operation} failed`);
            });
            const changes = [createEditorChange(hostKey, "changed", { configPath: teamPath })];
            await expect(profiles(operation === "set" ? changes : [], operation === "delete" ? changes : [])).rejects.toThrow(`${operation} failed`);
            expect(memory.save).not.toHaveBeenCalled();
        });

        it.each(["defaults", "profiles"])("handles an empty %s batch", async (kind) => {
            await (kind === "defaults" ? defaults : profiles)([]);
            expect(memory.config.set).not.toHaveBeenCalled();
            expect(memory.config.delete).not.toHaveBeenCalled();
            expect(allowed).not.toHaveBeenCalled();
            expect(memory.save).toHaveBeenCalledTimes(persist ? 1 : 0);
        });

        it.each(["defaults", "profiles", "autostore"])("activates the requested layer for %s", async (kind) => {
            if (kind === "autostore") await autostore(userPath);
            else await (kind === "defaults" ? defaults : profiles)([], [], userPath);
            expect(memory.config.api.layers.activate).toHaveBeenCalledExactlyOnceWith(true, false);
            expect(memory.config.api.layers.get().path).toBe(userPath);
            expect(memory.save).toHaveBeenCalledTimes(persist ? 1 : 0);
        });

        it.each(["defaults", "profiles", "autostore"])("rejects a missing layer before %s writes", async (kind) => {
            const result = kind === "autostore" ? autostore("/missing.json") : (kind === "defaults" ? defaults : profiles)([], [], "/missing.json");
            await expect(result).rejects.toThrow("no longer exists");
            expect(memory.config.api.layers.activate).not.toHaveBeenCalled();
            expect(memory.config.set).not.toHaveBeenCalled();
            expect(memory.config.delete).not.toHaveBeenCalled();
            expect(memory.save).not.toHaveBeenCalled();
        });

        it("does not reactivate the current layer", async () => {
            await defaults([]);
            expect(memory.config.api.layers.activate).not.toHaveBeenCalled();
        });

        it("toggles autostore across layers", async () => {
            await ConfigChangeHandlers.handleAutostoreToggle(
                [
                    { type: "autostore", value: true, configPath: teamPath },
                    { type: "autostore", value: false, configPath: userPath },
                ],
                persist ? undefined : memory.config
            );
            expect(memory.config.layers.map((layer) => layer.properties.autoStore)).toEqual([true, false]);
            expect(memory.save).toHaveBeenCalledTimes(persist ? 2 : 0);
        });
    });

    it("stages a mixed batch across layers without loading or saving", async () => {
        const memory = createEditorConfig([createEditorLayer({ path: teamPath }), createEditorLayer({ path: userPath, user: true })]);
        const load = vi.spyOn(ConfigUtils, "createProfileInfoAndLoad");
        await ConfigChangeHandlers.stageChanges(
            {
                defaultsChanges: [createEditorChange("zosmf", "test", { configPath: teamPath })],
                changes: [createEditorChange(hostKey, "changed", { configPath: userPath })],
            },
            memory.config
        );
        expect(memory.config.layers[0].properties.defaults).toEqual({ zosmf: "test" });
        expect(memory.config.layers[1].properties.profiles.test.properties.host).toBe("changed");
        expect(load).not.toHaveBeenCalled();
        expect(memory.save).not.toHaveBeenCalled();
    });

    it("skips changes that are not autostore toggles", async () => {
        const memory = createEditorConfig([createEditorLayer()]);
        await ConfigChangeHandlers.handleAutostoreToggle(
            [
                { type: "other", value: true, configPath: teamPath } as unknown as Parameters<
                    typeof ConfigChangeHandlers.handleAutostoreToggle
                >[0][number],
            ],
            memory.config
        );
        expect(memory.save).not.toHaveBeenCalled();
        expect(memory.config.api.layers.get().properties).not.toHaveProperty("autoStore");
    });

    it("propagates a configuration-load failure", async () => {
        vi.spyOn(ConfigUtils, "createProfileInfoAndLoad").mockRejectedValue(new Error("load failed"));
        await expect(ConfigChangeHandlers.handleAutostoreToggle([{ type: "autostore", value: true, configPath: teamPath }])).rejects.toThrow(
            "load failed"
        );
    });
});
