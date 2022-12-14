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

import * as fs from "fs";
import * as globals from "./globals";
import * as vscode from "vscode";
import * as ussActions from "./uss/actions";
import * as dsActions from "./dataset/actions";
import * as refreshActions from "./shared/refresh";
import * as sharedActions from "./shared/actions";
import {
    IZoweDatasetTreeNode,
    IZoweJobTreeNode,
    IZoweUSSTreeNode,
    IZoweTreeNode,
    IZoweTree,
    getZoweDir,
} from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "./ZoweExplorerApiRegister";
import { ZoweExplorerExtender } from "./ZoweExplorerExtender";
import { Profiles } from "./Profiles";
import { initializeZoweFolder, promptCredentials, readConfigFromDisk, writeOverridesFile } from "./utils/ProfilesUtils";
import { MvsCommandHandler } from "./command/MvsCommandHandler";
import SpoolProvider from "./SpoolProvider";
import * as nls from "vscode-nls";
import { TsoCommandHandler } from "./command/TsoCommandHandler";
import { cleanTempDir, moveTempFolder, hideTempFolder } from "./utils/TempFolder";
import { SettingsConfig } from "./utils/SettingsConfig";
import { handleSaving } from "./utils/workspace";
import { initDatasetProvider } from "./dataset/extension";
import { initUSSProvider } from "./uss/extension";
import { initJobsProvider } from "./job/extension";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();
let savedProfileContents = new Uint8Array();
let datasetProvider: IZoweTree<IZoweDatasetTreeNode>;
let ussFileProvider: IZoweTree<IZoweUSSTreeNode>;
let jobsProvider: IZoweTree<IZoweJobTreeNode>;

/**
 * The function that runs when the extension is loaded
 *
 * @export
 * @param {vscode.ExtensionContext} context - Context of vscode at the time that the function is called
 * @returns {Promise<ZoweExplorerApiRegister>}
 */
export async function activate(context: vscode.ExtensionContext): Promise<ZoweExplorerApiRegister> {
    // Get temp folder location from settings
    let preferencesTempPath: string = vscode.workspace
        .getConfiguration()
        /* tslint:disable:no-string-literal */
        .get(globals.SETTINGS_TEMP_FOLDER_PATH);

    // Determine the runtime framework to support special behavior for Theia
    globals.defineGlobals(preferencesTempPath);

    hideTempFolder(getZoweDir());

    try {
        globals.initLogger(context);
        globals.LOG.debug(localize("initialize.log.debug", "Initialized logger from VSCode extension"));
    } catch (err) {
        globals.LOG.error(err);
        const errorMessage = localize(
            "initialize.log.error",
            "Error encountered while activating and initializing logger! "
        );
        vscode.window.showErrorMessage(`${errorMessage}: ${err.message}`);
    }

    try {
        await initializeZoweFolder();
        await readConfigFromDisk();
    } catch (err) {
        globals.LOG.error(err);
        const errorMessage = localize("initialize.profiles.error", "Error reading or initializing Zowe CLI profiles.");
        vscode.window.showWarningMessage(`${errorMessage}: ${err.message}`);
    }

    // Initialize profile manager
    await Profiles.createInstance(globals.LOG);

    if (!fs.existsSync(globals.ZOWETEMPFOLDER)) {
        fs.mkdirSync(globals.ZOWETEMPFOLDER);
        fs.mkdirSync(globals.ZOWE_TMP_FOLDER);
        fs.mkdirSync(globals.USS_DIR);
        fs.mkdirSync(globals.DS_DIR);
    }

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
    const spoolProvider = new SpoolProvider();
    const providerRegistration = vscode.Disposable.from(
        vscode.workspace.registerTextDocumentContentProvider(SpoolProvider.scheme, spoolProvider)
    );
    context.subscriptions.push(spoolProvider, providerRegistration);

    // Initialize dataset provider
    datasetProvider = await initDatasetProvider(context);
    // Initialize uss provider
    ussFileProvider = await initUSSProvider(context);
    // Initialize Jobs provider with the created session and the selected pattern
    jobsProvider = await initJobsProvider(context);

    // Register functions & event listeners
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (e) => {
            // If the temp folder location has been changed, update current temp folder preference
            if (e.affectsConfiguration(globals.SETTINGS_TEMP_FOLDER_PATH)) {
                const updatedPreferencesTempPath: string = vscode.workspace
                    .getConfiguration()
                    /* tslint:disable:no-string-literal */
                    .get(globals.SETTINGS_TEMP_FOLDER_PATH);
                moveTempFolder(preferencesTempPath, updatedPreferencesTempPath);
                preferencesTempPath = updatedPreferencesTempPath;
            }
            if (e.affectsConfiguration(globals.SETTINGS_AUTOMATIC_PROFILE_VALIDATION)) {
                await Profiles.getInstance().refresh(ZoweExplorerApiRegister.getInstance());
                await refreshActions.refreshAll(datasetProvider);
                await refreshActions.refreshAll(ussFileProvider);
                await refreshActions.refreshAll(jobsProvider);
            }
            if (e.affectsConfiguration(globals.SETTINGS_TEMP_FOLDER_HIDE)) {
                hideTempFolder(getZoweDir());
            }

            if (e.affectsConfiguration(globals.SETTINGS_SECURE_CREDENTIALS_ENABLED)) {
                await vscode.commands.executeCommand("zowe.updateSecureCredentials");
            }
        })
    );

    if (datasetProvider || ussFileProvider) {
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.openRecentMember", () =>
                sharedActions.openRecentMemberPrompt(datasetProvider, ussFileProvider)
            )
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.searchInAllLoadedItems", async () =>
                sharedActions.searchInAllLoadedItems(datasetProvider, ussFileProvider)
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
                    await handleSaving(dsActions.saveFile, savedFile.document, datasetProvider);
                } else if (savedFile.document.fileName.toUpperCase().indexOf(globals.USS_DIR.toUpperCase()) >= 0) {
                    globals.LOG.debug(localize("activate.didSaveText.isUSSFile", "File is a USS file -- saving"));
                    await handleSaving(ussActions.saveUSSFile, savedFile.document, ussFileProvider);
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
    if (datasetProvider || ussFileProvider || jobsProvider) {
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.ds.deleteProfile", async (node) =>
                Profiles.getInstance().deleteProfile(datasetProvider, ussFileProvider, jobsProvider, node)
            )
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.cmd.deleteProfile", async () =>
                Profiles.getInstance().deleteProfile(datasetProvider, ussFileProvider, jobsProvider)
            )
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.uss.deleteProfile", async (node) =>
                Profiles.getInstance().deleteProfile(datasetProvider, ussFileProvider, jobsProvider, node)
            )
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.jobs.deleteProfile", async (node) =>
                Profiles.getInstance().deleteProfile(datasetProvider, ussFileProvider, jobsProvider, node)
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

    ZoweExplorerExtender.createInstance(datasetProvider, ussFileProvider, jobsProvider);
    await SettingsConfig.standardizeSettings();
    await watchConfigProfile(context);
    globals.setActivated(true);
    return ZoweExplorerApiRegister.getInstance();
}

