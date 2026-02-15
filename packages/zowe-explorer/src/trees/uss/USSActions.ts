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
import * as fs from "fs";
import * as path from "path";
import * as zosfiles from "@zowe/zos-files-for-zowe-sdk";
import { Gui, imperative, IZoweUSSTreeNode, Types, ZoweExplorerApiType, ZosEncoding, MessageSeverity } from "@zowe/zowe-explorer-api";
import { isBinaryFileSync } from "isbinaryfile";
import { USSAttributeView } from "./USSAttributeView";
import { USSFileStructure } from "./USSFileStructure";
import { ZoweUSSNode } from "./ZoweUSSNode";
import { Constants } from "../../configuration/Constants";
import { ZoweExplorerApiRegister } from "../../extending/ZoweExplorerApiRegister";
import { LocalFileManagement } from "../../management/LocalFileManagement";
import { ZoweLogger } from "../../tools/ZoweLogger";
import { SharedActions } from "../shared/SharedActions";
import { SharedContext } from "../shared/SharedContext";
import { SharedUtils } from "../shared/SharedUtils";
import { AuthUtils } from "../../utils/AuthUtils";
import { ProfileManagement } from "../../management/ProfileManagement";
import { Definitions } from "../../configuration/Definitions";
import { ZoweLocalStorage } from "../../tools/ZoweLocalStorage";
import { USSUtils } from "./USSUtils";

export class USSActions {
    /**
     * Prompts the user for a path, and populates the [TreeView]{@link vscode.TreeView} based on the path
     *
     * @param {ZoweUSSNode} node - The session or directory node that serves as the parent
     * @param {ussTree} ussFileProvider - Current ussTree used to populate the TreeView
     * @returns {Promise<void>}
     */
    public static async createUSSNode(node: IZoweUSSTreeNode, ussFileProvider: Types.IZoweUSSTreeType, nodeType: string): Promise<void> {
        ZoweLogger.trace("uss.actions.createUSSNode called.");
        await ussFileProvider.checkCurrentProfile(node);
        let filePath = "";
        const isTopLevel = SharedContext.isSession(node);
        if (isTopLevel && node.fullPath?.length === 0) {
            const filePathOptions: vscode.InputBoxOptions = {
                placeHolder: vscode.l10n.t({
                    message: "{0} location",
                    args: [nodeType],
                    comment: ["Node type"],
                }),
                prompt: vscode.l10n.t({
                    message: "Choose a location to create the {0}",
                    args: [nodeType],
                    comment: ["Node type"],
                }),
                value: node.tooltip as string,
            };
            filePath = await Gui.showInputBox(filePathOptions);
            node.fullPath = filePath;
        } else {
            filePath = node.fullPath;
        }

        if (filePath == null || filePath.length === 0) {
            return;
        }

        const nameOptions: vscode.InputBoxOptions = {
            placeHolder: vscode.l10n.t("Name of file or directory"),
        };
        const name = await Gui.showInputBox(nameOptions);
        if (name && filePath) {
            try {
                filePath = path.posix.join(filePath, name);
                const uri = node.resourceUri.with({
                    path: isTopLevel ? path.posix.join(node.resourceUri.path, filePath) : path.posix.join(node.resourceUri.path, name),
                });
                await ZoweExplorerApiRegister.getUssApi(node.getProfile()).create(filePath, nodeType);
                if (nodeType === "file") {
                    await vscode.workspace.fs.writeFile(uri, new Uint8Array());
                } else {
                    await vscode.workspace.fs.createDirectory(uri);
                }
                if (isTopLevel) {
                    await SharedActions.refreshProvider(ussFileProvider);
                } else {
                    ussFileProvider.refreshElement(node);
                }

                const newNode = await node.getChildren().then((children) => children.find((child) => child.label === name) as ZoweUSSNode);
                await ussFileProvider.getTreeView().reveal(node, { select: true, focus: true });
                await this.refreshDirectory(node, ussFileProvider);
                ussFileProvider.getTreeView().reveal(newNode, { select: true, focus: true });

                const equivalentNodeParent = ussFileProvider.findEquivalentNode(
                    node,
                    SharedContext.isFavorite(node) || SharedContext.isFavoriteDescendant(node)
                );
                if (equivalentNodeParent != null) {
                    ussFileProvider.refreshElement(equivalentNodeParent);
                }
            } catch (err) {
                if (err instanceof Error) {
                    await AuthUtils.errorHandling(err, {
                        apiType: ZoweExplorerApiType.Uss,
                        profile: node.getProfile(),
                        scenario: vscode.l10n.t("Unable to create node:"),
                    });
                }
                throw err;
            }
        }
    }

    public static async refreshUSSInTree(node: IZoweUSSTreeNode, ussFileProvider: Types.IZoweUSSTreeType): Promise<void> {
        ZoweLogger.trace("uss.actions.refreshUSSInTree called.");
        await ussFileProvider.refreshElement(node);
    }

    public static async refreshDirectory(node: IZoweUSSTreeNode, ussFileProvider: Types.IZoweUSSTreeType): Promise<void> {
        ZoweLogger.trace("uss.actions.refreshDirectory called.");
        try {
            await node.getChildren();
            ussFileProvider.refreshElement(node);
        } catch (err) {
            await AuthUtils.errorHandling(err, { apiType: ZoweExplorerApiType.Uss, profile: node.getProfile() });
        }
    }

    /**
     * Marks file as deleted from disk
     *
     * @param {ZoweUSSNode} node
     */
    public static deleteFromDisk(node: IZoweUSSTreeNode, filePath: string): void {
        ZoweLogger.trace("uss.actions.deleteFromDisk called.");
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (err) {
            ZoweLogger.warn(err);
        }
    }

