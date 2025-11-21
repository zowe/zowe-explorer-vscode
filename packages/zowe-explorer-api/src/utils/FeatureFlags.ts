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

export interface FlagSchema {
    [key: string]: boolean | string | number | any;
}

export class FeatureFlags {
    private static filePath: string = path.join(__dirname, "../../../../feature-flags.json");
    private static flags: FlagSchema = {};
    private static isInitialized: boolean = false;

    private constructor() {}

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
        if (save) await this.saveToDisk();
    }

    /**
     * Deletes a flag and persists the change.
     */
    public static async remove(key: string): Promise<void> {
        if (key in this.flags) {
            delete this.flags[key];
        }
    }

    private static async loadFromDisk(): Promise<void> {
        try {
            if (!existsSync(this.filePath)) {
                // this.flags = {};
                // await this.saveToDisk();
                return;
            }

            const data = await fs.readFile(this.filePath, "utf-8");
            if (!data.trim()) {
                this.flags = {};
                return;
            }

            this.flags = JSON.parse(data);
        } catch (error) {
            console.error(`Failed to load feature flags from ${this.filePath}:`, error);
            this.flags = {};
        }
    }

    private static async saveToDisk(): Promise<void> {
        try {
            const dir = path.dirname(this.filePath);
            if (!existsSync(dir)) {
                await fs.mkdir(dir, { recursive: true });
            }

            await fs.writeFile(this.filePath, JSON.stringify(this.flags, null, 2), "utf-8");
        } catch (error) {
            console.error(`Failed to save feature flags to ${this.filePath}:`, error);
            throw error;
        }
    }
}
