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

import * as globals from "../globals";
import * as vscode from "vscode";
import * as refreshActions from "./refresh";
import * as nls from "vscode-nls";
import * as sharedActions from "./actions";
import { getZoweDir, IZoweTree, IZoweTreeNode, EventTypes } from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { Profiles } from "../Profiles";
import { hideTempFolder, moveTempFolder } from "../utils/TempFolder";
import { TsoCommandHandler } from "../command/TsoCommandHandler";
import { MvsCommandHandler } from "../command/MvsCommandHandler";
import { saveFile } from "../dataset/actions";
import { saveUSSFile } from "../uss/actions";
import { ProfilesUtils } from "../utils/ProfilesUtils";
import { ZoweLogger } from "../utils/LoggerUtils";
import { ZoweSaveQueue } from "../abstract/ZoweSaveQueue";
import { SettingsConfig } from "../utils/SettingsConfig";
import { spoolFilePollEvent } from "../job/actions";
import { ProfileManagement } from "../utils/ProfileManagement";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

export interface IZoweProviders {
    ds: IZoweTree<IZoweTreeNode>;
    uss: IZoweTree<IZoweTreeNode>;
    job: IZoweTree<IZoweTreeNode>;
    // [key: string]: IZoweTree<IZoweTreeNode>;
}

export function registerRefreshCommand(
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

export function registerCommonCommands(context: vscode.ExtensionContext, providers: IZoweProviders): void {
    ZoweLogger.trace("shared.init.registerCommonCommands called.");
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.manualPoll", async (_args) => {
            if (vscode.window.activeTextEditor) {
                // Notify spool provider for "manual poll" key event in open spool files
                const doc = vscode.window.activeTextEditor.document;
                if (doc.uri.scheme === "zosspool") {
                    await spoolFilePollEvent(doc);
                }
            }
        })
    );

    // Update imperative.json to false only when VS Code setting is set to false
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.updateSecureCredentials", async (customCredentialManager?: string) => {
            await globals.setGlobalSecurityValue(customCredentialManager);
            ProfilesUtils.writeOverridesFile();
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
            if (e.affectsConfiguration(globals.SETTINGS_LOGS_FOLDER_PATH)) {
                await ZoweLogger.initializeZoweLogger(context);
            }
            // If the temp folder location has been changed, update current temp folder preference
            if (e.affectsConfiguration(globals.SETTINGS_TEMP_FOLDER_PATH)) {
                const updatedPreferencesTempPath: string = SettingsConfig.getDirectValue(globals.SETTINGS_TEMP_FOLDER_PATH);
                await moveTempFolder(globals.SETTINGS_TEMP_FOLDER_LOCATION, updatedPreferencesTempPath);
            }
            if (e.affectsConfiguration(globals.SETTINGS_AUTOMATIC_PROFILE_VALIDATION)) {
                await Profiles.getInstance().refresh(ZoweExplorerApiRegister.getInstance());
                await refreshActions.refreshAll(providers.ds);
                await refreshActions.refreshAll(providers.uss);
                await refreshActions.refreshAll(providers.job);
            }
            if (e.affectsConfiguration(globals.SETTINGS_TEMP_FOLDER_HIDE)) {
                await hideTempFolder(getZoweDir());
            }

            if (e.affectsConfiguration(globals.SETTINGS_SECURE_CREDENTIALS_ENABLED)) {
                await vscode.commands.executeCommand("zowe.updateSecureCredentials");
            }
            if (e.affectsConfiguration(globals.LOGGER_SETTINGS)) {
                await vscode.commands.executeCommand("zowe.extRefresh");
            }
        })
    );

    if (providers.ds || providers.uss) {
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.openRecentMember", () => sharedActions.openRecentMemberPrompt(providers.ds, providers.uss))
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.searchInAllLoadedItems", async () =>
                sharedActions.searchInAllLoadedItems(providers.ds, providers.uss)
            )
        );
        context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument((savedFile) => {
                ZoweLogger.debug(
                    localize(
                        "onDidSaveTextDocument1",
                        "File was saved -- determining whether the file is a USS file or Data set.\n Comparing (case insensitive) "
                    ) +
                        savedFile.fileName +
                        localize("onDidSaveTextDocument2", " against directory ") +
                        globals.DS_DIR +
                        localize("onDidSaveTextDocument3", "and") +
                        globals.USS_DIR
                );
                if (savedFile.fileName.toUpperCase().indexOf(globals.DS_DIR.toUpperCase()) >= 0) {
                    ZoweLogger.debug(localize("activate.didSaveText.isDataSet", "File is a data set-- saving "));
                    ZoweSaveQueue.push({ uploadRequest: saveFile, savedFile, fileProvider: providers.ds });
                } else if (savedFile.fileName.toUpperCase().indexOf(globals.USS_DIR.toUpperCase()) >= 0) {
                    ZoweLogger.debug(localize("activate.didSaveText.isUSSFile", "File is a USS file -- saving"));
                    ZoweSaveQueue.push({ uploadRequest: saveUSSFile, savedFile, fileProvider: providers.uss });
                } else {
                    ZoweLogger.debug(
                        localize("activate.didSaveText.file", "File ") +
                            savedFile.fileName +
                            localize("activate.didSaveText.notDataSet", " is not a data set or USS file ")
                    );
                }
            })
        );
    }
    if (providers.ds || providers.uss || providers.job) {
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.ds.deleteProfile", async (node) =>
                Profiles.getInstance().deleteProfile(providers.ds, providers.uss, providers.job, node)
            )
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.cmd.deleteProfile", async () =>
                Profiles.getInstance().deleteProfile(providers.ds, providers.uss, providers.job)
            )
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.uss.deleteProfile", async (node) =>
                Profiles.getInstance().deleteProfile(providers.ds, providers.uss, providers.job, node)
            )
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.jobs.deleteProfile", async (node) =>
                Profiles.getInstance().deleteProfile(providers.ds, providers.uss, providers.job, node)
            )
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
            vscode.commands.registerCommand("zowe.issueMvsCmd", async (node?, command?) => {
                if (node) {
                    await MvsCommandHandler.getInstance().issueMvsCommand(node.session, command, node);
                } else {
                    await MvsCommandHandler.getInstance().issueMvsCommand();
                }
            })
        );
    }
}