    public static async uploadDialog(node: IZoweUSSTreeNode, ussFileProvider: Types.IZoweUSSTreeType, isBinary?: boolean): Promise<void> {
        ZoweLogger.trace("uss.actions.uploadDialog called.");
        const fileOpenOptions = {
            canSelectFiles: true,
            openLabel: "Upload Files",
            canSelectMany: true,
            defaultUri: LocalFileManagement.getDefaultUri(),
        };

        const value = await Gui.showOpenDialog(fileOpenOptions);

        if (value?.length > 0) {
            await Gui.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: vscode.l10n.t("Uploading file to USS tree"),
                    cancellable: true,
                },
                async (progress, token) => {
                    let index = 0;
                    for (const item of value) {
                        if (token.isCancellationRequested) {
                            Gui.showMessage(vscode.l10n.t("Upload action was cancelled."));
                            break;
                        }
                        Gui.reportProgress(progress, value.length, index, "Uploading");
                        const binaryFile = isBinaryFileSync(item.fsPath);
                        if (isBinary || binaryFile) {
                            await USSActions.uploadBinaryFile(node, item.fsPath);
                        } else {
                            const doc = await vscode.workspace.openTextDocument(item);
                            await USSActions.uploadFile(node, doc);
                        }
                    }
                    index++;
                }
            );
            ussFileProvider.refreshElement(node);
            ussFileProvider.getTreeView().reveal(node, { expand: true, focus: true });
        } else {
            Gui.showMessage(vscode.l10n.t("Operation cancelled"));
        }
    }

    /**
     * Prompts the user to select an encoding and then the files to upload.
     *
     * @param {ZoweUSSNode} node - The session or directory node that serves as the parent
     * @param {ussTree} ussFileProvider - USS tree provider instance
     */
    public static async uploadDialogWithEncoding(node: IZoweUSSTreeNode, ussFileProvider: Types.IZoweUSSTreeType): Promise<void> {
        ZoweLogger.trace("uss.actions.uploadDialogWithEncoding called.");

        if (!SharedContext.isUssDirectory(node)) {
            Gui.infoMessage(vscode.l10n.t("This action is only supported for USS directories."));
            return;
        }

        const profile = node.getProfile();
        const encoding = await SharedUtils.promptForUploadEncoding(profile, node.fullPath);

        if (!encoding) {
            return;
        }

        const fileOpenOptions = {
            canSelectFiles: true,
            openLabel: "Upload Files with Encoding",
            canSelectMany: true,
            defaultUri: LocalFileManagement.getDefaultUri(),
        };

        const selectedFiles = await Gui.showOpenDialog(fileOpenOptions);
        if (!selectedFiles || selectedFiles.length === 0) {
            return;
        }

        await Gui.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: vscode.l10n.t("Uploading file..."),
                cancellable: true,
            },
            async (progress, token) => {
                let index = 0;
                for (const item of selectedFiles) {
                    if (token.isCancellationRequested) {
                        break;
                    }
                    Gui.reportProgress(progress, selectedFiles.length, index, "Uploading");

                    if (encoding.kind === "binary") {
                        await USSActions.uploadBinaryFile(node, item.fsPath);
                    } else {
                        const doc = await vscode.workspace.openTextDocument(item);
                        await USSActions.uploadFileWithEncoding(node, doc, encoding);
                    }
                    index++;
                }
            }
        );
        ussFileProvider.refreshElement(node);
        ussFileProvider.getTreeView().reveal(node, { expand: true, focus: true });
    }

    public static async uploadBinaryFile(node: IZoweUSSTreeNode, filePath: string): Promise<void> {
        ZoweLogger.trace("uss.actions.uploadBinaryFile called.");
        try {
            const localFileName = path.parse(filePath).base;
            const ussName = `${node.fullPath}/${localFileName}`;
            await ZoweExplorerApiRegister.getUssApi(node.getProfile()).putContent(filePath, ussName, { binary: true });
        } catch (e) {
            await AuthUtils.errorHandling(e, { apiType: ZoweExplorerApiType.Uss, profile: node.getProfile() });
        }
    }

    public static async uploadFile(node: IZoweUSSTreeNode, doc: vscode.TextDocument): Promise<void> {
        ZoweLogger.trace("uss.actions.uploadFile called.");
        try {
            const localFileName = path.parse(doc.fileName).base;
            const ussName = `${node.fullPath}/${localFileName}`;
            const prof = node.getProfile();

            const task: imperative.ITaskWithStatus = {
                percentComplete: 0,
                statusMessage: vscode.l10n.t("Uploading USS file"),
                stageName: 0, // TaskStage.IN_PROGRESS - https://github.com/kulshekhar/ts-jest/issues/281
            };
            const options: zosfiles.IUploadOptions = {
                task,
                responseTimeout: prof.profile?.responseTimeout,
            };
            if (prof.profile.encoding) {
                options.encoding = prof.profile.encoding;
            }
            await ZoweExplorerApiRegister.getUssApi(prof).putContent(doc.fileName, ussName, options);
        } catch (e) {
            await AuthUtils.errorHandling(e, { apiType: ZoweExplorerApiType.Uss, profile: node.getProfile() });
        }
    }

    public static async uploadFileWithEncoding(node: IZoweUSSTreeNode, doc: vscode.TextDocument, encoding: ZosEncoding): Promise<void> {
        ZoweLogger.trace("uss.actions.uploadFileWithEncoding called.");
        try {
            const localFileName = path.parse(doc.fileName).base;
            const ussName = path.posix.join(node.fullPath, localFileName);
            const prof = node.getProfile();

            const task: imperative.ITaskWithStatus = {
                percentComplete: 0,
                statusMessage: vscode.l10n.t("Uploading USS file with encoding"),
                stageName: 0, // TaskStage.IN_PROGRESS - https://github.com/kulshekhar/ts-jest/issues/281
            };
            const options: zosfiles.IUploadOptions = {
                task,
                responseTimeout: prof.profile?.responseTimeout,
                binary: encoding.kind === "binary",
            };

            // Set encoding based on the user's selection
            if (encoding.kind === "other" && encoding.codepage) {
                options.encoding = encoding.codepage;
            }

            await ZoweExplorerApiRegister.getUssApi(prof).putContent(doc.fileName, ussName, options);
        } catch (e) {
            await AuthUtils.errorHandling(e, { apiType: ZoweExplorerApiType.Uss, profile: node.getProfile() });
        }
    }

    private static async getUssDirFilterOptions(currentOptions?: Definitions.UssDirFilterOptions): Promise<Definitions.UssDirFilterOptions> {
        ZoweLogger.trace("uss.actions.configureFilterOptions called.");

        const filterOptions: Definitions.UssDirFilterOptions = currentOptions ?? {};
        const quickPickItems: (vscode.QuickPickItem & { key: keyof Definitions.UssDirFilterOptions; inputType: string })[] = [
            {
                label: vscode.l10n.t("Group"),
                description: filterOptions.group
                    ? vscode.l10n.t("Filter by group owner or GID (current: {0})", filterOptions.group.toString())
                    : vscode.l10n.t("Filter by group owner or GID"),
                key: "group",
                inputType: "string",
                picked: filterOptions.group != null,
            },
            {
                label: vscode.l10n.t("User"),
                description: filterOptions.user
                    ? vscode.l10n.t("Filter by user name or UID (current: {0})", filterOptions.user.toString())
                    : vscode.l10n.t("Filter by user name or UID"),
                key: "user",
                inputType: "string",
                picked: filterOptions.user != null,
            },
            {
                label: vscode.l10n.t("Modification Time"),
                description: filterOptions.mtime
                    ? vscode.l10n.t("Filter by modification time in days (current: {0})", filterOptions.mtime.toString())
                    : vscode.l10n.t("Filter by modification time in days (e.g., +7, -1, 30)"),
                key: "mtime",
                inputType: "string",
                picked: filterOptions.mtime != null,
            },
            {
                label: vscode.l10n.t("Size"),
                description: filterOptions.size
                    ? vscode.l10n.t("Filter by file size (current: {0})", filterOptions.size.toString())
                    : vscode.l10n.t("Filter by file size (e.g., +1M, -500K, 100G)"),
                key: "size",
                inputType: "string",
                picked: filterOptions.size != null,
            },
            {
                label: vscode.l10n.t("Permissions"),
                description: filterOptions.perm
                    ? vscode.l10n.t("Filter by permission octal mask (current: {0})", filterOptions.perm)
                    : vscode.l10n.t("Filter by permission octal mask (e.g., 755, -644)"),
                key: "perm",
                inputType: "string",
                picked: filterOptions.perm != null,
            },
            {
                label: vscode.l10n.t("File Type"),
                description: filterOptions.type
                    ? vscode.l10n.t("Filter by file type (current: {0})", filterOptions.type)
                    : vscode.l10n.t("Filter by file type (c=character, d=directory, f=file, l=symlink, p=pipe, s=socket)"),
                key: "type",
                inputType: "string",
                picked: filterOptions.type != null,
            },
            {
                label: vscode.l10n.t("Depth"),
                description:
                    filterOptions.depth != null
                        ? vscode.l10n.t("Directory depth to search (current: {0})", filterOptions.depth.toString())
                        : vscode.l10n.t("Directory depth to search (number of levels)"),
                key: "depth",
                inputType: "number",
                picked: filterOptions.depth != null,
            },
        ];

        const filterQuickPick = Gui.createQuickPick();
        filterQuickPick.title = vscode.l10n.t("Configure Filter Options");
        filterQuickPick.placeholder = vscode.l10n.t("Select filters to configure");
        filterQuickPick.ignoreFocusOut = true;
        filterQuickPick.canSelectMany = true;
        filterQuickPick.items = quickPickItems;
        filterQuickPick.selectedItems = quickPickItems.filter((item) => item.picked);

        const selectedFilters: typeof quickPickItems = await new Promise((resolve) => {
            let wasAccepted = false;

            filterQuickPick.onDidAccept(() => {
                wasAccepted = true;
                resolve(Array.from(filterQuickPick.selectedItems) as typeof quickPickItems);
                filterQuickPick.hide();
            });

            filterQuickPick.onDidHide(() => {
                if (!wasAccepted) {
                    resolve(null);
                }
            });

            filterQuickPick.show();
        });
        filterQuickPick.dispose();

        if (selectedFilters === null) {
            return null;
        }

        const newFilterOptions: Definitions.UssDirFilterOptions = {};
        for (const filter of selectedFilters) {
            const currentValue = filterOptions[filter.key];
            let prompt: string;
            let placeholder: string;

            switch (filter.key) {
                case "group":
                    prompt = vscode.l10n.t("Enter group owner or GID");
                    placeholder = vscode.l10n.t("e.g., admin or 100");
                    break;
                case "user":
                    prompt = vscode.l10n.t("Enter user name or UID");
                    placeholder = vscode.l10n.t("e.g., IBMUSER or 1001");
                    break;
                case "mtime":
                    prompt = vscode.l10n.t("Enter modification time filter");
                    placeholder = vscode.l10n.t("e.g., +7 (older than 7 days), -1 (newer than 1 day), 30 (exactly 30 days)");
                    break;
                case "size":
                    prompt = vscode.l10n.t("Enter size filter");
                    placeholder = vscode.l10n.t("e.g., +1M (larger than 1MB), -500K (smaller than 500KB), 100G");
                    break;
                case "perm":
                    prompt = vscode.l10n.t("Enter permission octal mask");
                    placeholder = vscode.l10n.t("e.g., 755, -644 (not 644)");
                    break;
                case "type":
                    prompt = vscode.l10n.t("Enter file type");
                    placeholder = vscode.l10n.t("c, d, f, l, p, or s");
                    break;
                case "depth":
                    prompt = vscode.l10n.t("Enter directory depth");
                    placeholder = vscode.l10n.t("e.g., 2 (search 2 levels deep)");
                    break;
            }

            const inputValue = await Gui.showInputBox({
                prompt,
                placeHolder: placeholder,
                value: currentValue?.toString() || "",
                validateInput: (value) => {
                    if (!value.trim()) {
                        return vscode.l10n.t("Value cannot be empty");
                    }
                    if (filter.inputType === "number" && isNaN(parseInt(value))) {
                        return vscode.l10n.t("Must be a valid number");
                    }
                    return null;
                },
            });

            if (inputValue != null && inputValue.trim()) {
                if (filter.inputType === "number") {
                    (newFilterOptions as any)[filter.key] = parseInt(inputValue);
                } else {
                    (newFilterOptions as any)[filter.key] = inputValue.trim();
                }
            }
        }

        return newFilterOptions;
    }

    private static async getUssDownloadOptions(node: IZoweUSSTreeNode, isDirectory: boolean = false): Promise<Definitions.UssDownloadOptions> {
        const downloadOpts: Definitions.UssDownloadOptions =
            ZoweLocalStorage.getValue<Definitions.UssDownloadOptions>(Definitions.LocalStorageKey.USS_DOWNLOAD_OPTIONS) ?? {};

        downloadOpts.overwrite ??= false;
        downloadOpts.generateDirectory ??= false;
        downloadOpts.chooseEncoding ??= false;
        downloadOpts.selectedPath ??= LocalFileManagement.getDefaultUri();
        downloadOpts.dirOptions ??= {};
        downloadOpts.dirOptions.includeHidden ??= false;
        downloadOpts.dirOptions.chooseFilterOptions ??= false;
        downloadOpts.dirOptions.filesys ??= false;
        downloadOpts.dirOptions.symlinks ??= false;
        downloadOpts.dirFilterOptions ??= {};

        if (downloadOpts.encoding && USSUtils.zosEncodingToString(downloadOpts.encoding) == "text") {
            downloadOpts.encoding = undefined;
        }

        const getEncodingDescription = (): string => {
            if (isDirectory) {
                const currentEncoding = downloadOpts.dirOptions.directoryEncoding;
                if (!currentEncoding || currentEncoding === "auto-detect") {
                    return vscode.l10n.t("Select default encoding for directory files (current: Auto-detect from file tags)");
                }

                const encodingName =
                    currentEncoding.kind === "binary" ? "binary" : currentEncoding.kind === "other" ? currentEncoding.codepage : "EBCDIC";

                return vscode.l10n.t("Select default encoding for directory files (current: {0})", encodingName);
            } else {
                if (!downloadOpts.encoding) {
                    return vscode.l10n.t("Select specific encoding for file");
                }

                const encodingName =
                    downloadOpts.encoding.kind === "binary"
                        ? "binary"
                        : downloadOpts.encoding.kind === "other"
                        ? downloadOpts.encoding.codepage
                        : "EBCDIC";

                return vscode.l10n.t("Select specific encoding for file (current: {0})", encodingName);
            }
        };

        const optionItems: vscode.QuickPickItem[] = [
            {
                label: vscode.l10n.t("Overwrite"),
                description: isDirectory
                    ? vscode.l10n.t("Overwrite existing files when downloading directories")
                    : vscode.l10n.t("Overwrite existing file"),
                picked: downloadOpts.overwrite,
            },
            {
                label: vscode.l10n.t("Generate Directory Structure"),
                description: vscode.l10n.t("Generates sub-folders based on the USS path"),
                picked: downloadOpts.generateDirectory,
            },
        ];

        // Add directory-specific options only when downloading directories
        if (isDirectory) {
            optionItems.push(
                {
                    label: vscode.l10n.t("Include Hidden Files"),
                    description: vscode.l10n.t("Include hidden files when downloading directories"),
                    picked: downloadOpts.dirOptions.includeHidden,
                },
                {
                    label: vscode.l10n.t("Search All Filesystems"),
                    description: vscode.l10n.t("Search all mounted filesystems under the path"),
                    picked: downloadOpts.dirOptions.filesys,
                },
                {
                    label: vscode.l10n.t("Return Symlinks"),
                    description: vscode.l10n.t("Return symbolic links instead of following them"),
                    picked: downloadOpts.dirOptions.symlinks,
                },
                {
                    label: vscode.l10n.t("Apply Filter Options"),
                    description:
                        downloadOpts.dirFilterOptions && Object.keys(downloadOpts.dirFilterOptions).length > 0
                            ? vscode.l10n.t("Configure and apply file filtering options (currently configured)")
                            : vscode.l10n.t("Configure and apply file filtering options"),
                    picked: downloadOpts.dirOptions.chooseFilterOptions,
                }
            );
        }

        // Put this here because it should be at the bottom of the quick pick for both files and directories
        optionItems.push({
            label: vscode.l10n.t("Choose Encoding"),
            description: getEncodingDescription(),
            picked: downloadOpts.chooseEncoding,
        });

        const optionsQuickPick = Gui.createQuickPick();
        optionsQuickPick.title = vscode.l10n.t("Download Options");
        optionsQuickPick.placeholder = vscode.l10n.t("Select download options");
        optionsQuickPick.ignoreFocusOut = true;
        optionsQuickPick.canSelectMany = true;
        optionsQuickPick.items = optionItems;
        optionsQuickPick.selectedItems = optionItems.filter((item) => item.picked);

        const selectedOptions: vscode.QuickPickItem[] = await new Promise((resolve) => {
            let wasAccepted = false;

            optionsQuickPick.onDidAccept(() => {
                wasAccepted = true;
                resolve(Array.from(optionsQuickPick.selectedItems));
                optionsQuickPick.hide();
            });

            optionsQuickPick.onDidHide(() => {
                if (!wasAccepted) {
                    resolve(null);
                }
            });

            optionsQuickPick.show();
        });
        optionsQuickPick.dispose();

        // Do this instead of checking for length because unchecking all options is a valid choice
        if (selectedOptions === null) {
            return;
        }

        const localizedLabels = {
            overwrite: vscode.l10n.t("Overwrite"),
            generateDirectory: vscode.l10n.t("Generate Directory Structure"),
            chooseEncoding: vscode.l10n.t("Choose Encoding"),
            includeHidden: vscode.l10n.t("Include Hidden Files"),
            searchAllFilesystems: vscode.l10n.t("Search All Filesystems"),
            returnSymlinks: vscode.l10n.t("Return Symlinks"),
            applyFilterOptions: vscode.l10n.t("Apply Filter Options"),
        };

        const getOption = (localizedLabel: string): boolean => selectedOptions.some((opt) => opt.label === localizedLabel);
        downloadOpts.overwrite = getOption(localizedLabels.overwrite);
        downloadOpts.generateDirectory = getOption(localizedLabels.generateDirectory);
        downloadOpts.chooseEncoding = getOption(localizedLabels.chooseEncoding);

        // Only set directory-specific options when downloading directories
        if (isDirectory) {
            downloadOpts.dirOptions.includeHidden = getOption(localizedLabels.includeHidden);
            downloadOpts.dirOptions.filesys = getOption(localizedLabels.searchAllFilesystems);
            downloadOpts.dirOptions.symlinks = getOption(localizedLabels.returnSymlinks);
            downloadOpts.dirOptions.chooseFilterOptions = getOption(localizedLabels.applyFilterOptions);

            if (getOption(localizedLabels.applyFilterOptions)) {
                const filterOptions = await USSActions.getUssDirFilterOptions(downloadOpts.dirFilterOptions);
                if (filterOptions && Object.keys(filterOptions).length > 0) {
                    downloadOpts.dirFilterOptions = filterOptions;
                }
            }
        }

        if (downloadOpts.chooseEncoding) {
            if (isDirectory) {
                const profile = node.getProfile();

                downloadOpts.dirOptions.directoryEncoding = await SharedUtils.promptForDirectoryEncoding(
                    profile,
                    node.fullPath,
                    downloadOpts.dirOptions.directoryEncoding
                );

                if (downloadOpts.dirOptions.directoryEncoding === undefined) {
                    return;
                }
            } else {
                const ussApi = ZoweExplorerApiRegister.getUssApi(node.getProfile());
                let taggedEncoding: string;

                if (ussApi.getTag != null) {
                    taggedEncoding = await ussApi.getTag(node.fullPath);
                }

                downloadOpts.encoding = await SharedUtils.promptForEncoding(node, taggedEncoding !== "untagged" ? taggedEncoding : undefined);
                if (downloadOpts.encoding === undefined) {
                    return;
                }
            }
        }

        const dialogOptions: vscode.OpenDialogOptions = {
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: vscode.l10n.t("Select Download Location"),
            defaultUri: downloadOpts.selectedPath,
        };

        const downloadPath = await Gui.showOpenDialog(dialogOptions);
        if (!downloadPath || downloadPath.length === 0) {
            return;
        }

        const selectedPath = downloadPath[0].fsPath;
        downloadOpts.selectedPath = vscode.Uri.file(selectedPath);
        await ZoweLocalStorage.setValue<Definitions.UssDownloadOptions>(Definitions.LocalStorageKey.USS_DOWNLOAD_OPTIONS, downloadOpts);

        return downloadOpts;
    }

    public static async downloadUssFile(node: IZoweUSSTreeNode): Promise<void> {
        ZoweLogger.trace("uss.actions.downloadUssFile called.");

        const profile = node.getProfile();

        const downloadOptions = await USSActions.getUssDownloadOptions(node);
        if (!downloadOptions) {
            Gui.showMessage(vscode.l10n.t("Operation cancelled"));
            return;
        }

        await Gui.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: vscode.l10n.t("Downloading USS file..."),
                cancellable: true,
            },
            async () => {
                const filePath = downloadOptions.generateDirectory
                    ? path.join(downloadOptions.selectedPath.fsPath, node.fullPath)
                    : path.join(downloadOptions.selectedPath.fsPath, path.basename(node.fullPath));

                const options: zosfiles.IDownloadSingleOptions = {
                    file: filePath,
                    binary: downloadOptions.encoding?.kind === "binary",
                    encoding: downloadOptions.encoding?.kind === "other" ? downloadOptions.encoding.codepage : profile.profile?.encoding,
                    overwrite: downloadOptions.overwrite,
                };

                try {
                    const response = await ZoweExplorerApiRegister.getUssApi(profile).getContents(node.fullPath, options);
                    void SharedUtils.handleDownloadResponse(response, vscode.l10n.t("USS file"), filePath);
                } catch (e) {
                    await AuthUtils.errorHandling(e, { apiType: ZoweExplorerApiType.Uss, profile });
                }
            }
        );
    }

    public static async downloadUssDirectory(node: IZoweUSSTreeNode): Promise<void> {
        ZoweLogger.trace("uss.actions.downloadUssDirectory called.");

        const profile = node.getProfile();

        const ussApi = ZoweExplorerApiRegister.getUssApi(profile);
        if (!ussApi.downloadDirectory) {
            Gui.errorMessage(
                vscode.l10n.t("The downloadDirectory API is not supported for this profile type. Please contact the extension developer.")
            );
            return;
        }

        const downloadOptions = await USSActions.getUssDownloadOptions(node, true);
        if (!downloadOptions) {
            Gui.showMessage(vscode.l10n.t("Operation cancelled"));
            return;
        }

        let totalFileCount = 0;
        try {
            const countListOptions: zosfiles.IUSSListOptions = {
                ...(downloadOptions.dirOptions.chooseFilterOptions ? downloadOptions.dirFilterOptions : {}),
                type: "f",
                filesys: downloadOptions.dirOptions.filesys,
                symlinks: downloadOptions.dirOptions.symlinks,
            };
            const listResponse = await ZoweExplorerApiRegister.getUssApi(profile).fileList(node.fullPath, countListOptions);
            if (listResponse?.apiResponse?.items) {
                totalFileCount = listResponse.apiResponse.items.length;
            }
        } catch (e) {
            await AuthUtils.errorHandling(e, {
                apiType: ZoweExplorerApiType.Uss,
                profile,
                scenario: vscode.l10n.t("Unable to find USS directory contents:"),
            });
            return;
        }

        if (totalFileCount === 0) {
            Gui.infoMessage(vscode.l10n.t("The selected directory contains no files to download."));
            return;
        }

        if (totalFileCount > Constants.MIN_WARN_DOWNLOAD_FILES) {
            const proceed = await Gui.showMessage(
                vscode.l10n.t(
                    "This directory has {0} members. Downloading a large number of files may take a long time. Do you want to continue?",
                    totalFileCount
                ),
                { severity: MessageSeverity.WARN, items: [vscode.l10n.t("Yes"), vscode.l10n.t("No")], vsCodeOpts: { modal: true } }
            );
            if (proceed !== vscode.l10n.t("Yes")) {
                return;
            }
        }

        await Gui.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: vscode.l10n.t("Downloading USS directory"),
                cancellable: true,
            },
            async (progress, token) => {
                let realPercentComplete = 0;
                const realTotalEntries = totalFileCount;
                const task: imperative.ITaskWithStatus = {
                    set percentComplete(value: number) {
                        realPercentComplete = value;
                        // eslint-disable-next-line no-magic-numbers
                        Gui.reportProgress(progress, realTotalEntries, Math.floor((value * realTotalEntries) / 100), "");
                    },
                    get percentComplete(): number {
                        return realPercentComplete;
                    },
                    statusMessage: "",
                    stageName: 0, // TaskStage.IN_PROGRESS
                };

                const directoryPath = downloadOptions.generateDirectory
                    ? path.join(downloadOptions.selectedPath.fsPath, node.fullPath)
                    : path.join(downloadOptions.selectedPath.fsPath, path.basename(node.fullPath));

                const options: zosfiles.IDownloadOptions = {
                    directory: directoryPath,
                    overwrite: downloadOptions.overwrite,
                    includeHidden: downloadOptions.dirOptions.includeHidden,
                    maxConcurrentRequests: profile?.profile?.maxConcurrentRequests || 1,
                    task,
                    responseTimeout: profile?.profile?.responseTimeout,
                };

                // only set encoding/binary if user chose a specific encoding (not auto detect)
                if (downloadOptions.dirOptions.directoryEncoding && downloadOptions.dirOptions.directoryEncoding !== "auto-detect") {
                    options.binary = downloadOptions.dirOptions.directoryEncoding.kind === "binary";
                    options.encoding =
                        downloadOptions.dirOptions.directoryEncoding.kind === "other"
                            ? downloadOptions.dirOptions.directoryEncoding.codepage
                            : profile.profile?.encoding;
                }

                // only apply filter options if chooseFilterOptions is enabled
                const filterOpts = downloadOptions.dirOptions.chooseFilterOptions ? downloadOptions.dirFilterOptions : {};
                const listOptions: zosfiles.IUSSListOptions = {
                    ...filterOpts,
                    type: filterOpts.type ?? "f", // fallback to files only
                    filesys: downloadOptions.dirOptions.filesys,
                    symlinks: downloadOptions.dirOptions.symlinks,
                };

                try {
                    if (token.isCancellationRequested) {
                        Gui.showMessage(vscode.l10n.t("Download cancelled"));
                        return;
                    }

                    const response = await ussApi.downloadDirectory(node.fullPath, options, listOptions);
                    void SharedUtils.handleDownloadResponse(response, vscode.l10n.t("USS directory"), directoryPath);
                } catch (e) {
                    await AuthUtils.errorHandling(e, { apiType: ZoweExplorerApiType.Uss, profile });
                }
            }
        );
    }

    public static editAttributes(context: vscode.ExtensionContext, fileProvider: Types.IZoweUSSTreeType, node: IZoweUSSTreeNode): USSAttributeView {
        return new USSAttributeView(context, fileProvider, node);
    }

    /**
     * Copies full path for the selected Zowe USS node
     *
     * @param {ZoweUSSNode} node
     */
    public static copyPath(node: IZoweUSSTreeNode): void {
        ZoweLogger.trace("uss.actions.copyPath called.");
        vscode.env.clipboard.writeText(node.fullPath);
    }

    public static async deleteUSSFilesPrompt(
        node: IZoweUSSTreeNode,
        nodeList: IZoweUSSTreeNode[],
        ussFileProvider: Types.IZoweUSSTreeType
    ): Promise<void> {
        ZoweLogger.trace("uss.actions.deleteUSSFilesPrompt called.");
        let selectedNodes;
        if (node || nodeList) {
            selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList) as IZoweUSSTreeNode[];
        } else {
            selectedNodes = ussFileProvider.getTreeView().selection;
        }
        selectedNodes = selectedNodes.filter((x) => SharedContext.isDocument(x) || SharedContext.isUssDirectory(x) || SharedContext.isBinary(x));
        const fileNames = selectedNodes.map(({ label }) => label.toString());
        const displayedFileNames = fileNames.slice(0, Constants.MAX_DISPLAYED_DELETE_NAMES).join("\n");
        const additionalFilesCount = fileNames.length - Constants.MAX_DISPLAYED_DELETE_NAMES;
        const message = vscode.l10n.t({
            message:
                "Are you sure you want to delete the following item?\n" +
                "This will permanently remove the following file or folder from your system.\n\n{0}{1}",
            args: [displayedFileNames, additionalFilesCount > 0 ? `\n...and ${additionalFilesCount} more` : ""],
            comment: ["File names", "Additional files count"],
        });
        const deleteButton = vscode.l10n.t("Delete");
        let cancelled = false;
        await Gui.warningMessage(message, {
            items: [deleteButton],
            vsCodeOpts: { modal: true },
        }).then((selection) => {
            if (!selection || selection === "Cancel") {
                ZoweLogger.debug(vscode.l10n.t("Delete action was canceled."));
                cancelled = true;
            }
        });
        for (const item of selectedNodes) {
            await item.deleteUSSNode(ussFileProvider, "", cancelled);
        }
    }

    /**
     * Builds a file/directory structure that can be traversed from root to the innermost children.
     *
     * @param node Build a tree structure starting at this node
     * @returns A tree structure containing all files/directories within this node
     */
    public static async buildFileStructure(node: IZoweUSSTreeNode): Promise<USSFileStructure.UssFileTree> {
        ZoweLogger.trace("uss.actions.buildFileStructure called.");
        if (SharedContext.isUssDirectory(node)) {
            const directory: USSFileStructure.UssFileTree = {
                localUri: node.resourceUri,
                ussPath: node.fullPath,
                baseName: node.getLabel() as string,
                sessionName: node.getSessionNode().getLabel() as string,
                type: USSFileStructure.UssFileType.Directory,
                children: [],
            };

            const children = await node.getChildren();
            if (children != null && children.length > 0) {
                for (const child of children) {
                    // This node is either another directory or a file
                    const subnode = await USSActions.buildFileStructure(child);
                    directory.children.push(subnode);
                }
            }

            return directory;
        }

        return {
            binary: (await node.getEncoding())?.kind === "binary",
            localUri: node.resourceUri,
            ussPath: node.fullPath,
            baseName: node.getLabel() as string,
            sessionName: node.getSessionNode().getLabel() as string,
            type: USSFileStructure.UssFileType.File,
        };
    }

    /**
     * Collects USS file info and builds a tree used for copying and pasting files/folders.
     *
     * @param selectedNodes The list of USS tree nodes that were selected for copying.
     * @returns A file tree containing the USS file/directory paths to be pasted.
     */
    public static async ussFileStructure(selectedNodes: IZoweUSSTreeNode[]): Promise<USSFileStructure.UssFileTree> {
        ZoweLogger.trace("uss.actions.ussFileStructure called.");
        const rootStructure: USSFileStructure.UssFileTree = {
            ussPath: "",
            type: USSFileStructure.UssFileType.Directory,
            children: [],
        };

        for (const node of selectedNodes) {
            rootStructure.children.push(await USSActions.buildFileStructure(node));
        }

        return rootStructure;
    }

    /**
     * Helper function for `copyUssFiles` that will copy the USS file structure to a JSON
     * object, saving it into a clipboard for future use.
     *
     * @param selectedNodes The list of USS tree nodes that were selected for copying.
     */
    public static async copyUssFilesToClipboard(selectedNodes: IZoweUSSTreeNode[]): Promise<void> {
        ZoweLogger.trace("uss.actions.copyUssFilesToClipboard called.");
        const filePaths = await USSActions.ussFileStructure(selectedNodes);
        vscode.env.clipboard.writeText(JSON.stringify(filePaths));
    }

    public static async copyUssFiles(node: IZoweUSSTreeNode, nodeList: IZoweUSSTreeNode[], ussFileProvider: Types.IZoweUSSTreeType): Promise<void> {
        ZoweLogger.trace("uss.actions.copyUssFiles called.");
        let selectedNodes;
        if (node || nodeList) {
            selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList) as IZoweUSSTreeNode[];
        } else {
            selectedNodes = ussFileProvider.getTreeView().selection;
        }
        await Gui.withProgress(
            {
                location: vscode.ProgressLocation.Window,
                title: vscode.l10n.t("Copying file structure..."),
            },
            () => {
                return USSActions.copyUssFilesToClipboard(selectedNodes);
            }
        );
    }

    public static async refreshChildNodesDirectory(node: IZoweUSSTreeNode): Promise<void> {
        ZoweLogger.trace("uss.actions.refreshChildNodesDirectory called.");
        const childNodes = await node.getChildren();
        if (childNodes != null && childNodes.length > 0) {
            for (const child of childNodes) {
                await USSActions.refreshChildNodesDirectory(child);
            }
        } else {
            if (node.contextValue !== Constants.USS_DIR_CONTEXT) {
                await node.refreshUSS();
            }
        }
    }

    /**
     * Paste copied USS nodes into the selected node.
     * @param ussFileProvider File provider for USS tree
     * @param node The node to paste within
     */
    public static async pasteUss(ussFileProvider: Types.IZoweUSSTreeType, node: IZoweUSSTreeNode): Promise<void> {
        ZoweLogger.trace("uss.actions.pasteUss called.");
        if (node.pasteUssTree == null) {
            await Gui.infoMessage(vscode.l10n.t("The paste operation is not supported for this node."));
            return;
        }
        await Gui.withProgress(
            {
                location: vscode.ProgressLocation.Window,
                title: vscode.l10n.t("Pasting files..."),
            },
            async () => {
                await node.pasteUssTree();
            }
        );
        ussFileProvider.refreshElement(node);
    }

    public static async copyRelativePath(node: IZoweUSSTreeNode): Promise<void> {
        const sesNode = node.getSessionNode();
        if (!node.fullPath) {
            ZoweLogger.warn(
                vscode.l10n.t({
                    message: "copyName was called on USS node {0}, but its fullPath is invalid.",
                    args: [node.label as string],
                    comment: "USS node label",
                })
            );
            return;
        }

        if (sesNode != null && !SharedContext.isFavorite(sesNode)) {
            let relPath = node.fullPath.replace(sesNode.fullPath, "");
            if (relPath.startsWith("/")) {
                relPath = relPath.slice(1);
            }
            await vscode.env.clipboard.writeText(relPath);
        } else {
            await vscode.env.clipboard.writeText(node.fullPath);
        }
    }

    /**
     * Prompts user for profile name and USS path, then filters the tree by that path
     */
    public static async filterUssTreePrompt(ussFileProvider: Types.IZoweUSSTreeType): Promise<void> {
        ZoweLogger.trace("uss.actions.filterUssTreePrompt called.");
        const profileNames = ProfileManagement.getRegisteredProfileNameList(Definitions.Trees.USS);

        if (profileNames.length === 0) {
            await Gui.errorMessage(vscode.l10n.t("No USS profiles found. Please add a profile first."));
            return;
        }

        const quickPick = vscode.window.createQuickPick();
        quickPick.placeholder = vscode.l10n.t("Select a profile");
        quickPick.ignoreFocusOut = true;
        quickPick.items = profileNames.map((name) => ({ label: name }));

        let selectedProfile: string | undefined;

        const profilePromise = new Promise<string | undefined>((resolve) => {
            quickPick.onDidAccept(() => {
                const selection = quickPick.activeItems[0];
                if (selection) {
                    selectedProfile = selection.label;
                } else if (quickPick.value) {
                    selectedProfile = quickPick.value;
                }
                quickPick.hide();
                resolve(selectedProfile);
            });

            quickPick.onDidHide(() => {
                resolve(undefined);
            });

            quickPick.show();
        });

        selectedProfile = (await profilePromise)?.trim();
        quickPick.dispose();

        if (!selectedProfile || selectedProfile.length === 0) {
            return;
        }

        const ussPath = await Gui.showInputBox({
            prompt: vscode.l10n.t("Enter the USS path to filter on"),
            placeHolder: vscode.l10n.t("/u/username/directory"),
            value: "",
            ignoreFocusOut: true,
            validateInput: (input) => USSActions.validatePath(input),
        });

        if (!ussPath) {
            return;
        }
        try {
            await USSActions.filterUssTree(ussFileProvider, selectedProfile, ussPath.trim());
        } catch (e) {
            if (e instanceof Error) {
                await Gui.errorMessage(
                    vscode.l10n.t({
                        message: "Failed to filter USS tree: {0}",
                        args: [e.message],
                        comment: ["Error message"],
                    })
                );
            }
        }
    }
    private static validatePath(input: string): string | vscode.InputBoxValidationMessage | undefined {
        const trimmedInput = input?.trim();

        if (!trimmedInput || trimmedInput.length === 0) {
            return vscode.l10n.t("USS path cannot be empty");
        }

        if (!trimmedInput.startsWith("/")) {
            return vscode.l10n.t("USS path must start with /");
        }

        return undefined;
    }

    /**
     * Filter the USS tree by the specified path
     * @param ussFileProvider is a USS tree
     * @param sessionName is a profile name to use in the USS tree
     * @param ussPath is a USS path to filter by
     */
    public static async filterUssTree(ussFileProvider: Types.IZoweUSSTreeType, sessionName: string, ussPath: string): Promise<void> {
        ZoweLogger.trace("uss.actions.filterUssTree called.");
        let sessionNode: IZoweUSSTreeNode | undefined = ussFileProvider.mSessionNodes.find(
            (ussNode) => ussNode.label.toString() === sessionName.trim()
        ) as IZoweUSSTreeNode;
        if (!sessionNode) {
            try {
                await ussFileProvider.addSession({ sessionName: sessionName.trim() });
            } catch (error) {
                await AuthUtils.errorHandling(error, { apiType: ZoweExplorerApiType.Uss, profile: sessionName });
                return;
            }
            sessionNode = ussFileProvider.mSessionNodes.find((ussNode) => ussNode.label.toString() === sessionName.trim()) as IZoweUSSTreeNode;
        }

        // Clear any existing children to avoid conflicts with cached entries
        sessionNode.children = [];

        let targetPath = ussPath;
        let targetFileName: string | null = null;

        try {
            const profile = sessionNode.getProfile();
            const response = await ZoweExplorerApiRegister.getUssApi(profile).fileList(ussPath);

            // we get 3 entries for a directory like ., .., and directory itself with mode d
            //For a file there will be single entry
            if (response.success && response.apiResponse?.items?.length === 1) {
                const item = response.apiResponse.items[0];
                if (item.mode && !item.mode.startsWith("d")) {
                    targetFileName = path.posix.basename(ussPath);
                    targetPath = path.posix.dirname(ussPath);
                    ZoweLogger.trace(`Detected file path, filtering to parent directory: ${targetPath}`);
                }
            }
        } catch (err) {
            ZoweLogger.trace(`Could not determine if path is file or directory, treating as directory: ${err}`);
        }

        sessionNode.fullPath = targetPath;
        sessionNode.tooltip = targetPath;
        sessionNode.description = targetPath;
        if (!SharedContext.isFilterFolder(sessionNode)) {
            sessionNode.contextValue += `_${Constants.FILTER_SEARCH}`;
        }
        sessionNode.dirty = true;

        try {
            await sessionNode.getChildren();
            ussFileProvider.nodeDataChanged(sessionNode);
            await ussFileProvider.getTreeView().reveal(sessionNode, { select: true, focus: true, expand: true });

            if (targetFileName) {
                const fileNode = sessionNode.children.find((child) => child.label === targetFileName);
                if (fileNode) {
                    try {
                        await ussFileProvider.getTreeView().reveal(fileNode, { select: true, focus: true });
                    } catch (err) {
                        ZoweLogger.trace(`Could not reveal node: ${err}`);
                        await Gui.errorMessage(
                            vscode.l10n.t({
                                message: "Failed to reveal '{0}': {1}",
                                args: [targetFileName, err instanceof Error ? err.message : String(err)],
                                comment: ["Item name", "Error message"],
                            })
                        );
                    }
                } else {
                    await Gui.warningMessage(
                        vscode.l10n.t({
                            message: "'{0}' not found in directory '{1}'",
                            args: [targetFileName, targetPath],
                            comment: ["Item name", "Directory path"],
                        })
                    );
                }
            }
        } catch (error) {
            await AuthUtils.errorHandling(error, { apiType: ZoweExplorerApiType.Uss, profile: sessionName });
            return;
        }
    }
}
