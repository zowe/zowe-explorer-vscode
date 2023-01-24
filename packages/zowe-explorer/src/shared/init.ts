/*
 * This program and the accompanying materials are made available under the terms of the *
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at *
 * https://www.eclipse.org/legal/epl-v20.html                                      *
 *                                                                                 *
 * SPDX-License-Identifier: EPL-2.0                                                *
 *                                                                                 *
 * Copyright Contributors to the Zowe Project.                                     *
 *                                                                                 *
 */

import * as globals from "../globals";
import * as vscode from "vscode";
import * as refreshActions from "./refresh";
import * as nls from "vscode-nls";
import * as sharedActions from "./actions";
import { IZoweTreeNode, IZoweTree, getZoweDir } from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { Profiles } from "../Profiles";
import { hideTempFolder, moveTempFolder } from "../utils/TempFolder";
import { TsoCommandHandler } from "../command/TsoCommandHandler";
import { MvsCommandHandler } from "../command/MvsCommandHandler";
import { handleSaving } from "../utils/workspace";
import { saveFile } from "../dataset/actions";
import { saveUSSFile } from "../uss/actions";
import { promptCredentials, writeOverridesFile } from "../utils/ProfilesUtils";

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
    activate: (context: vscode.ExtensionContext) => void,
    deactivate: () => void
) {
    // set a command to silently reload extension
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.extRefresh", async () => {
            if (globals.ISTHEIA) {
                await vscode.commands.executeCommand("workbench.action.reloadWindow");
            } else {
                await deactivate();
                for (const sub of context.subscriptions) {
                    try {
                        await sub.dispose();
                    } catch (e) {
                        globals.LOG.error(e);
                    }
                }
                await activate(context);
            }
        })
    );
}

export async function registerCommonCommands(context: vscode.ExtensionContext, providers: IZoweProviders) {
    // Update imperative.json to false only when VS Code setting is set to false
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.updateSecureCredentials", async () => {
            await globals.setGlobalSecurityValue();
            writeOverridesFile();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.promptCredentials", async (node: IZoweTreeNode) => {
            await promptCredentials(node);
        })
    );

    // Register functions & event listeners
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (e) => {
            // If the temp folder location has been changed, update current temp folder preference
            if (e.affectsConfiguration(globals.SETTINGS_TEMP_FOLDER_PATH)) {
                const updatedPreferencesTempPath: string = vscode.workspace
                    .getConfiguration()
                    /* tslint:disable:no-string-literal */
                    .get(globals.SETTINGS_TEMP_FOLDER_PATH);
                moveTempFolder(globals.SETTINGS_TEMP_FOLDER_LOCATION, updatedPreferencesTempPath);
            }
            if (e.affectsConfiguration(globals.SETTINGS_AUTOMATIC_PROFILE_VALIDATION)) {
                await Profiles.getInstance().refresh(ZoweExplorerApiRegister.getInstance());
                await refreshActions.refreshAll(providers.ds);
                await refreshActions.refreshAll(providers.uss);
                await refreshActions.refreshAll(providers.job);
            }
            if (e.affectsConfiguration(globals.SETTINGS_TEMP_FOLDER_HIDE)) {
                hideTempFolder(getZoweDir());
            }

            if (e.affectsConfiguration(globals.SETTINGS_SECURE_CREDENTIALS_ENABLED)) {
                await vscode.commands.executeCommand("zowe.updateSecureCredentials");
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
            vscode.workspace.onWillSaveTextDocument(async (savedFile) => {
                globals.LOG.debug(
                    localize(
                        "onDidSaveTextDocument1",
                        "File was saved -- determining whether the file is a USS file or Data set.\n Comparing (case insensitive) "
                    ) +
                        savedFile.document.fileName +
                        localize("onDidSaveTextDocument2", " against directory ") +
                        globals.DS_DIR +
                        localize("onDidSaveTextDocument3", "and") +
                        globals.USS_DIR
                );
                if (!savedFile.document.isDirty) {
                    globals.LOG.debug(
                        localize("activate.didSaveText.file", "File ") +
                            savedFile.document.fileName +
                            localize("activate.didSaveText.notDirty", " is not a dirty file ")
                    );
                } else if (savedFile.document.fileName.toUpperCase().indexOf(globals.DS_DIR.toUpperCase()) >= 0) {
                    globals.LOG.debug(localize("activate.didSaveText.isDataSet", "File is a data set-- saving "));
                    await handleSaving(saveFile, savedFile.document, providers.ds);
                } else if (savedFile.document.fileName.toUpperCase().indexOf(globals.USS_DIR.toUpperCase()) >= 0) {
                    globals.LOG.debug(localize("activate.didSaveText.isUSSFile", "File is a USS file -- saving"));
                    await handleSaving(saveUSSFile, savedFile.document, providers.uss);
                } else {
                    globals.LOG.debug(
                        localize("activate.didSaveText.file", "File ") +
                            savedFile.document.fileName +
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
                    TsoCommandHandler.getInstance().issueTsoCommand(node.session, command, node);
                } else {
                    TsoCommandHandler.getInstance().issueTsoCommand();
                }
            })
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.issueMvsCmd", async (node?, command?) => {
                if (node) {
                    MvsCommandHandler.getInstance().issueMvsCommand(node.session, command, node);
                } else {
                    MvsCommandHandler.getInstance().issueMvsCommand();
                }
            })
        );
    }
}

export async function watchConfigProfile(context: vscode.ExtensionContext, providers: IZoweProviders) {
    if (globals.ISTHEIA) {
        return undefined;
    }

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

    watchers.map((watcher) => {
        watcher.onDidCreate(async () => {
            await vscode.commands.executeCommand("zowe.extRefresh");
        });
        watcher.onDidDelete(async () => {
            await vscode.commands.executeCommand("zowe.extRefresh");
        });
        watcher.onDidChange(async (uri: vscode.Uri) => {
            const newProfileContents = await vscode.workspace.fs.readFile(uri);
            if (newProfileContents.toString() === globals.SAVED_PROFILE_CONTENTS.toString()) {
                return;
            }
            globals.setSavedProfileContents(newProfileContents);
            await refreshActions.refreshAll(providers.ds);
            await refreshActions.refreshAll(providers.uss);
            await refreshActions.refreshAll(providers.job);
        });
    });
}

export function initSubscribers(context: vscode.ExtensionContext, theProvider: IZoweTree<IZoweTreeNode>) {
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
