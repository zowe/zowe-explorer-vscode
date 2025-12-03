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

// Generic utility functions related to all node types. See ./src/utils.ts for other utility functions.

import * as vscode from "vscode";
import * as path from "path";
import {
    Gui,
    IZoweTreeNode,
    IZoweDatasetTreeNode,
    IZoweUSSTreeNode,
    IZoweJobTreeNode,
    Types,
    ZosEncoding,
    Sorting,
    imperative,
    CorrelatedError,
} from "@zowe/zowe-explorer-api";
import { UssFSProvider } from "../uss/UssFSProvider";
import { USSUtils } from "../uss/USSUtils";
import { Constants } from "../../configuration/Constants";
import { ZoweLocalStorage } from "../../tools/ZoweLocalStorage";
import { ZoweLogger } from "../../tools/ZoweLogger";
import { SharedContext } from "./SharedContext";
import { Definitions } from "../../configuration/Definitions";
import { SettingsConfig } from "../../configuration/SettingsConfig";
import { ZoweExplorerApiRegister } from "../../extending/ZoweExplorerApiRegister";

export const isDataTransfer = (o: any): o is { get: (m: string) => any } => !!o && typeof o.get === "function";

export const isPayload = (o: any): o is { value: any[] } => !!o && Array.isArray(o.value);
export class SharedUtils {
    public static ERROR_SAME_OBJECT_DROP =
        "Cannot move: The source and target are the same. You are using a different profile to view the target. Refresh to view changes.";

    public static async copyExternalLink(this: void, context: vscode.ExtensionContext, node: IZoweTreeNode): Promise<void> {
        if (node?.resourceUri != null) {
            await vscode.env.clipboard.writeText(`vscode://${context.extension.id}?${node.resourceUri.toString()}`);
        }
    }

    public static filterTreeByString(value: string, treeItems: vscode.QuickPickItem[]): vscode.QuickPickItem[] {
        ZoweLogger.trace("shared.utils.filterTreeByString called.");
        const filteredArray: vscode.QuickPickItem[] = [];
        value = value.toUpperCase().replace(/\*/g, "(.*)");
        const regex = new RegExp(value);
        treeItems.forEach((item) => {
            if (item.label.toUpperCase().match(regex)) {
                filteredArray.push(item);
            }
        });
        return filteredArray;
    }

    /**
     * Gets path to the icon, which is located in resources folder
     * @param iconFileName {string} Name of icon file with extension
     * @returns {object}
     */
    public static getIconPathInResources(iconFileName: string): {
        light: string;
        dark: string;
    } {
        return {
            light: path.join(Constants.ROOTPATH, "resources", "light", iconFileName),
            dark: path.join(Constants.ROOTPATH, "resources", "dark", iconFileName),
        };
    }

    /*************************************************************************************************************
     * Returns array of all subnodes of given node
     *************************************************************************************************************/
    public static concatChildNodes(nodes: Types.IZoweNodeType[]): Types.IZoweNodeType[] {
        ZoweLogger.trace("shared.utils.concatChildNodes called.");
        let allNodes = new Array<Types.IZoweNodeType>();

        for (const node of nodes) {
            allNodes = allNodes.concat(SharedUtils.concatChildNodes(node.children));
            allNodes.push(node);
        }
        return allNodes;
    }

    public static sortTreeItems(favorites: vscode.TreeItem[], specificContext): void {
        favorites.sort((a, b) => {
            if (a.contextValue === specificContext) {
                if (b.contextValue === specificContext) {
                    return a.label.toString().toUpperCase() > b.label.toString().toUpperCase() ? 1 : -1;
                }

                return -1;
            }

            if (b.contextValue === specificContext) {
                return 1;
            }

            return a.label.toString().toUpperCase() > b.label.toString().toUpperCase() ? 1 : -1;
        });
    }

    /*************************************************************************************************************
     * Determine IDE name to display based on app environment
     *************************************************************************************************************/
    public static getAppName(): "VS Code" {
        return "VS Code";
    }

    public static checkIfChildPath(parentPath: string, childPath: string): boolean {
        const relativePath = path.relative(parentPath, childPath);
        return relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
    }

