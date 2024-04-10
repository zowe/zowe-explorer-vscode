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
import { FileManagement, IZoweTree, IZoweTreeNode, Validation } from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../../extending";
import { Profiles, Constants, TempFolder, SettingsConfig } from "../../configuration";
import { TsoCommandHandler, MvsCommandHandler, UnixCommandHandler } from "../../command";
import { DatasetActions } from "../dataset";
import { USSActions } from "../uss";
import { ProfilesUtils, LoggerUtils } from "../../utils";
import { ZoweLogger, ZoweSaveQueue } from "../../tools";
import { JobActions } from "../job";
import { ProfileManagement, LocalFileManagement } from "../../management";
import { SharedActions, SharedHistoryView, SharedTreeProviders, SharedUtils } from "../shared";

export class SharedInit {
    /**
     * Initialize Zowe Explorer UI functions
     * Function can only run one time during runtime, otherwise it will immediately return
     * @returns Promise<void>
     */
    private static async initZoweExplorerUI(): Promise<void> {
        if (Constants.ACTIVATED) {
            return;
        }
        const tempPath: string = SettingsConfig.getDirectValue(Constants.SETTINGS_TEMP_FOLDER_PATH);
        Constants.defineGlobals(tempPath);
        await TempFolder.hideTempFolder(FileManagement.getZoweDir());
        ProfilesUtils.initializeZoweTempFolder();
        await SettingsConfig.standardizeSettings();
        Constants.setActivated(true);
    }

