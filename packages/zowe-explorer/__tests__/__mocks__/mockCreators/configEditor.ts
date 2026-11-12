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
import type { ChangeEntry } from "../../../src/utils/ConfigTypes";
import type { Config, IConfigLayer, ProfileInfo } from "@zowe/imperative";
import { Config as RealConfig } from "@zowe/imperative/lib/config/src/Config";
import { EventOperator } from "@zowe/imperative/lib/events/src/EventOperator";

/** Installed SDK mutations with isolated, injectable persistence. Never reads a user's files or vault. */
export function createEditorConfig(layers: IConfigLayer[]) {
    let active = layers[0];
    const saved = new Map(layers.map((layer) => [layer.path, structuredClone(layer.properties)]));
    const config = {
        mEnvVarManaged: [],
        layers,
        layerActive: () => active,
        set: RealConfig.prototype.set,
        delete: RealConfig.prototype.delete,
        api: {
            layers: {
                get: () => structuredClone(active),
                activate: (user: boolean, global: boolean) => {
                    active = layers.find((layer) => layer.user === user && layer.global === global)!;
                },
                set: (properties: IConfigLayer["properties"]) => {
                    active.properties = structuredClone(properties);
                },
            },
            profiles: {
                defaultSet: (type: string, name: string) => {
                    active.properties.defaults[type] = name;
                },
            },
            secure: {
                securePropsForLayer: () => null,
                secureFields: () => [],
                get loadFailed() {
                    return false;
                },
                secureInfoForProp: (key: string) =>
                    key.includes(".properties.")
                        ? { path: key.slice(0, key.indexOf(".properties.")) + ".secure", prop: key.split(".").at(-1)! }
                        : null,
            },
        },
        save: vi.fn(async () => {
            saved.set(active.path, structuredClone(active.properties));
        }),
    };
    const profileInfo = { getTeamConfig: () => config, readProfilesFromDisk: vi.fn() } as unknown as ProfileInfo;
    return { config: config as unknown as Config, profileInfo, saved, save: config.save };
}

/** Real SDK save/secure handling with in-memory file and vault boundaries. */
export function createEditorConfigWithVault(layers: IConfigLayer[]) {
    vi.spyOn(EventOperator, "getZoweProcessor").mockReturnValue({
        emitZoweEvent: vi.fn(),
    } as unknown as ReturnType<typeof EventOperator.getZoweProcessor>);
    const vaultSave = vi.fn(async (_account: string, _contents: string) => {});
    const config: Config = Object.assign(Object.create(RealConfig.prototype), {
        mLayers: structuredClone(layers),
        mActive: { user: layers[0].user, global: layers[0].global },
        mEnvVarManaged: [],
        mSecure: {},
        mVault: { save: vaultSave },
    });
    vi.spyOn(config.api.secure, "loadFailed", "get").mockReturnValue(false);
    const saved = new Map(layers.map((layer) => [layer.path, structuredClone(layer.properties)]));
    const write = vi.spyOn(config.api.layers, "write").mockImplementation(() => {
        const layer = config.api.layers.get();
        // Match the SDK file boundary: prune a clone, retaining credentials in memory.
        (config.api.secure as unknown as { cacheAndPrune(layer: IConfigLayer): void }).cacheAndPrune(layer);
        saved.set(layer.path, layer.properties);
    });
    const save = vi.spyOn(config, "save");
    const profileInfo = { getTeamConfig: () => config, readProfilesFromDisk: vi.fn() } as unknown as ProfileInfo;
    return { config, profileInfo, saved, save, write, vaultSave };
}

/** Synthetic schema wrapper; tests supply only the property definitions relevant to their case. */
export function createEditorSchema(properties: Record<string, unknown>, secure: string[] = []) {
    return {
        properties: {
            profiles: {
                patternProperties: {
                    "^\\S*$": {
                        allOf: [
                            {
                                if: { properties: { type: { const: "zosmf" } } },
                                then: { properties: { properties: { properties }, secure: { items: { enum: secure } } } },
                            },
                        ],
                    },
                },
            },
            defaults: { properties: { zosmf: { type: "object" } } },
        },
    };
}

export function createEditorLayer(
    overrides: Partial<Omit<IConfigLayer, "properties">> & { properties?: Partial<IConfigLayer["properties"]> } = {}
): IConfigLayer {
    return {
        path: "/mock/team.json",
        exists: true,
        user: false,
        global: false,
        ...overrides,
        properties: { profiles: {}, defaults: {}, ...overrides.properties },
    };
}

export function createEditorChange(key: string, value = "", overrides: Partial<ChangeEntry> = {}): ChangeEntry {
    return { key, value, path: key.split("."), configPath: "/mock/team.json", secure: false, ...overrides };
}