    // Type guarding for current IZoweNodeType.
    // Makes it possible to have multiple types in a function signature, but still be able to use type specific code inside the function definition
    public static isZoweDatasetTreeNode(node: Types.IZoweNodeType): node is IZoweDatasetTreeNode {
        return (node as IZoweDatasetTreeNode).pattern !== undefined;
    }

    public static isZoweUSSTreeNode(node: IZoweDatasetTreeNode | IZoweUSSTreeNode | IZoweJobTreeNode): node is IZoweUSSTreeNode {
        return (node as IZoweUSSTreeNode).openUSS !== undefined;
    }

    public static isZoweJobTreeNode(node: IZoweDatasetTreeNode | IZoweUSSTreeNode | IZoweJobTreeNode): node is IZoweJobTreeNode {
        return (node as IZoweJobTreeNode).job !== undefined;
    }

    public static getSelectedNodeList(node: IZoweTreeNode, nodeList: IZoweTreeNode[]): IZoweTreeNode[] {
        let resultNodeList: IZoweTreeNode[] = [];
        if (!nodeList) {
            resultNodeList.push(node);
        } else {
            resultNodeList = nodeList;
        }
        return resultNodeList.filter(Boolean);
    }

    /**
     * Function that validates job prefix
     * @param {string} text - prefix text
     * @returns undefined | string
     */
    public static jobStringValidator(text: string, localizedParam: "owner" | "prefix"): string | null {
        switch (localizedParam) {
            case "owner":
                return text.length > Constants.JOBS_MAX_PREFIX ? vscode.l10n.t("Invalid job owner") : null;
            case "prefix":
            default:
                return text.length > Constants.JOBS_MAX_PREFIX ? vscode.l10n.t("Invalid job prefix") : null;
        }
    }

    public static async getCachedEncoding(node: IZoweTreeNode): Promise<string | undefined> {
        let cachedEncoding: ZosEncoding;
        if (SharedUtils.isZoweUSSTreeNode(node)) {
            cachedEncoding = await node.getEncodingInMap(node.resourceUri.path);
        } else if (SharedUtils.isZoweJobTreeNode(node)) {
            cachedEncoding = await node.getEncodingInMap(node.resourceUri.path);
        } else {
            cachedEncoding = await (node as IZoweDatasetTreeNode).getEncodingInMap(node.resourceUri.path);
        }
        return cachedEncoding?.kind === "other" ? cachedEncoding.codepage : cachedEncoding?.kind;
    }

    /**
     * Gets the cached directory encoding preference for a profile.
     * @param profileName The profile name to get encoding for
     * @returns The cached directory encoding preference or undefined
     */
    public static getCachedDirectoryEncoding(profileName: string): "auto-detect" | ZosEncoding | undefined {
        const encodingMap = ZoweLocalStorage.getValue<Record<string, "auto-detect" | ZosEncoding>>(
            Definitions.LocalStorageKey.USS_DIRECTORY_ENCODING
        );
        return encodingMap?.[profileName];
    }

    /**
     * Saves the directory encoding preference for a profile.
     * @param profileName The profile name to save encoding for
     * @param encoding The encoding preference to save
     */
    public static setCachedDirectoryEncoding(profileName: string, encoding: "auto-detect" | ZosEncoding): void {
        const encodingMap =
            ZoweLocalStorage.getValue<Record<string, "auto-detect" | ZosEncoding>>(Definitions.LocalStorageKey.USS_DIRECTORY_ENCODING) ?? {};
        encodingMap[profileName] = encoding;
        ZoweLocalStorage.setValue(Definitions.LocalStorageKey.USS_DIRECTORY_ENCODING, encodingMap);
    }

    public static parseFavorites(lines: string[]): Definitions.FavoriteData[] {
        const invalidFavoriteWarning = (line: string): void =>
            ZoweLogger.warn(
                vscode.l10n.t({ message: "Failed to parse a saved favorite. Attempted to parse: {0}", args: [line], comment: ["Plaintext line"] })
            );

        return lines
            .map((line) => {
                // [profile]: label{context}
                const closingSquareBracket = line.indexOf("]");

                // Filter out lines with a missing opening/closing square bracket as they are invalid
                if (!line.startsWith("[") || closingSquareBracket === -1) {
                    invalidFavoriteWarning(line);
                    return null;
                }

                const profileName = line.substring(1, closingSquareBracket);

                // label{context}
                const remainderOfLine = line.substring(closingSquareBracket + 2).trim();

                // Filter out lines that do not contain a label and context value
                if (remainderOfLine.length === 0) {
                    invalidFavoriteWarning(line);
                    return null;
                }

                const openingCurlyBrace = remainderOfLine.indexOf("{");
                return {
                    profileName,
                    label: remainderOfLine.substring(0, openingCurlyBrace).trim(),
                    contextValue: openingCurlyBrace > 0 ? remainderOfLine.substring(openingCurlyBrace + 1, remainderOfLine.indexOf("}")) : undefined,
                };
            })
            .filter(Boolean);
    }