async function watchConfigProfile(context: vscode.ExtensionContext) {
    if (globals.ISTHEIA) {
        return undefined;
    }
    const globalProfileWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(getZoweDir(), "{zowe.config,zowe.config.user}.json")
    );

    const workspaceProfileWatcher =
        vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders[0] &&
        vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(
                vscode.workspace.workspaceFolders[0].uri.fsPath,
                "{zowe.config,zowe.config.user}.json"
            )
        );

    context.subscriptions.push(workspaceProfileWatcher);
    workspaceProfileWatcher && context.subscriptions.push(globalProfileWatcher);

    const onChangeProfileAction = async (uri: vscode.Uri) => {
        const newProfileContents = await vscode.workspace.fs.readFile(uri);
        if (newProfileContents.toString() === savedProfileContents.toString()) {
            return;
        }
        savedProfileContents = newProfileContents;
        await refreshActions.refreshAll(datasetProvider);
        await refreshActions.refreshAll(ussFileProvider);
        await refreshActions.refreshAll(jobsProvider);
    };

    globalProfileWatcher.onDidCreate(async () => {
        await vscode.commands.executeCommand("zowe.extRefresh");
    });

    globalProfileWatcher.onDidChange(async (uri: vscode.Uri) => {
        await onChangeProfileAction(uri);
    });

    globalProfileWatcher.onDidDelete(async () => {
        await vscode.commands.executeCommand("zowe.extRefresh");
    });

    workspaceProfileWatcher &&
        workspaceProfileWatcher.onDidCreate(async () => {
            await vscode.commands.executeCommand("zowe.extRefresh");
        });

    workspaceProfileWatcher &&
        workspaceProfileWatcher.onDidChange(async (uri: vscode.Uri) => {
            await onChangeProfileAction(uri);
        });

    workspaceProfileWatcher &&
        workspaceProfileWatcher.onDidDelete(async () => {
            await vscode.commands.executeCommand("zowe.extRefresh");
        });
}

function initSubscribers(context: vscode.ExtensionContext, theProvider: IZoweTree<IZoweTreeNode>) {
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

/**
 * Called by VSCode on shutdown
 *
 * @export
 */
export async function deactivate() {
    await cleanTempDir();
    globals.setActivated(false);
}
