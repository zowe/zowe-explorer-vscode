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
import * as path from "path";
import { ProfileCredentials, ProfileInfo } from "@zowe/imperative";
import { FileManagement, ProfilesCache, ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import { Profiles } from "../configuration/Profiles";
import type { ChangeEntry, ConfigParseError, FlattenedProfilesMap, LayerModifications, NestedProfilesMap } from "./ConfigTypes";
import { schemaValidation } from "./ConfigSchemaHelpers";

export type { ChangeEntry, LayerModifications } from "./ConfigTypes";

type ArrayField = "changes" | "deletions" | "defaultsChanges" | "defaultsDeleteKeys";

export class ConfigUtils {
    /**
     * Strips JSONC-style line comments, block comments, and trailing commas from source,
     * respecting quoted string boundaries so that URL-like sequences inside string values
     * are left untouched.
     */
    public static stripJsoncToJson(source: string): string {
        let result = "";
        let i = 0;
        const len = source.length;

        while (i < len) {
            const ch = source[i];

            // Quoted string — copy verbatim, handling escape sequences.
            if (ch === '"') {
                result += ch;
                i++;
                while (i < len) {
                    const sc = source[i];
                    result += sc;
                    i++;
                    if (sc === "\\") {
                        // Copy the escaped character as-is and keep scanning.
                        if (i < len) {
                            result += source[i];
                            i++;
                        }
                    } else if (sc === '"') {
                        break;
                    }
                }
                continue;
            }

            // Possible comment start.
            if (ch === "/" && i + 1 < len) {
                const next = source[i + 1];
                if (next === "/") {
                    // Line comment — skip to end of line.
                    while (i < len && source[i] !== "\n") i++;
                    continue;
                }
                if (next === "*") {
                    // Block comment — skip to closing */.
                    i += 2;
                    while (i + 1 < len && !(source[i] === "*" && source[i + 1] === "/")) i++;
                    i += 2; // consume closing */
                    continue;
                }
            }

            result += ch;
            i++;
        }

        // Remove trailing commas before } or ] (safe to do with regex after comments are gone).
        return result.replace(/,(\s*[}\]])/g, "$1");
    }

    /**
     * Creates a ProfileInfo instance for Zowe and loads profiles from disk.
     * @returns ProfileInfo after readProfilesFromDisk
     */
    public static async createProfileInfoAndLoad(): Promise<ProfileInfo> {
        const profInfo = new ProfileInfo("zowe", {
            overrideWithEnv: (Profiles.getInstance() as InstanceType<typeof Profiles> & { overrideWithEnv?: boolean }).overrideWithEnv,
            credMgrOverride: ProfileCredentials.defaultCredMgrWithKeytar(ProfilesCache.requireKeyring),
        });
        await profInfo.readProfilesFromDisk({ projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath });
        return profInfo;
    }

    /**
     * Parses configuration changes and groups them by config path
     * @param data - The layer modifications data
     * @returns Array of grouped layer modifications
     */
    public static parseConfigChanges(data: LayerModifications): LayerModifications[] {
        const groups: Record<string, LayerModifications> = {};

        const addToGroup = (items: ChangeEntry[], field: ArrayField): void => {
            for (const item of items) {
                const configPath = item.configPath;
                if (!groups[configPath]) {
                    groups[configPath] = {
                        configPath,
                        changes: [],
                        deletions: [],
                        defaultsChanges: [],
                        defaultsDeleteKeys: [],
                    };
                }
                groups[configPath][field].push(item);
            }
        };

        addToGroup(data.changes || [], "changes");
        addToGroup(data.deletions || [], "deletions");
        addToGroup(data.defaultsChanges || [], "defaultsChanges");
        addToGroup(data.defaultsDeleteKeys || [], "defaultsDeleteKeys");

        return Object.values(groups);
    }

    /**
     * Processes profiles recursively to handle nested profiles and secure properties
     * @param profiles - The profiles object to process
     * @param schemaValidation - Optional schema validation to filter out invalid profile types
     */
    public static processProfilesRecursively(profiles: NestedProfilesMap | undefined | null, schemaValidation?: schemaValidation): void {
        if (!profiles || typeof profiles !== "object") {
            return;
        }
        // Process profiles and filter out invalid ones
        const profileNames = Object.keys(profiles);
        for (const profileName of profileNames) {
            const profile = profiles[profileName] as Record<string, unknown>;

            // Handle secure properties for current profile
            if (profile.secure && profile.properties) {
                const secureKeys = profile.secure as string[];
                profile.properties = Object.fromEntries(
                    Object.entries(profile.properties as Record<string, unknown>).filter(([key]) => !secureKeys.includes(key))
                );
            }

            // Recursively process nested profiles
            if (profile.profiles) {
                this.processProfilesRecursively(profile.profiles as NestedProfilesMap, schemaValidation);
            }
        }
    }

    /**
     * Flattens nested profiles into a single-level object with dot-notation keys
     * @param profiles - The profiles object to flatten
     * @param parentKey - The parent key for nested profiles (internal use)
     * @param result - The accumulator object (internal use)
     * @returns Flattened profiles object
     */
    public static flattenProfiles(
        profiles: NestedProfilesMap | undefined | null,
        parentKey = "",
        result: FlattenedProfilesMap = {}
    ): FlattenedProfilesMap {
        if (!profiles || typeof profiles !== "object") return result;

        for (const key of Object.keys(profiles)) {
            const profile = profiles[key] as Record<string, unknown>;
            const qualifiedKey = parentKey ? `${parentKey}.${key}` : key;

            const profileCopy = { ...profile };
            delete profileCopy.profiles;

            result[qualifiedKey] = profileCopy;

            if (profile.profiles) {
                this.flattenProfiles(profile.profiles as NestedProfilesMap, qualifiedKey, result);
            }
        }

        return result;
    }

    /**
     * Extracts a 0-based line/column from imperative parse-error messages (e.g. "...Line 5 Column 10...").
     */
    public static parseLineColumnFromErrorMessage(errorMessage: string): { line?: number; column?: number } {
        const lineMatch = errorMessage.match(/Line (\d+)/);
        const columnMatch = errorMessage.match(/Column (\d+)/);
        const line = lineMatch ? parseInt(lineMatch[1], 10) - 1 : undefined;
        const column = columnMatch ? parseInt(columnMatch[1], 10) - 1 : undefined;
        return { line, column };
    }

    /**
     * Adds (or replaces, by configPath) a parse error entry, extracting line/column from the message.
     */
    public static pushParseError(errors: ConfigParseError[], configPath: string, message: string): void {
        const { line, column } = this.parseLineColumnFromErrorMessage(message);
        const entry: ConfigParseError = { configPath, message, line, column };
        const existing = errors.findIndex((e) => e.configPath === configPath);
        if (existing >= 0) {
            errors[existing] = entry;
        } else {
            errors.push(entry);
        }
    }

    /**
     * Resolves candidate team config file paths (layer paths from the API when possible, plus default global/project filenames).
     */
    public static async getKnownTeamConfigFilePaths(): Promise<string[]> {
        const unique = new Set<string>();
        try {
            const layers = await ZoweVsCodeExtension.getConfigLayers();
            for (const layer of layers) {
                if (layer?.path) {
                    unique.add(path.resolve(layer.path));
                }
            }
        } catch {
            // Config.load can fail when one or more JSON files are invalid; fall back to known locations.
        }
        try {
            const zoweDir = FileManagement.getZoweDir();
            if (zoweDir) {
                for (const name of ["zowe.config.json", "zowe.config.user.json"]) {
                    unique.add(path.resolve(path.join(zoweDir, name)));
                }
            }
        } catch {
            // Imperative may not be initialized (e.g. unit tests).
        }
        const ws = ZoweVsCodeExtension.workspaceRoot?.uri.fsPath;
        if (ws) {
            for (const name of ["zowe.config.json", "zowe.config.user.json"]) {
                unique.add(path.resolve(path.join(ws, name)));
            }
        }
        return [...unique];
    }

    /**
     * When ProfileInfo fails to load, imperative often stops at the first bad file. Parse each known config file
     * independently so all invalid JSON layers appear in one modal.
     */
    public static async appendJsonParseErrorsForKnownConfigFiles(parseErrors: ConfigParseError[]): Promise<void> {
        try {
            const reportedPaths = new Set(parseErrors.map((e) => (e.configPath ? path.resolve(e.configPath) : "")).filter(Boolean));
            const candidates = await this.getKnownTeamConfigFilePaths();
            for (const candidate of candidates) {
                const resolved = path.resolve(candidate);
                if (!fs.existsSync(resolved)) {
                    continue;
                }
                if (reportedPaths.has(resolved)) {
                    continue;
                }
                try {
                    const raw = fs.readFileSync(resolved, { encoding: "utf8" });
                    JSON.parse(this.stripJsoncToJson(raw));
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    this.pushParseError(parseErrors, resolved, `Error reading or parsing file ${resolved}: ${errorMessage}`);
                }
            }
        } catch {
            // Best-effort; primary parse errors are already in parseErrors.
        }
    }
}