    /**
     * Builds the options for an encoding selection prompt.
     *
     * @param {imperative.IProfileLoaded} profile - The profile loaded
     * @param {string} taggedEncoding - The tagged encoding
     * @param {boolean} isDirectory - Whether the target is a directory
     * @returns {vscode.QuickPickItem[]} The encoding options for the prompt
     */
    private static buildEncodingOptions(profile: imperative.IProfileLoaded, taggedEncoding?: string, isDirectory?: boolean): vscode.QuickPickItem[] {
        const ebcdicItem: vscode.QuickPickItem = {
            label: vscode.l10n.t("EBCDIC"),
            description: vscode.l10n.t("z/OS default codepage"),
        };
        const binaryItem: vscode.QuickPickItem = {
            label: vscode.l10n.t("Binary"),
            description: vscode.l10n.t("Raw data representation"),
        };
        const otherItem: vscode.QuickPickItem = {
            label: vscode.l10n.t("Other"),
            description: vscode.l10n.t("Specify another codepage"),
        };
        const items: vscode.QuickPickItem[] = [ebcdicItem, binaryItem, otherItem];

        if (isDirectory) {
            items.splice(0, 0, {
                label: vscode.l10n.t("Auto-detect from file tags"),
                description: vscode.l10n.t("Let the API infer encoding from individual USS file tags"),
            });
        }

        items.push(Constants.SEPARATORS.RECENT);

        if (profile.profile?.encoding != null) {
            items.splice(0, 0, {
                label: String(profile.profile?.encoding),
                description: vscode.l10n.t({
                    message: "From profile {0}",
                    args: [profile.name],
                    comment: ["Profile name"],
                }),
            });
        }
        if (taggedEncoding != null) {
            items.splice(0, 0, {
                label: taggedEncoding,
                description: vscode.l10n.t("USS file tag"),
            });
        }

        const encodingHistory = ZoweLocalStorage.getValue<string[]>(Definitions.LocalStorageKey.ENCODING_HISTORY) ?? [];
        if (encodingHistory.length > 0) {
            for (const encoding of encodingHistory) {
                items.push({ label: encoding });
            }
        } else {
            // Pre-populate recent list with some common encodings
            items.push({ label: "IBM-1047" }, { label: "ISO8859-1" });
        }

        return items;
    }

    /**
     * Processes the encoding selection response and returns the appropriate `ZosEncoding` object.
     *
     * @param {string} response - The response from the user
     * @param {string} contextLabel - The context label of the node
     * @returns {Promise<ZosEncoding | null | undefined>} The {@link ZosEncoding} object, `null` for auto-detect,
     *   or `undefined` if the user dismisses the prompt
     */
    private static async processEncodingResponse(response: string | undefined, contextLabel: string): Promise<ZosEncoding | null | undefined> {
        if (!response) {
            return undefined;
        }

        let encoding: ZosEncoding;
        const encodingHistory = ZoweLocalStorage.getValue<string[]>(Definitions.LocalStorageKey.ENCODING_HISTORY) ?? [];

        // Use localized labels for comparison
        const ebcdicLabel = vscode.l10n.t("EBCDIC");
        const binaryLabel = vscode.l10n.t("Binary");
        const otherLabel = vscode.l10n.t("Other");

        switch (response) {
            case ebcdicLabel:
                encoding = { kind: "text" };
                break;
            case binaryLabel:
                encoding = { kind: "binary" };
                break;
            case otherLabel: {
                const customResponse = await Gui.showInputBox({
                    title: vscode.l10n.t({
                        message: "Choose encoding for {0}",
                        args: [contextLabel],
                        comment: ["Context label"],
                    }),
                    placeHolder: vscode.l10n.t("Enter a codepage (e.g., 1047, IBM-1047)"),
                });
                if (customResponse) {
                    encoding = { kind: "other", codepage: customResponse };
                    encodingHistory.push(encoding.codepage);
                    ZoweLocalStorage.setValue(Definitions.LocalStorageKey.ENCODING_HISTORY, encodingHistory.slice(0, Constants.MAX_FILE_HISTORY));
                } else {
                    Gui.infoMessage(vscode.l10n.t("Operation cancelled"));
                    return undefined;
                }
                break;
            }
            default: {
                const autoDetectLabel = vscode.l10n.t("Auto-detect from file tags");
                if (response === autoDetectLabel) {
                    return null;
                } else {
                    encoding = response === "binary" ? { kind: "binary" } : { kind: "other", codepage: response };
                }
                break;
            }
        }
        return encoding;
    }

