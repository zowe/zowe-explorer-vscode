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

import * as vscode from "vscode";
import { FsAbstractUtils, Gui, IZoweTreeNode, ZoweScheme } from "@zowe/zowe-explorer-api";
import { SharedContext } from "../trees/shared/SharedContext";
import { Constants } from "../configuration/Constants";
import { SettingsConfig } from "../configuration/SettingsConfig";

interface ReadOnlyRule {
    profile?: string; // Mark whole profile read-only
    pattern?: string; // Data set pattern, prefix with ! to make matching data sets writable
    uss?: string; // USS path glob, prefix with ! to make matching paths writable
}

// Cached rule to avoid having to re-read in the setting for every file opened/tree node created or refreshed
interface CachedReadOnlyRule {
    profile?: string;
    matchesDs?: (dsName: string, member?: string) => boolean;
    dsNegated?: boolean;
    uss?: RegExp;
    ussNegated?: boolean;
}

/**
 * Decides whether a data set, member or USS file should be opened read-only.
 *
 * Whether it is opened in read-only is decided in order by:
 * 1. If there is a readonly=true query parameter on the filesystem URI
 * 2. If a read-only/writable override is on the resource or one of its parents (e.g. a member or its PDS or its profile)
 * 3. The last matching rule in the zowe.readOnly.rules setting, where a rule prefixed with ! makes matches writable again
 */
export class ReadOnlyManagement {
    private static overrides = new Map<string, boolean>(); // pattern, is read-only?
    private static ruleCache: CachedReadOnlyRule[] | undefined;
    private static changeEmitter = new vscode.EventEmitter<void>();
    public static readonly onDidChange = ReadOnlyManagement.changeEmitter.event;

