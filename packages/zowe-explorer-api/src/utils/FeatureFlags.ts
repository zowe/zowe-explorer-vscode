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

import * as fs from "fs/promises";
import * as path from "path";
import { existsSync } from "fs";
import * as vscode from "vscode";

export interface FlagSchema {
    [key: string]: boolean | string | number | any;
}

export enum FlagAccessLevel {
    None = 0,
    Read = 1 << 0,
    Write = 1 << 1,
}

export type FeatureFlagKey = string;

type FlagACL = {
    [key: FeatureFlagKey]: FlagAccessLevel;
};

export class FeatureFlags {
    private static filePath: string = path.join(__dirname, "../../feature-flags.json");
    private static flags: FlagSchema = {};
    private static isInitialized: boolean = false;

    protected constructor() {}

    /**
     * Initializes the manager by loading existing flags from disk.
     * Must be called before using get/set if persistence is required immediately.
     */
    public static async init(): Promise<void> {
        await this.loadFromDisk();
        this.isInitialized = true;
    }

    /**
     * Reloads the flags from the JSON file into memory.
     * Useful if the file is modified by an external process.
     */
    public static async reload(): Promise<void> {
        await this.loadFromDisk();
    }

    /**
     * Gets the value of a specific feature flag.
     * Returns from in-memory cache
     */
    public static get(key: string): any {
        return this.flags[key];
    }

    /**
     * Sets a flag value and persists it to the JSON file.
     * Updates in-memory cache immediately.
     */
    public static async set(key: string, value: any, save: boolean = false): Promise<void> {
        this.flags[key] = value;
        if (save) {
            await this.saveToDisk();
        }
    }

    /**
     * Deletes a flag and persists the change.
     */
    public static remove(key: string): void {
        if (key in this.flags) {
            delete this.flags[key];
        }
    }

    private static async loadFromDisk(): Promise<void> {
        try {
            if (!existsSync(this.filePath)) {
                return;
            }

            const data = await fs.readFile(this.filePath, "utf-8");
            if (!data.trim()) {
                this.flags = {};
                return;
            }

            this.flags = JSON.parse(data);
        } catch {
            this.flags = {};
        }
    }

    private static async saveToDisk(): Promise<void> {
        const dir = path.dirname(this.filePath);
        if (!existsSync(dir)) {
            await fs.mkdir(dir, { recursive: true });
        }

        await fs.writeFile(this.filePath, JSON.stringify(this.flags, null, 2), "utf-8");
    }
}

export class FeatureFlagsAccess extends FeatureFlags {
    private static accessControl: FlagACL = {
        fetchByDefault: FlagAccessLevel.Read | FlagAccessLevel.Write,
    };

    /**
     * Asserts that the given key is readable.
     * @param key The feature flag key to read
     * @throws If the key is not readable from the access facility
     */
    private static expectReadable(key: FeatureFlagKey): void {
        if ((FeatureFlagsAccess.accessControl[key] & FlagAccessLevel.Read) > 0) {
            return;
        }

        throw new Error(
            vscode.l10n.t({
                message: "Insufficient read permissions for {0} in feature flags.",
                args: [key],
                comment: "Feature flag key",
            })
        );
    }

    /**
     * Asserts that the given key is writable.
     * @param key The feature flag key to write
     * @throws If the key is not writable from the access facility
     */
    private static expectWritable(key: FeatureFlagKey): void {
        if ((FeatureFlagsAccess.accessControl[key] & FlagAccessLevel.Write) > 0) {
            return;
        }

        throw new Error(
            vscode.l10n.t({
                message: "Insufficient write permissions for {0} in feature flags.",
                args: [key],
                comment: "Feature flag key",
            })
        );
    }

    /**
     * @returns The list of readable keys from the access facility
     */
    public static getReadableKeys(): FeatureFlagKey[] {
        return Object.keys(FeatureFlagsAccess.accessControl).filter((k) => FeatureFlagsAccess.accessControl[k] & FlagAccessLevel.Read);
    }

    /**
     * @returns The list of writable keys from the access facility
     */
    public static getWritableKeys(): FeatureFlagKey[] {
        return Object.keys(FeatureFlagsAccess.accessControl).filter((k) => FeatureFlagsAccess.accessControl[k] & FlagAccessLevel.Write);
    }

    /**
     * Gets the value of a specific feature flag with ACL check.
     * @param key The feature flag key
     * @returns The value of the flag
     * @throws If the extender does not have appropriate read permissions
     */
    public static get(key: FeatureFlagKey): any {
        FeatureFlagsAccess.expectReadable(key);
        return FeatureFlags.get(key);
    }

    /**
     * Sets a flag value with ACL check and persists it to the JSON file.
     * @param key The feature flag key
     * @param value The value to set
     * @param save Whether to persist to disk immediately
     * @throws If the extender does not have appropriate write permissions
     */
    public static async set(key: FeatureFlagKey, value: any, save: boolean = false): Promise<void> {
        FeatureFlagsAccess.expectWritable(key);
        return FeatureFlags.set(key, value, save);
    }
}