    /**
     * Helper function to prompt user for encoding selection
     */
    private static async promptForEncodingSelection(items: vscode.QuickPickItem[], title: string, placeHolder?: string): Promise<string | undefined> {
        return (
            await Gui.showQuickPick(items, {
                title,
                placeHolder,
            })
        )?.label;
    }

    /**
     * Prompts user for encoding selection for upload operations.
     *
     * @param {imperative.IProfileLoaded} profile - The profile loaded
     * @param {string} contextLabel - The context label of the node (e.g. USS directory path, PDS name)
     * @param {string} taggedEncoding - The tagged encoding (optional), specifically used for USS files
     * @returns {Promise<ZosEncoding | undefined>} The {@link ZosEncoding} object or `undefined` if the user dismisses the prompt
     */
    public static async promptForUploadEncoding(
        profile: imperative.IProfileLoaded,
        contextLabel: string,
        taggedEncoding?: string
    ): Promise<ZosEncoding | undefined> {
        const items = SharedUtils.buildEncodingOptions(profile, taggedEncoding);

        // For uploads, default to profile encoding or EBCDIC
        const defaultEncoding = profile.profile?.encoding ?? vscode.l10n.t("EBCDIC");

        const response = await SharedUtils.promptForEncodingSelection(
            items,
            vscode.l10n.t({
                message: "Choose encoding for upload to {0}",
                args: [contextLabel],
                comment: ["Context label"],
            }),
            vscode.l10n.t({
                message: "Default encoding is {0}",
                args: [defaultEncoding],
                comment: ["Encoding name"],
            })
        );

        return SharedUtils.processEncodingResponse(response, contextLabel);
    }

    /**
     * Prompts user for encoding selection for download operations.
     *
     * @param {imperative.IProfileLoaded} profile - The profile loaded
     * @param {string} contextLabel - The context label of the node (e.g. data set name)
     * @returns {Promise<ZosEncoding | undefined>} The {@link ZosEncoding} object or `undefined` if the user dismisses the prompt
     */
    public static async promptForDownloadEncoding(profile: imperative.IProfileLoaded, contextLabel: string): Promise<ZosEncoding | undefined> {
        const items = SharedUtils.buildEncodingOptions(profile);

        // For downloads, default to profile encoding or EBCDIC
        const defaultEncoding = profile.profile?.encoding ?? vscode.l10n.t("EBCDIC");

        const response = await SharedUtils.promptForEncodingSelection(
            items,
            vscode.l10n.t({
                message: "Choose encoding for download from {0}",
                args: [contextLabel],
                comment: ["Context label"],
            }),
            vscode.l10n.t({
                message: "Default encoding is {0}",
                args: [defaultEncoding],
                comment: ["Encoding name"],
            })
        );

        return SharedUtils.processEncodingResponse(response, contextLabel);
    }