    public static initialize(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration((e) => {
                if (e.affectsConfiguration(Constants.SETTINGS_READ_ONLY_RULES)) {
                    ReadOnlyManagement.ruleCache = undefined;
                    ReadOnlyManagement.notifyChanged();
                }
            })
        );
    }

    public static isSupportedUri(uri: vscode.Uri): boolean {
        return (uri?.scheme as ZoweScheme) === ZoweScheme.DS || (uri?.scheme as ZoweScheme) === ZoweScheme.USS;
    }

    public static isReadOnly(uri: vscode.Uri): boolean {
        if (!ReadOnlyManagement.isSupportedUri(uri)) {
            return false;
        }
        if (FsAbstractUtils.isReadOnlyUri(uri)) {
            return true;
        }

        for (const key of ReadOnlyManagement.getKeyAndParents(uri)) {
            const override = ReadOnlyManagement.overrides.get(key);
            if (override != null) {
                return override;
            }
        }

        return ReadOnlyManagement.matchesRule(uri);
    }

    /**
     * Throws a NoPermissions error if the resource is read-only
     * @param uri The resource being modified
     * @param opts.checkParent Also check the PDS, directory or profile the resource is being added to, for operations that create a new entry
     * such as creating, pasting, uploading or moving into it.
     */
    public static throwIfReadOnly(uri: vscode.Uri, opts?: { checkParent?: boolean }): void {
        if (!ReadOnlyManagement.isSupportedUri(uri)) {
            return;
        }
        // Gives a more specific error for files opened from a readonly=true link
        FsAbstractUtils.throwIfReadOnly(uri);
        const parent = opts?.checkParent ? ReadOnlyManagement.getParentUri(uri) : undefined;
        const readOnlyUri = [parent, uri].find((u) => u != null && ReadOnlyManagement.isReadOnly(u));
        if (readOnlyUri != null) {
            throw vscode.FileSystemError.NoPermissions(
                vscode.l10n.t({
                    message: "{0} is read-only.",
                    args: [ReadOnlyManagement.getDisplayName(readOnlyUri)],
                    comment: ["Data set, member or USS path"],
                })
            );
        }
    }

    /**
     * Throws a NoPermissions error if a resource cannot be renamed.
     * - The resource itself must be writable
     * - When it stays in the same PDS or directory, an override that made it writable moves with it to the new name, so only a resource without its own override is also checked under its new name (e.g. renaming into a protected name)
     * - When it moves to another PDS or directory, the new location is checked as if the resource was being created there
     */
    public static throwIfCannotRename(oldUri: vscode.Uri, newUri: vscode.Uri): void {
        if (!ReadOnlyManagement.isSupportedUri(oldUri) || !ReadOnlyManagement.isSupportedUri(newUri)) {
            return;
        }
        ReadOnlyManagement.throwIfReadOnly(oldUri);
        const oldParent = ReadOnlyManagement.getParentUri(oldUri);
        const newParent = ReadOnlyManagement.getParentUri(newUri);
        const isSameParent = oldParent != null && newParent != null && ReadOnlyManagement.getKey(oldParent) === ReadOnlyManagement.getKey(newParent);
        if (!isSameParent) {
            ReadOnlyManagement.throwIfReadOnly(newUri, { checkParent: true });
        } else if (!ReadOnlyManagement.overrides.has(ReadOnlyManagement.getKey(oldUri))) {
            ReadOnlyManagement.throwIfReadOnly(newUri);
        }
    }

    /**
     * Moves the overrides on a renamed or moved resource (and anything beneath it) to its new location
     */
    public static moveOverrides(oldUri: vscode.Uri, newUri: vscode.Uri): void {
        if (!ReadOnlyManagement.isSupportedUri(oldUri) || !ReadOnlyManagement.isSupportedUri(newUri)) {
            return;
        }
        const oldKey = ReadOnlyManagement.getKey(oldUri);
        const newKey = ReadOnlyManagement.getKey(newUri);
        const moved = [...ReadOnlyManagement.overrides.entries()].filter(([key]) => key === oldKey || key.startsWith(`${oldKey}/`));
        for (const [key] of moved) {
            ReadOnlyManagement.overrides.delete(key);
        }
        for (const [key, readOnly] of moved) {
            ReadOnlyManagement.overrides.set(newKey + key.substring(oldKey.length), readOnly);
        }
        if (moved.length > 0) {
            ReadOnlyManagement.notifyChanged();
        }
    }

    /**
     * Removes the overrides on a deleted resource and anything beneath it
     */
    public static removeOverrides(uri: vscode.Uri): void {
        if (!ReadOnlyManagement.isSupportedUri(uri)) {
            return;
        }
        const key = ReadOnlyManagement.getKey(uri);
        for (const existing of [...ReadOnlyManagement.overrides.keys()]) {
            if (existing === key || existing.startsWith(`${key}/`)) {
                ReadOnlyManagement.overrides.delete(existing);
            }
        }
    }

    /**
     * Shows an error if the resource is read-only, for actions to check before prompting the user or changing anything on the mainframe.
     * @returns true if the resource is read-only and the action should stop
     */
    public static async showErrorIfReadOnly(uri: vscode.Uri, opts?: { checkParent?: boolean }): Promise<boolean> {
        try {
            ReadOnlyManagement.throwIfReadOnly(uri, opts);
            return false;
        } catch (err) {
            await Gui.errorMessage((err as Error).message);
            return true;
        }
    }

    public static applyPermission<T extends vscode.FileStat>(uri: vscode.Uri, stat: T): T {
        if (stat == null || stat.type !== vscode.FileType.File || !ReadOnlyManagement.isReadOnly(uri)) {
            return stat;
        }
        return { ...stat, permissions: vscode.FilePermission.Readonly };
    }

    /**
     * Makes a resource read-only or writable. Overrides on children are cleared so that the resource decides the state for everything beneath it.
     * Design choice thoughts:
     * - Overrides only last for the session, because the zowe.readOnly.rules is the explicit action that determines rules
     * - If a user wants to always set a certain file as read-only or writable, they should define that in their zowe.readOnly.rules setting
     * - If overrides were persistent across sessions, users may be confused why some files are read-only and some aren't
     *   e.g. if browsing a data set without wanting to accidentally change it
     */
    public static setReadOnly(uri: vscode.Uri, readOnly: boolean): void {
        const key = ReadOnlyManagement.getKey(uri);
        for (const existing of [...ReadOnlyManagement.overrides.keys()]) {
            if (existing === key || existing.startsWith(`${key}/`)) {
                ReadOnlyManagement.overrides.delete(existing);
            }
        }

        if (ReadOnlyManagement.isReadOnly(uri.with({ query: "" })) !== readOnly) {
            ReadOnlyManagement.overrides.set(key, readOnly);
        }

        ReadOnlyManagement.notifyChanged();
    }

    public static notifyChanged(): void {
        ReadOnlyManagement.changeEmitter.fire();
    }

    /**
     * Whether the read-only/writable context menu options apply to the given tree node
     */
    public static isEligibleNode(node: IZoweTreeNode): boolean {
        if (!ReadOnlyManagement.isSupportedUri(node?.resourceUri) || node.contextValue == null) {
            return false;
        }
        return (
            SharedContext.isDs(node) ||
            SharedContext.isPds(node) ||
            SharedContext.isDsMember(node) ||
            SharedContext.isDsSession(node) ||
            SharedContext.isUssSession(node) ||
            SharedContext.isUssDirectory(node) ||
            SharedContext.isText(node) ||
            SharedContext.isBinary(node)
        );
    }

    /**
     * If a tree node is refreshed and its URI is now read-only, set its context to be so, and vice versa
     */
    public static getTreeItem(node: IZoweTreeNode): vscode.TreeItem {
        if (!ReadOnlyManagement.isEligibleNode(node)) {
            return node;
        }
        const node2 = new vscode.TreeItem(node.label, node.collapsibleState);
        node2.id = node.id;
        node2.iconPath = node.iconPath;
        node2.description = node.description;
        node2.resourceUri = node.resourceUri;
        node2.tooltip = node.tooltip;
        node2.command = node.command;
        node2.accessibilityInformation = node.accessibilityInformation;
        node2.checkboxState = node.checkboxState;
        node2.contextValue =
            node.contextValue + (ReadOnlyManagement.isReadOnly(node.resourceUri) ? Constants.READ_ONLY_CONTEXT : Constants.WRITABLE_CONTEXT);
        return node2;
    }

    private static getParentUri(uri: vscode.Uri): vscode.Uri | undefined {
        const segments = uri.path.split("/").filter(Boolean);
        if (segments.length < 2) {
            return undefined;
        }
        return uri.with({ path: `/${segments.slice(0, -1).join("/")}`, query: "" });
    }

    private static getDisplayName(uri: vscode.Uri): string {
        const [profile, ...rest] = ReadOnlyManagement.getSegments(uri);
        if (rest.length === 0) {
            return profile;
        }
        if ((uri.scheme as ZoweScheme) === ZoweScheme.DS) {
            return rest.length > 1 ? `${rest[0]}(${rest[1]})` : rest[0];
        }
        return `/${rest.join("/")}`;
    }

    private static getKey(uri: vscode.Uri): string {
        return `${uri.scheme}:/${ReadOnlyManagement.getSegments(uri).join("/")}`;
    }

    private static getKeyAndParents(uri: vscode.Uri): string[] {
        const segments = ReadOnlyManagement.getSegments(uri);
        const keys: string[] = [];
        for (let i = segments.length; i > 0; i--) {
            keys.push(`${uri.scheme}:/${segments.slice(0, i).join("/")}`);
        }
        return keys;
    }

    private static getSegments(uri: vscode.Uri): string[] {
        const segments = uri.path.split("/").filter(Boolean);
        if ((uri.scheme as ZoweScheme) === ZoweScheme.DS) {
            // Case: if extension is applied to the URI, remove it from returned segments
            // Extension is added in lowercase while data set names are always upper case
            return segments.map((segment, i) => (i > 0 ? segment.replace(/\.[a-z][a-z0-9]*$/, "") : segment));
        }
        return segments;
    }

    /**
     * Returns the rules from the settings with their patterns "compiled". The result is cached until the setting changes or extension restarts
     */
    private static getReadOnlyRules(): CachedReadOnlyRule[] {
        if (ReadOnlyManagement.ruleCache == null) {
            const rules = SettingsConfig.getDirectValue<ReadOnlyRule[]>(Constants.SETTINGS_READ_ONLY_RULES);
            ReadOnlyManagement.ruleCache = [];
            for (const rule of Array.isArray(rules) ? rules : []) {
                if (rule == null) {
                    continue;
                }
                const pattern = ReadOnlyManagement.parseNegation(rule.pattern);
                const uss = ReadOnlyManagement.parseNegation(rule.uss);
                const cachedRule: CachedReadOnlyRule = {
                    profile: rule.profile,
                    matchesDs: pattern.value ? ReadOnlyManagement.compileDsPattern(pattern.value) : undefined,
                    dsNegated: pattern.negated,
                    uss: uss.value ? ReadOnlyManagement.ussGlobToRegex(uss.value) : undefined,
                    ussNegated: uss.negated,
                };
                const isProfileOnly = rule.profile != null && rule.pattern == null && rule.uss == null;
                // Skip empty rules, and rules whose patterns are blank or only "!"
                if (isProfileOnly || cachedRule.matchesDs != null || cachedRule.uss != null) {
                    ReadOnlyManagement.ruleCache.push(cachedRule);
                }
            }
        }
        return ReadOnlyManagement.ruleCache;
    }

    private static parseNegation(pattern: string | undefined): { value?: string; negated: boolean } {
        const trimmed = typeof pattern === "string" ? pattern.trim() : undefined;
        if (!trimmed) {
            return { negated: false };
        }
        if (trimmed.startsWith("!")) {
            return { value: trimmed.substring(1).trim(), negated: true };
        }
        return { value: trimmed, negated: false };
    }

    private static matchesRule(uri: vscode.Uri): boolean {
        const [profile, ...rest] = ReadOnlyManagement.getSegments(uri);
        const isDs = (uri.scheme as ZoweScheme) === ZoweScheme.DS;
        let readOnly = false;
        for (const rule of ReadOnlyManagement.getReadOnlyRules()) {
            if (rule.profile != null && rule.profile !== profile) {
                continue;
            }
            if (rule.matchesDs == null && rule.uss == null) {
                // Profile only rules cover everything in the profile
                readOnly = true;
            } else if (isDs) {
                if (rule.matchesDs != null && rest.length > 0 && rule.matchesDs(rest[0], rest[1])) {
                    readOnly = !rule.dsNegated;
                }
            } else if (rule.uss != null && rule.uss.test(`/${rest.join("/")}`)) {
                readOnly = !rule.ussNegated;
            }
        }
        return readOnly;
    }

    private static escapeRegex(text: string): string {
        return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    /**
     * Compiles a data set rule pattern into a matcher
     */
    public static compileDsPattern(pattern: string): (dsName: string, member?: string) => boolean {
        const memberPattern = /^(.+)\(([^)]*)\)$/.exec(pattern.trim());
        if (memberPattern == null) {
            const dsRegex = ReadOnlyManagement.dsMaskToRegex(pattern);
            return (dsName) => dsRegex.test(dsName);
        }
        const dsRegex = ReadOnlyManagement.dsMaskToRegex(memberPattern[1], false);
        const memberRegex = new RegExp(
            `^${[...memberPattern[2].trim().toUpperCase()]
                .map((c) => (c === "%" ? "." : c === "*" ? ".*" : ReadOnlyManagement.escapeRegex(c)))
                .join("")}$`,
            "i"
        );
        return (dsName, member) => member != null && dsRegex.test(dsName) && memberRegex.test(member);
    }

    /**
     * Converts a data set mask into a regular expression (usual z/OS mask rules apply for %, * and **)
     * Data sets beneath the matched levels also match
     */
    public static dsMaskToRegex(mask: string, includeLowerLevels = true): RegExp {
        const qualifiers = mask.trim().toUpperCase().split(".");
        let regex = "";
        qualifiers.forEach((qualifier, i) => {
            if (qualifier === "**") {
                if (i === 0) {
                    regex += qualifiers.length === 1 ? ".*" : "(?:.*\\.)?";
                } else {
                    regex += "(?:\\..*)?";
                }
                return;
            }
            const previous = qualifiers[i - 1];
            if (i > 0 && (previous !== "**" || i - 1 > 0)) {
                regex += "\\.";
            }
            regex += [...qualifier].map((c) => (c === "%" ? "[^.]" : c === "*" ? "[^.]*" : ReadOnlyManagement.escapeRegex(c))).join("");
        });
        // ZXP.* matches ZXP.A.B and ZXP.PUBLIC matches ZXP.PUBLIC.JCL
        if (includeLowerLevels && qualifiers[qualifiers.length - 1] !== "**") {
            regex += "(?:\\..*)?";
        }
        return new RegExp(`^${regex}$`, "i");
    }

    /**
     * Converts a USS path glob into a regular expression (usual unix glob patterns apply for ?, * and **)
     */
    public static ussGlobToRegex(glob: string): RegExp {
        let regex = "";
        for (let i = 0; i < glob.length; i++) {
            if (glob.startsWith("/**", i) && (i + 3 === glob.length || glob[i + 3] === "/")) {
                regex += "(?:/.*)?";
                i += 2;
            } else if (glob.startsWith("**", i)) {
                const isWholeSegment = i === 0 && (i + 2 === glob.length || glob[i + 2] === "/");
                regex += isWholeSegment ? ".*" : "[^/]*";
                i += 1;
            } else if (glob[i] === "*") {
                regex += "[^/]*";
            } else if (glob[i] === "?") {
                regex += "[^/]";
            } else {
                regex += ReadOnlyManagement.escapeRegex(glob[i]);
            }
        }
        return new RegExp(`^${regex}$`);
    }
}