    public static registerRefreshCommand(
        context: vscode.ExtensionContext,
        activate: (_context: vscode.ExtensionContext) => Promise<ZoweExplorerApiRegister>,
        deactivate: () => Promise<void>
    ): void {
        ZoweLogger.trace("shared.init.registerRefreshCommand called.");
        // set a command to silently reload extension
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.extRefresh", async () => {
                await deactivate();
                for (const sub of context.subscriptions) {
                    try {
                        await sub.dispose();
                    } catch (e) {
                        ZoweLogger.error(e);
                    }
                }
                await activate(context);
            })
        );
    }

    public static registerCommonCommands(context: vscode.ExtensionContext, providers: SharedUtils.IZoweProviders): void {
        ZoweLogger.trace("shared.init.registerCommonCommands called.");

        // Update imperative.json to false only when VS Code setting is set to false
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.updateSecureCredentials", (customCredentialManager?: string) => {
                ProfilesUtils.updateCredentialManagerSetting(customCredentialManager);
                ProfilesUtils.writeOverridesFile();
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.manualPoll", async (_args) => {
                if (vscode.window.activeTextEditor) {
                    // Notify spool provider for "manual poll" key event in open spool files
                    const doc = vscode.window.activeTextEditor.document;
                    if (doc.uri.scheme === "zosspool") {
                        await JobActions.spoolFilePollEvent(doc);
                    }
                }
            })
        );

        // Webview for editing persistent items on Zowe Explorer
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.editHistory", () => {
                return new SharedHistoryView(context, providers);
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.promptCredentials", async (node: IZoweTreeNode) => {
                await ProfilesUtils.promptCredentials(node);
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.profileManagement", async (node: IZoweTreeNode) => {
                await ProfileManagement.manageProfile(node);
            })
        );

        // Register functions & event listeners
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(async (e) => {
                // If the log folder location has been changed, update current log folder preference
                if (e.affectsConfiguration(Constants.SETTINGS_LOGS_FOLDER_PATH)) {
                    await SharedInit.initZoweLogger(context);
                }
                // If the temp folder location has been changed, update current temp folder preference
                if (e.affectsConfiguration(Constants.SETTINGS_TEMP_FOLDER_PATH)) {
                    const updatedPreferencesTempPath: string = SettingsConfig.getDirectValue(Constants.SETTINGS_TEMP_FOLDER_PATH);
                    await TempFolder.moveTempFolder(Constants.SETTINGS_TEMP_FOLDER_LOCATION, updatedPreferencesTempPath);
                }
                if (e.affectsConfiguration(Constants.SETTINGS_AUTOMATIC_PROFILE_VALIDATION)) {
                    await Profiles.getInstance().refresh(ZoweExplorerApiRegister.getInstance());
                    await SharedActions.refreshAll(providers.ds);
                    await SharedActions.refreshAll(providers.uss);
                    await SharedActions.refreshAll(providers.job);
                }
                if (e.affectsConfiguration(Constants.SETTINGS_TEMP_FOLDER_HIDE)) {
                    await TempFolder.hideTempFolder(FileManagement.getZoweDir());
                }

                if (e.affectsConfiguration(Constants.SETTINGS_SECURE_CREDENTIALS_ENABLED)) {
                    await vscode.commands.executeCommand("zowe.updateSecureCredentials");
                }
                if (e.affectsConfiguration(Constants.LOGGER_SETTINGS)) {
                    await vscode.commands.executeCommand("zowe.extRefresh");
                }
            })
        );

        if (providers.ds || providers.uss) {
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.openRecentMember", () => SharedActions.openRecentMemberPrompt(providers.ds, providers.uss))
            );
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.searchInAllLoadedItems", async () =>
                    SharedActions.searchInAllLoadedItems(providers.ds, providers.uss)
                )
            );
            context.subscriptions.push(
                vscode.workspace.onDidSaveTextDocument((savedFile) => {
                    ZoweLogger.debug(
                        vscode.l10n.t({
                            message: `File was saved -- determining whether the file is a USS file or Data set.
                            \n Comparing (case insensitive) {0} against directory {1} and {2}`,
                            args: [savedFile.fileName, Constants.DS_DIR, Constants.USS_DIR],
                            comment: ["Saved file name", "Data Set directory", "USS directory"],
                        })
                    );
                    if (savedFile.fileName.toUpperCase().indexOf(Constants.DS_DIR.toUpperCase()) >= 0) {
                        ZoweLogger.debug(vscode.l10n.t("File is a Data Set-- saving "));
                        // eslint-disable-next-line @typescript-eslint/unbound-method
                        ZoweSaveQueue.push({ uploadRequest: DatasetActions.saveFile, savedFile, fileProvider: providers.ds });
                    } else if (savedFile.fileName.toUpperCase().indexOf(Constants.USS_DIR.toUpperCase()) >= 0) {
                        ZoweLogger.debug(vscode.l10n.t("File is a USS file -- saving"));
                        // eslint-disable-next-line @typescript-eslint/unbound-method
                        ZoweSaveQueue.push({ uploadRequest: USSActions.saveUSSFile, savedFile, fileProvider: providers.uss });
                    } else {
                        ZoweLogger.debug(
                            vscode.l10n.t({
                                message: "File {0} is not a Data Set or USS file",
                                args: [savedFile.fileName],
                                comment: ["Saved file name"],
                            })
                        );
                    }
                })
            );
        }
        if (providers.ds || providers.uss || providers.job) {
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.ds.deleteProfile", async (node) => Profiles.getInstance().deleteProfile(node))
            );
            context.subscriptions.push(vscode.commands.registerCommand("zowe.cmd.deleteProfile", async () => Profiles.getInstance().deleteProfile()));
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.uss.deleteProfile", async (node) => Profiles.getInstance().deleteProfile(node))
            );
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.jobs.deleteProfile", async (node) => Profiles.getInstance().deleteProfile(node))
            );
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.issueTsoCmd", async (node?, command?) => {
                    if (node) {
                        await TsoCommandHandler.getInstance().issueTsoCommand(node.session, command, node);
                    } else {
                        await TsoCommandHandler.getInstance().issueTsoCommand();
                    }
                })
            );
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.issueUnixCmd", async (node?, command?) => {
                    if (node) {
                        await UnixCommandHandler.getInstance().issueUnixCommand(node.session, command, node);
                    } else {
                        await UnixCommandHandler.getInstance().issueUnixCommand();
                    }
                })
            );
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.issueMvsCmd", async (node?, command?) => {
                    if (node) {
                        await MvsCommandHandler.getInstance().issueMvsCommand(node.session, command, node);
                    } else {
                        await MvsCommandHandler.getInstance().issueMvsCommand();
                    }
                })
            );
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.selectForCompare", (node: IZoweTreeNode) => {
                    LocalFileManagement.selectFileForCompare(node);
                })
            );
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.compareWithSelected", async (node: IZoweTreeNode) => {
                    await LocalFileManagement.compareChosenFileContent(node);
                })
            );
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.compareWithSelectedReadOnly", async (node: IZoweTreeNode) => {
                    await LocalFileManagement.compareChosenFileContent(node, true);
                })
            );
            context.subscriptions.push(
                vscode.commands.registerCommand("zowe.compareFileStarted", () => {
                    return Constants.FILE_SELECTED_TO_COMPARE;
                })
            );
            // initialize the Constants.filesToCompare array during initialization
            Constants.resetCompareChoices();
        }
    }

    public static watchConfigProfile(context: vscode.ExtensionContext, providers: SharedUtils.IZoweProviders): void {
        ZoweLogger.trace("shared.init.watchConfigProfile called.");
        const watchers: vscode.FileSystemWatcher[] = [];
        watchers.push(
            vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(FileManagement.getZoweDir(), "{zowe.config,zowe.config.user}.json"))
        );

        if (vscode.workspace.workspaceFolders?.[0] != null) {
            watchers.push(
                vscode.workspace.createFileSystemWatcher(
                    new vscode.RelativePattern(vscode.workspace.workspaceFolders[0].uri.fsPath, "{zowe.config,zowe.config.user}.json")
                )
            );
        }

        context.subscriptions.push(...watchers);

        watchers.forEach((watcher) => {
            watcher.onDidCreate(async () => {
                ZoweLogger.info(vscode.l10n.t("Team config file created, refreshing Zowe Explorer."));
                await vscode.commands.executeCommand("zowe.extRefresh");
                ZoweExplorerApiRegister.getInstance().onProfilesUpdateEmitter.fire(Validation.EventType.CREATE);
            });
            watcher.onDidDelete(async () => {
                ZoweLogger.info(vscode.l10n.t("Team config file deleted, refreshing Zowe Explorer."));
                await vscode.commands.executeCommand("zowe.extRefresh");
                ZoweExplorerApiRegister.getInstance().onProfilesUpdateEmitter.fire(Validation.EventType.DELETE);
            });
            watcher.onDidChange(async (uri: vscode.Uri) => {
                ZoweLogger.info(vscode.l10n.t("Team config file updated."));
                const newProfileContents = await vscode.workspace.fs.readFile(uri);
                if (newProfileContents.toString() === Constants.SAVED_PROFILE_CONTENTS.toString()) {
                    return;
                }
                Constants.setSavedProfileContents(newProfileContents);
                await SharedActions.refreshAll(providers.ds);
                await SharedActions.refreshAll(providers.uss);
                await SharedActions.refreshAll(providers.job);
                ZoweExplorerApiRegister.getInstance().onProfilesUpdateEmitter.fire(Validation.EventType.UPDATE);
            });
        });
    }

    public static initSubscribers(context: vscode.ExtensionContext, theProvider: IZoweTree<IZoweTreeNode>): void {
        ZoweLogger.trace("shared.init.initSubscribers called.");
        const theTreeView = theProvider.getTreeView();
        context.subscriptions.push(theTreeView);
        theTreeView.onDidCollapseElement(async (e) => {
            await theProvider.flipState(e.element, false);
        });
        theTreeView.onDidExpandElement(async (e) => {
            await theProvider.flipState(e.element, true);
        });
    }

    /**
     * Listener for when Zowe button is clicked on activity bar,
     * this event only fires one time upon clicking the Zowe button the first time.
     * @returns Promise<void>
     */
    public static async watchForZoweButtonClick(): Promise<void> {
        const availableTreeProviders: string[] = Object.keys(SharedTreeProviders.providers).filter(
            (provider) => (SharedTreeProviders.providers[provider] as IZoweTree<IZoweTreeNode>).getTreeView() !== undefined
        );
        if (!availableTreeProviders.length) {
            return;
        }
        for (const availableTreeProvider of availableTreeProviders) {
            const treeView: vscode.TreeView<IZoweTreeNode> = SharedTreeProviders.providers[availableTreeProvider].getTreeView();
            // handle case where Zowe Explorer is already visible when loading VS Code
            if (treeView.visible) {
                await SharedInit.initZoweExplorerUI();
            }
            // Wait for visible tree provider and activate UI
            treeView.onDidChangeVisibility(async () => {
                await SharedInit.initZoweExplorerUI();
            });
        }
    }

    public static async initZoweLogger(context: vscode.ExtensionContext): Promise<void> {
        const logsPath = await ZoweLogger.initializeZoweLogger(context);
        ZoweLogger.zeOutputChannel = await LoggerUtils.initVscLogger(context, logsPath);
    }
}