export function watchConfigProfile(context: vscode.ExtensionContext, providers: IZoweProviders): void {
    ZoweLogger.trace("shared.init.watchConfigProfile called.");
    const watchers: vscode.FileSystemWatcher[] = [];
    watchers.push(vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(getZoweDir(), "{zowe.config,zowe.config.user}.json")));

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
            ZoweLogger.info(localize("watchConfigProfile.create", "Team config file created, refreshing Zowe Explorer."));
            await vscode.commands.executeCommand("zowe.extRefresh");
            ZoweExplorerApiRegister.getInstance().onProfilesUpdateEmitter.fire(EventTypes.CREATE);
        });
        watcher.onDidDelete(async () => {
            ZoweLogger.info(localize("watchConfigProfile.delete", "Team config file deleted, refreshing Zowe Explorer."));
            await vscode.commands.executeCommand("zowe.extRefresh");
            ZoweExplorerApiRegister.getInstance().onProfilesUpdateEmitter.fire(EventTypes.DELETE);
        });
        watcher.onDidChange(async (uri: vscode.Uri) => {
            ZoweLogger.info(localize("watchConfigProfile.update", "Team config file updated."));
            const newProfileContents = await vscode.workspace.fs.readFile(uri);
            if (newProfileContents.toString() === globals.SAVED_PROFILE_CONTENTS.toString()) {
                return;
            }
            globals.setSavedProfileContents(newProfileContents);
            await refreshActions.refreshAll(providers.ds);
            await refreshActions.refreshAll(providers.uss);
            await refreshActions.refreshAll(providers.job);
            ZoweExplorerApiRegister.getInstance().onProfilesUpdateEmitter.fire(EventTypes.UPDATE);
            if (globals.ISTHEIA) {
                await vscode.commands.executeCommand("zowe.extRefresh");
            }
        });
    });
}

export function initSubscribers(context: vscode.ExtensionContext, theProvider: IZoweTree<IZoweTreeNode>): void {
    ZoweLogger.trace("shared.init.initSubscribers called.");
    const theTreeView = theProvider.getTreeView();
    context.subscriptions.push(theTreeView);
    if (!globals.ISTHEIA) {
        theTreeView.onDidCollapseElement(async (e) => {
            await theProvider.flipState(e.element, false);
        });
        theTreeView.onDidExpandElement(async (e) => {
            await theProvider.flipState(e.element, true);
        });
    }
}
