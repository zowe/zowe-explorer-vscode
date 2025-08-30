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

    private static async getUssDownloadOptions(node: IZoweUSSTreeNode, isDirectory: boolean = false): Promise<Definitions.UssDownloadOptions> {
        const ussDownloadOptions: Definitions.UssDownloadOptions =
            ZoweLocalStorage.getValue<Definitions.UssDownloadOptions>(Definitions.LocalStorageKey.USS_DOWNLOAD_OPTIONS) ?? {};

        ussDownloadOptions.overwrite ??= false;
        ussDownloadOptions.generateDirectory ??= false;
        ussDownloadOptions.includeHidden ??= false;
        ussDownloadOptions.chooseEncoding ??= false;
        ussDownloadOptions.selectedPath ??= LocalFileManagement.getDefaultUri();

        if (USSUtils.zosEncodingToString(ussDownloadOptions.encoding) == "text") {
            ussDownloadOptions.encoding = undefined;
        }

        const optionItems: vscode.QuickPickItem[] = [
            {
                label: vscode.l10n.t("Generate Directory Structure"),
                description: vscode.l10n.t("Generates sub-folders based on the USS path"),
                picked: ussDownloadOptions.generateDirectory,
            },
            {
                label: vscode.l10n.t("Choose Encoding"),
                description: ussDownloadOptions.encoding
                    ? vscode.l10n.t({
                          message: "Select specific encoding for files (current: {0})",
                          args: [
                              ussDownloadOptions.encoding.kind === "binary"
                                  ? "binary"
                                  : ussDownloadOptions.encoding.kind === "other"
                                  ? ussDownloadOptions.encoding.codepage
                                  : "default",
                          ],
                          comment: ["Encoding kind or codepage"],
                      })
                    : vscode.l10n.t("Select specific encoding for files"),
                picked: ussDownloadOptions.chooseEncoding,
            },
        ];

        // Add directory-specific options only when downloading directories
        if (isDirectory) {
            optionItems.splice(
                0,
                0,
                {
                    label: vscode.l10n.t("Overwrite"),
                    description: vscode.l10n.t("Overwrite existing files when downloading directories"),
                    picked: ussDownloadOptions.overwrite,
                },
                {
                    label: vscode.l10n.t("Include Hidden Files"),
                    description: vscode.l10n.t("Include hidden files (those starting with a dot) when downloading directories"),
                    picked: ussDownloadOptions.includeHidden,
                }
            );
        }

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

        const getOption = (label: string): boolean => selectedOptions.some((opt) => opt.label === vscode.l10n.t(label));
        ussDownloadOptions.generateDirectory = getOption("Generate Directory Structure");
        ussDownloadOptions.chooseEncoding = getOption("Choose Encoding");

        // Only set directory-specific options when downloading directories
        if (isDirectory) {
            ussDownloadOptions.overwrite = getOption("Overwrite");
            ussDownloadOptions.includeHidden = getOption("Include Hidden Files");
        }

        if (ussDownloadOptions.chooseEncoding) {
            const ussApi = ZoweExplorerApiRegister.getUssApi(node.getProfile());
            let taggedEncoding: string;

            // Only get tagged encoding for files, not directories
            if (ussApi.getTag != null && !isDirectory) {
                taggedEncoding = await ussApi.getTag(node.fullPath);
            }

            ussDownloadOptions.encoding = await SharedUtils.promptForEncoding(node, taggedEncoding !== "untagged" ? taggedEncoding : undefined);
            if (!ussDownloadOptions.encoding) {
                return;
            }
        }

        const dialogOptions: vscode.OpenDialogOptions = {
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: vscode.l10n.t("Select Download Location"),
            defaultUri: ussDownloadOptions.selectedPath,
        };

        const downloadPath = await Gui.showOpenDialog(dialogOptions);
        if (!downloadPath || downloadPath.length === 0) {
            return;
        }

        const selectedPath = downloadPath[0].fsPath;
        ussDownloadOptions.selectedPath = vscode.Uri.file(selectedPath);
        await ZoweLocalStorage.setValue<Definitions.UssDownloadOptions>(Definitions.LocalStorageKey.USS_DOWNLOAD_OPTIONS, ussDownloadOptions);

        return ussDownloadOptions;
    }

    public static async downloadUssFile(node: IZoweUSSTreeNode): Promise<void> {
        ZoweLogger.trace("uss.actions.downloadUssFile called.");

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
                const options: zosfiles.IDownloadSingleOptions = {
                    file: downloadOptions.generateDirectory
                        ? path.join(downloadOptions.selectedPath.fsPath, node.fullPath)
                        : path.join(downloadOptions.selectedPath.fsPath, path.basename(node.fullPath)),
                    binary: downloadOptions.encoding?.kind === "binary",
                    encoding: downloadOptions.encoding?.kind === "other" ? downloadOptions.encoding.codepage : undefined,
                };

                try {
                    await zosfiles.Download.ussFile(node.getSession(), node.fullPath, options);
                    Gui.showMessage(vscode.l10n.t("File downloaded successfully"));
                } catch (e) {
                    await AuthUtils.errorHandling(e, { apiType: ZoweExplorerApiType.Uss, profile: node.getProfile() });
                }
            }
        );
    }

    public static async downloadUssDirectory(node: IZoweUSSTreeNode): Promise<void> {
        ZoweLogger.trace("uss.actions.downloadUssDirectory called.");

        const downloadOptions = await USSActions.getUssDownloadOptions(node, true);
        if (!downloadOptions) {
            Gui.showMessage(vscode.l10n.t("Operation cancelled"));
            return;
        }

        const totalFileCount = await USSUtils.countAllFilesRecursively(node);
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

                const options: zosfiles.IDownloadOptions = {
                    directory: downloadOptions.generateDirectory
                        ? path.join(downloadOptions.selectedPath.fsPath, node.fullPath)
                        : downloadOptions.selectedPath.fsPath,
                    overwrite: downloadOptions.overwrite,
                    binary: downloadOptions.encoding?.kind === "binary",
                    encoding: downloadOptions.encoding?.kind === "other" ? downloadOptions.encoding.codepage : undefined,
                    includeHidden: downloadOptions.includeHidden,
                    maxConcurrentRequests: node.getProfile()?.profile?.maxConcurrentRequests || 1,
                    task,
                    responseTimeout: node.getProfile()?.profile?.responseTimeout,
                };

                try {
                    if (token.isCancellationRequested) {
                        Gui.showMessage(vscode.l10n.t("Download cancelled"));
                        return;
                    }

                    await zosfiles.Download.ussDir(node.getSession(), node.fullPath, options);

                    Gui.showMessage(vscode.l10n.t("Directory downloaded successfully"));
                } catch (e) {
                    await AuthUtils.errorHandling(e, { apiType: ZoweExplorerApiType.Uss, profile: node.getProfile() });
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
}