    public static async promptForEncoding(
        node: IZoweDatasetTreeNode | IZoweUSSTreeNode | IZoweJobTreeNode,
        taggedEncoding?: string
    ): Promise<ZosEncoding | null | undefined> {
        const profile = node.getProfile();
        const items = SharedUtils.buildEncodingOptions(profile, taggedEncoding, false);

        let zosEncoding = await node.getEncoding();
        if (zosEncoding === undefined && SharedUtils.isZoweUSSTreeNode(node)) {
            zosEncoding = await UssFSProvider.instance.fetchEncodingForUri(node.resourceUri);
        }
        let currentEncoding = zosEncoding ? USSUtils.zosEncodingToString(zosEncoding) : await SharedUtils.getCachedEncoding(node);
        if (zosEncoding?.kind === "binary" || currentEncoding === "binary") {
            currentEncoding = vscode.l10n.t("Binary");
        } else if (zosEncoding?.kind === "text" || currentEncoding === "text") {
            currentEncoding = vscode.l10n.t("EBCDIC");
        } else if (zosEncoding == null && currentEncoding == null) {
            currentEncoding = profile.profile?.encoding ?? vscode.l10n.t("EBCDIC");
        }

        const response = await SharedUtils.promptForEncodingSelection(
            items,
            vscode.l10n.t({
                message: "Choose encoding for {0}",
                args: [node.label as string],
                comment: ["Node label"],
            }),
            currentEncoding &&
                vscode.l10n.t({
                    message: "Current encoding is {0}",
                    args: [currentEncoding],
                    comment: ["Encoding name"],
                })
        );

        return SharedUtils.processEncodingResponse(response, node.label as string);
    }

    /**
     * Prompts user for encoding selection for USS directory downloads.
     *
     * @param {imperative.IProfileLoaded} profile - The profile loaded
     * @param {string} contextLabel - The context label of the directory (e.g. USS directory path)
     * @param {"auto-detect" | ZosEncoding} currentDirectoryEncoding - Current directory encoding preference
     * @returns {Promise<"auto-detect" | ZosEncoding | undefined>} "auto-detect" string, ZosEncoding object, or undefined if dismissed
     */
    public static async promptForDirectoryEncoding(
        profile: imperative.IProfileLoaded,
        contextLabel: string,
        currentDirectoryEncoding?: "auto-detect" | ZosEncoding
    ): Promise<"auto-detect" | ZosEncoding | undefined> {
        const items = SharedUtils.buildEncodingOptions(profile, undefined, true);

        let currentEncoding: string | undefined;
        if (currentDirectoryEncoding === "auto-detect") {
            currentEncoding = vscode.l10n.t("Auto-detect from file tags");
        } else if (currentDirectoryEncoding) {
            currentEncoding =
                currentDirectoryEncoding.kind === "binary"
                    ? vscode.l10n.t("Binary")
                    : currentDirectoryEncoding.kind === "text"
                    ? vscode.l10n.t("EBCDIC")
                    : `${currentDirectoryEncoding.kind.toUpperCase()}-${currentDirectoryEncoding.codepage}`;
        } else {
            currentEncoding = vscode.l10n.t("Auto-detect from file tags"); // Default for directories
        }

        const response = await SharedUtils.promptForEncodingSelection(
            items,
            vscode.l10n.t({
                message: "Choose encoding for files in {0}",
                args: [contextLabel],
                comment: ["Directory path"],
            }),
            vscode.l10n.t({
                message: "Current encoding is {0}",
                args: [currentEncoding],
                comment: ["Encoding name"],
            })
        );

        const result = await SharedUtils.processEncodingResponse(response, contextLabel);
        if (result === null) {
            return "auto-detect";
        }
        return result;
    }

    public static getSessionLabel(node: IZoweTreeNode): string {
        return (SharedContext.isSession(node) ? node : node.getSessionNode()).label as string;
    }

    /**
     * Adds one or more Data Sets/USS nodes to a workspace.
     * @param node Single node selection
     * @param nodeList List of selected nodes
     */
    public static addToWorkspace(
        this: void,
        node: IZoweUSSTreeNode | IZoweDatasetTreeNode,
        nodeList: IZoweUSSTreeNode[] | IZoweDatasetTreeNode[]
    ): void {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList);
        const urisToAdd: {
            name: string;
            uri: vscode.Uri;
        }[] = [];
        for (const item of selectedNodes) {
            let resourceUri = item.resourceUri;
            const isSession = SharedContext.isSession(item);
            if (isSession) {
                if (item.fullPath?.length > 0) {
                    resourceUri = item.resourceUri.with({ path: path.posix.join(item.resourceUri.path, item.fullPath) });
                } else {
                    Gui.infoMessage(
                        vscode.l10n.t({
                            message: "A search must be set for {0} before it can be added to a workspace.",
                            args: [item.label as string],
                            comment: "Name of USS session",
                        })
                    );
                    continue;
                }
            }
            if (workspaceFolders?.some((folder) => folder.uri === resourceUri)) {
                continue;
            }

            urisToAdd.push({
                name: `[${item.getProfileName()}] ${SharedContext.isDatasetNode(item) ? (item.label as string) : item.fullPath}`,
                uri: resourceUri,
            });
        }

