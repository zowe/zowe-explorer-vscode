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
import type { Config, IConfigLayer, ProfileInfo } from "@zowe/imperative";
import { Config as RealConfig } from "@zowe/imperative/lib/config/src/Config";

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