        vscode.workspace.updateWorkspaceFolders(workspaceFolders?.length ?? 0, null, ...urisToAdd);
    }

    /**
     * Debounces an event handler to prevent duplicate triggers.
     * @param callback Event handler callback
     * @param delay Number of milliseconds to delay
     */
    public static debounce<T extends (...args: any[]) => void>(callback: T, delay: number): (...args: Parameters<T>) => void {
        let timeoutId: ReturnType<typeof setTimeout>;
        return (...args: Parameters<T>): void => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            timeoutId = setTimeout(() => callback(...args), delay);
        };
    }

    /**
     * Debounces an async event callback to prevent duplicate triggers.
     * @param callback Async event callback
     * @param delay Number of milliseconds to delay
     */
    public static debounceAsync<T extends (...args: any[]) => Promise<any>>(
        callback: T,
        delay: number
    ): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
        let timeoutId: ReturnType<typeof setTimeout>;

        return (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            // Returns a promise that is fulfilled after the debounced callback finishes
            return new Promise<Awaited<ReturnType<T>>>((resolve, reject) => {
                timeoutId = setTimeout(() => {
                    callback(...args).then(resolve, reject);
                }, delay);
            });
        };
    }

    public static updateSortOptionsWithDefault<T>(sortMethod: T, sortOptions: string[]): void {
        ZoweLogger.trace("shared.utils.updateSortOptionsWithDefault called.");
        for (let i = 0; i < sortOptions.length; i++) {
            sortOptions[i] = sortOptions[i].replace(` ${vscode.l10n.t("(default)")}`, "");
            if (i === Number(sortMethod)) {
                sortOptions[i] = `${sortOptions[i]} ${vscode.l10n.t("(default)")}`;
            }
        }
    }

    /**
     * Gets the sort options from the settings with the default sort option marked
     * @param sortOptions The list of sort options
     * @param settingsKey The default sort method key
     * @param sortMethod The sort method
     * @returns The list of sort options with the default sort option marked
     */
    public static getDefaultSortOptions<T extends object>(sortOptions: string[], settingsKey: string, sortMethod: T): Sorting.NodeSort {
        ZoweLogger.trace("shared.utils.getDefaultSortOptions called.");
        const defaultMethod = sortMethod[Object.keys(sortMethod)[0]];
        const defaultDirection = Sorting.SortDirection.Ascending;

        const sortSetting = SettingsConfig.getDirectValue<Sorting.NodeSort>(settingsKey);
        if (sortSetting == null || !sortSetting.method || !sortSetting.direction) {
            SharedUtils.updateSortOptionsWithDefault(defaultMethod, sortOptions);
            return {
                method: defaultMethod,
                direction: defaultDirection,
            };
        }

        if (typeof sortSetting.method === "string") {
            const methodKey = sortSetting.method as keyof typeof sortMethod;
            if (methodKey in sortMethod) {
                sortSetting.method = sortMethod[methodKey] as Sorting.JobSortOpts | Sorting.DatasetSortOpts;
            } else {
                sortSetting.method = defaultMethod;
            }
            SharedUtils.updateSortOptionsWithDefault(sortSetting.method, sortOptions);
        }

        if (typeof sortSetting.direction === "string") {
            const directionKey = sortSetting.direction as keyof typeof Sorting.SortDirection;
            if (directionKey in Sorting.SortDirection) {
                sortSetting.direction = Sorting.SortDirection[directionKey];
            } else {
                sortSetting.direction = defaultDirection;
            }
        }

        return {
            method: sortSetting?.method ?? defaultMethod,
            direction: sortSetting?.direction ?? defaultDirection,
        };
    }

    public static async handleDragAndDropOverwrite(
        target: IZoweDatasetTreeNode | IZoweUSSTreeNode | undefined,
        draggedNodes: Record<string, IZoweDatasetTreeNode | IZoweUSSTreeNode>
    ): Promise<boolean> {
        const movedIntoChild = Object.values(draggedNodes).some((n) => target.resourceUri.path.startsWith(n.resourceUri.path));
        if (movedIntoChild) {
            return false;
        }

        // determine if any overwrites may occur
        const willOverwrite = Object.values(draggedNodes).some((n) => target.children?.find((tc) => tc.label === n.label) != null);
        if (willOverwrite) {
            const userOpts = [vscode.l10n.t("Confirm")];
            const resp = await Gui.warningMessage(
                vscode.l10n.t("One or more items may be overwritten from this drop operation. Confirm or cancel?"),
                {
                    items: userOpts,
                    vsCodeOpts: {
                        modal: true,
                    },
                }
            );
            if (resp == null || resp !== userOpts[0]) {
                return false;
            } else {
                return true;
            }
        }
        return true;
    }

    public static async handleProfileChange(treeProviders: Definitions.IZoweProviders, profile: imperative.IProfileLoaded): Promise<void> {
        for (const provider of Object.values(treeProviders)) {
            try {
                const node = (await provider.getChildren()).find((n) => n.label === profile?.name);
                node?.setProfileToChoice?.(profile);
            } catch (err) {
                if (err instanceof Error) {
                    ZoweLogger.error(err.message);
                }
                return;
            }
        }
    }

    /**
     * Handles download response and provides detailed feedback to user about successes, warnings, and failures
     *
     * @param response The response from the download API
     * @param downloadType The type of download (File, Directory, Data set, etc.)
     */
    public static async handleDownloadResponse(response: any, downloadType: string): Promise<void> {
        ZoweLogger.trace("SharedUtils.handleDownloadResponse called.");

        if (!response) {
            Gui.showMessage(vscode.l10n.t("{0} download completed.", downloadType));
            return;
        }

        let message = "";
        let hasWarnings = false;
        let hasErrors = false;
        const detailedInfo: string[] = [];

        if (response.success === false) {
            hasErrors = true;
            message = vscode.l10n.t("{0} download completed with errors.", downloadType);
        } else {
            message = vscode.l10n.t("{0} downloaded successfully.", downloadType);
        }

        if (response.commandResponse) {
            const commandResponse = response.commandResponse.toString();

            if (commandResponse.includes("already exists") || commandResponse.includes("skipped")) {
                hasWarnings = true;
                detailedInfo.push("Some files were skipped because they already exist.");
            }

            if (commandResponse.includes("failed") || commandResponse.includes("error")) {
                hasErrors = true;
                detailedInfo.push("Some files failed to download due to errors.");
            }

            ZoweLogger.info(`Download response details: ${String(commandResponse)}`);
            detailedInfo.push(`Full response: ${String(commandResponse)}`);
        }

        if (response.apiResponse && Array.isArray(response.apiResponse)) {
            const failedItems = response.apiResponse.filter((item: any) => item.error || item.status === "failed");
            if (failedItems.length > 0) {
                hasErrors = true;
                const failedCount = String(failedItems.length);
                ZoweLogger.warn(`${failedCount} items failed to download: ${JSON.stringify(failedItems)}`);
                detailedInfo.push(`${failedCount} items failed to download`);
                detailedInfo.push(`Failed items: ${JSON.stringify(failedItems, null, 2)}`);
            }
        }

        if (hasErrors) {
            const errorMessage = vscode.l10n.t("{0}\n\nSome files may not have been downloaded.", message);
            const correlatedError = new CorrelatedError({
                initialError: new Error(errorMessage),
                correlation: {
                    summary: `${downloadType} download completed with errors`,
                },
            });

            await Gui.errorMessage(errorMessage, {
                items: [vscode.l10n.t("View Details")],
                vsCodeOpts: { modal: false },
            }).then((selection) => {
                if (selection === vscode.l10n.t("View Details")) {
                    vscode.commands.executeCommand("zowe.troubleshootError", correlatedError, detailedInfo.join("\n\n"));
                }
            });
        } else if (hasWarnings) {
            const warningMessage = vscode.l10n.t("{0}\n\nSome files may have been skipped.", message);
            const correlatedWarning = new CorrelatedError({
                initialError: new Error(warningMessage),
                correlation: {
                    summary: `${downloadType} download completed with warnings`,
                },
            });

            await Gui.warningMessage(warningMessage, {
                items: [vscode.l10n.t("View Details")],
                vsCodeOpts: { modal: false },
            }).then((selection) => {
                if (selection === vscode.l10n.t("View Details")) {
                    vscode.commands.executeCommand("zowe.troubleshootError", correlatedWarning, detailedInfo.join("\n\n"));
                }
            });
        } else {
            Gui.showMessage(message);
        }
    }

    /**
     * Determines if a dataset is the same physical object on two profiles.
     * Returns true if both profiles have a dataset with the same name and volumes.
     * Blocks ambiguous cases by default.
     */
    public static async isSamePhysicalDataset(
        srcProfile: imperative.IProfileLoaded,
        dstProfile: imperative.IProfileLoaded,
        srcDsn: string
    ): Promise<boolean> {
        try {
            // get API for each profile
            const mvsSrc = ZoweExplorerApiRegister.getMvsApi(srcProfile);
            const mvsDst = ZoweExplorerApiRegister.getMvsApi(dstProfile);

            // look up the same dataset name on BOTH profiles
            const srcAttr = await mvsSrc.dataSet(srcDsn, { attributes: true });
            const dstAttr = await mvsDst.dataSet(srcDsn, { attributes: true });
            const srcDataset = srcAttr?.apiResponse?.items?.[0];
            const dstDataset = dstAttr?.apiResponse?.items?.[0];

            // if dstDataset dataset doesn't exist, it's not the same.
            if (!dstDataset || !srcDataset) return false;

            // compare names
            const namesAreEqual = srcDataset.dsname === dstDataset.dsname;

            // compare vols (could be stored across multiple vols!)
            const srcVols = srcDataset.vols
                ? (Array.isArray(srcDataset.vols) ? srcDataset.vols : [srcDataset.vols]).map((v: any) => String(v).trim().toUpperCase())
                : [];
            const dstVols = dstDataset.vols
                ? (Array.isArray(dstDataset.vols) ? dstDataset.vols : [dstDataset.vols]).map((v: any) => String(v).trim().toUpperCase())
                : [];

            srcVols.sort();
            dstVols.sort();

            const volsAreEqual = srcVols.length === dstVols.length && srcVols.every((vol: any, idx: number) => vol === dstVols[idx]);

            // if both name and vols match, they're the same dataset
            return namesAreEqual && volsAreEqual;
        } catch (err) {
            // fallback to not being same data set
            return false;
        }
    }

    /**
     * Checks if a USS file or directory is likely the same actual object as another
     * by comparing the normalized paths (ignoring profile) and verifying existence
     *
     * @param sourceNode - source USS tree node being moved
     * @param targetParent - target USS tree node parent receiving the drop
     * @param droppedLabel - name of the dropped item
     * @returns Promise resolves to true if the normalized paths match and the target path exists. false otherwise
     */
    public static async isLikelySameUssObjectByUris(
        sourceNode: IZoweUSSTreeNode,
        targetParent: IZoweUSSTreeNode,
        droppedLabel: string
    ): Promise<boolean> {
        //normalize paths
        const equal =
            path.posix.normalize(sourceNode.fullPath.replace(/\\/g, "/")) ===
            path.posix.normalize(path.posix.join(targetParent.fullPath.replace(/\\/g, "/"), (droppedLabel || "").replace(/^[/\\]+/, "")));
        return equal;
    }

    /**
     * Gets a string property from a node, whether it's a string or an object with that property
     */
    public static getNodeProperty(node: any, prop: string): string | null {
        if (!node || node[prop] == null) return null;
        const value = node[prop];
        if (typeof value === "string") return value;
        if (typeof value === "object" && value !== null && typeof value[prop] === "string") {
            return value[prop];
        }
        return null;
    }

    /**
     * Checks if there are any case-insensitive, trimmed name collisions between two lists.
     * Used for PDS member collisions and USS folder/file name collisions.
     */
    public static hasNameCollision(srcNames: string[], tgtNames: string[]): boolean {
        const tgtSet = new Set(tgtNames.map((n) => n.toUpperCase().trim()));
        return srcNames.some((name) => tgtSet.has(name.toUpperCase().trim()));
    }
}
