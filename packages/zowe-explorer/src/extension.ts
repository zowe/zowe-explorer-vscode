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

// import * as zowe from "@zowe/cli";
import * as fs from "fs";
import * as path from "path";
import * as globals from "./globals";
import * as vscode from "vscode";
import * as ussActions from "./uss/actions";
import * as dsActions from "./dataset/actions";
import * as jobActions from "./job/actions";
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
import { readConfigFromDisk } from "./utils/ProfilesUtils";
import { CliProfileManager, ImperativeConfig } from "@zowe/imperative";
import { getImperativeConfig } from "@zowe/cli";
import { createDatasetTree } from "./dataset/DatasetTree";
import { createJobsTree } from "./job/ZosJobsProvider";
import { createUSSTree } from "./uss/USSTree";
import { MvsCommandHandler } from "./command/MvsCommandHandler";
import SpoolProvider from "./SpoolProvider";
import * as nls from "vscode-nls";
import { TsoCommandHandler } from "./command/TsoCommandHandler";
import { cleanTempDir, moveTempFolder, hideTempFolder } from "./utils/TempFolder";
import { SettingsConfig } from "./utils/SettingsConfig";
import { UIViews } from "./shared/ui-views";
import { handleSaving } from "./utils/workspace";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

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

    let datasetProvider: IZoweTree<IZoweDatasetTreeNode>;
    let ussFileProvider: IZoweTree<IZoweUSSTreeNode>;
    let jobsProvider: IZoweTree<IZoweJobTreeNode>;

    try {
        globals.initLogger(context);
        globals.LOG.debug(localize("initialize.log.debug", "Initialized logger from VSCode extension"));
    } catch (err) {
        const errorMessage = localize(
            "initialize.log.error",
            "Error encountered while activating and initializing logger! "
        );
        vscode.window.showErrorMessage(errorMessage);
        vscode.window.showErrorMessage(err.message);
    }

    try {
        // Ensure that ~/.zowe folder exists
        if (!ImperativeConfig.instance.config?.exists) {
            const zoweDir = getZoweDir();
            // Should we replace the instance.config above with (await getProfileInfo(globals.ISTHEIA)).exists
            await CliProfileManager.initialize({
                configuration: getImperativeConfig().profiles,
                profileRootDirectory: path.join(zoweDir, "profiles"),
            });

            // TODO(zFernand0): Will address the commented code below once this imperative issue is resolved.
            // https://github.com/zowe/imperative/issues/840

            // const settingsPath = path.join(zoweDir, "settings");
            // if (!fs.existsSync(settingsPath)) {
            //     fs.mkdirSync(settingsPath);
            // }
            // const imperativeSettings = path.join(settingsPath, "imperative.json");
            // if (!fs.existsSync(imperativeSettings)) {
            //     fs.writeFileSync(imperativeSettings, JSON.stringify({
            //         overrides: {
            //             CredentialManager: "@zowe/cli"
            //         }
            //     }));
            // }
        }

        await readConfigFromDisk();

        // Initialize profile manager
        await Profiles.createInstance(globals.LOG);

        if (!fs.existsSync(globals.ZOWETEMPFOLDER)) {
            fs.mkdirSync(globals.ZOWETEMPFOLDER);
            fs.mkdirSync(globals.ZOWE_TMP_FOLDER);
            fs.mkdirSync(globals.USS_DIR);
            fs.mkdirSync(globals.DS_DIR);
        }

        // Initialize dataset provider
        datasetProvider = await createDatasetTree(globals.LOG);
        // Initialize uss provider
        ussFileProvider = await createUSSTree(globals.LOG);
        // Initialize Jobs provider with the created session and the selected pattern
        jobsProvider = await createJobsTree(globals.LOG);
    } catch (err) {
        const errorMessage = localize("initialize.profiles.error", "Error reading or initializing Zowe CLI profiles.");
        vscode.window.showErrorMessage(errorMessage);
        vscode.window.showErrorMessage(err.message);
    }

    // set a command to silently reload extension
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.extRefresh", async () => {
            await deactivate();
            for (const sub of context.subscriptions) {
                try {
                    await sub.dispose();
                } catch (e) {
                    globals.LOG.error(e);
                }
            }
            await activate(context);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.promptCredentials", async (node: IZoweTreeNode) => {
            const mProfileInfo = await Profiles.getInstance().getProfileInfo();
            if (!mProfileInfo.getTeamConfig().properties.autoStore) {
                vscode.window.showInformationMessage(
                    localize(
                        "zowe.promptCredentials.notSupported",
                        '"Update Credentials" operation not supported when "autoStore" is false'
                    )
                );
                return;
            }
            let profileName: string;
            if (node == null) {
                // prompt for profile
                profileName = await UIViews.inputBox({
                    placeHolder: localize(
                        "createNewConnection.option.prompt.profileName.placeholder",
                        "Connection Name"
                    ),
                    prompt: localize(
                        "createNewConnection.option.prompt.profileName",
                        "Enter a name for the connection."
                    ),
                    ignoreFocusOut: true,
                });

                if (profileName === undefined) {
                    vscode.window.showInformationMessage(
                        localize("createNewConnection.undefined.passWord", "Operation Cancelled")
                    );
                    return;
                }
                profileName = profileName.trim();
            } else {
                profileName = node.getProfile().name;
            }

            const creds = await Profiles.getInstance().promptCredentials(profileName, true);

            try {
                const updatedProfileInfo = Profiles.getInstance().loadNamedProfile(profileName);
                node.setProfileToChoice(updatedProfileInfo);
            } catch (err) {
                const errorMessage = localize("zowe.loadNamedProfile.error", "Error when updating credentials.");
                vscode.window.showErrorMessage(errorMessage);
                vscode.window.showErrorMessage(err.message);
            }

            if (creds != null) {
                vscode.window.showInformationMessage(
                    localize(
                        "promptCredentials.updatedCredentials",
                        "Credentials for {0} were successfully updated",
                        profileName
                    )
                );
            }
            await refreshActions.refreshAll(datasetProvider);
            await refreshActions.refreshAll(ussFileProvider);
            await refreshActions.refreshAll(jobsProvider);
        })
    );

    const spoolProvider = new SpoolProvider();
    const providerRegistration = vscode.Disposable.from(
        vscode.workspace.registerTextDocumentContentProvider(SpoolProvider.scheme, spoolProvider)
    );
    context.subscriptions.push(spoolProvider, providerRegistration);

    // Register functions & event listeners
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
    });

    if (datasetProvider) {
        initDatasetProvider(context, datasetProvider);
    }
    if (ussFileProvider) {
        initUSSProvider(context, ussFileProvider);
    }
    if (jobsProvider) {
        initJobsProvider(context, jobsProvider);
    }
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
                    handleSaving(dsActions.saveFile, savedFile.document, datasetProvider);
                } else if (savedFile.document.fileName.toUpperCase().indexOf(globals.USS_DIR.toUpperCase()) >= 0) {
                    globals.LOG.debug(localize("activate.didSaveText.isUSSFile", "File is a USS file -- saving"));
                    handleSaving(ussActions.saveUSSFile, savedFile.document, ussFileProvider);
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
    return ZoweExplorerApiRegister.getInstance();
}

function initDatasetProvider(context: vscode.ExtensionContext, datasetProvider: IZoweTree<IZoweDatasetTreeNode>) {
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.all.config.init", async () => {
            datasetProvider.createZoweSchema(datasetProvider);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.addSession", async () =>
            datasetProvider.createZoweSession(datasetProvider)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.addFavorite", async (node) => datasetProvider.addFavorite(node))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.refreshAll", async () => {
            await Profiles.getInstance().refresh(ZoweExplorerApiRegister.getInstance());
            await refreshActions.refreshAll(datasetProvider);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.refreshNode", (node) => dsActions.refreshPS(node))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.refreshDataset", (node) =>
            dsActions.refreshDataset(node, datasetProvider)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.pattern", (node) => datasetProvider.filterPrompt(node))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.editSession", async (node) =>
            datasetProvider.editSession(node, datasetProvider)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.ZoweNode.openPS", (node) =>
            dsActions.openPS(node, true, datasetProvider)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.createDataset", (node) => dsActions.createFile(node, datasetProvider))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.createMember", (node) => dsActions.createMember(node, datasetProvider))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.deleteDataset", (node?) =>
            dsActions.deleteDatasetPrompt(datasetProvider, node)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.allocateLike", (node) => dsActions.allocateLike(datasetProvider, node))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.uploadDialog", (node) => dsActions.uploadDialog(node, datasetProvider))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.deleteMember", (node?) =>
            dsActions.deleteDatasetPrompt(datasetProvider, node)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.editDataSet", (node) => dsActions.openPS(node, false, datasetProvider))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.editMember", (node) => dsActions.openPS(node, false, datasetProvider))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.removeSession", async (node) => datasetProvider.deleteSession(node))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.removeFavorite", async (node) => datasetProvider.removeFavorite(node))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.saveSearch", async (node) => datasetProvider.addFavorite(node))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.removeSavedSearch", async (node) =>
            datasetProvider.removeFavorite(node)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.removeFavProfile", async (node) =>
            datasetProvider.removeFavProfile(node.label, true)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.submitJcl", async () => dsActions.submitJcl(datasetProvider))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.submitMember", async (node) => dsActions.submitMember(node))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.showDSAttributes", (node) =>
            dsActions.showDSAttributes(node, datasetProvider)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.renameDataSet", (node) => datasetProvider.rename(node))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.copyMember", (node) => dsActions.copyDataSet(node))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.copyDataSet", (node) => dsActions.copyDataSet(node))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.pasteMember", (node) => dsActions.pasteMember(node, datasetProvider))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.renameDataSetMember", (node) => datasetProvider.rename(node))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.hMigrateDataSet", (node) => dsActions.hMigrateDataSet(node))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.hRecallDataSet", (node) => dsActions.hRecallDataSet(node))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.disableValidation", async (node) =>
            Profiles.getInstance().disableValidation(node)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.enableValidation", async (node) =>
            Profiles.getInstance().enableValidation(node)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.ssoLogin", async (node: IZoweTreeNode) =>
            datasetProvider.ssoLogin(node)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.ssoLogout", async (node: IZoweTreeNode) =>
            datasetProvider.ssoLogout(node)
        )
    );
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            datasetProvider.onDidChangeConfiguration(e);
        })
    );

    initSubscribers(context, datasetProvider);
}

function initUSSProvider(context: vscode.ExtensionContext, ussFileProvider: IZoweTree<IZoweUSSTreeNode>) {
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.addFavorite", async () => {
            let selectedNodes = ussFileProvider.getTreeView().selection as IZoweUSSTreeNode[];
            selectedNodes.forEach((selectedNode) => {
                ussFileProvider.addFavorite(selectedNode);
            });
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.removeFavorite", async () => {
            let selectedNodes = ussFileProvider.getTreeView().selection as IZoweUSSTreeNode[];
            selectedNodes.forEach((selectedNode) => {
                ussFileProvider.removeFavorite(selectedNode);
            });
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.addSession", async () =>
            ussFileProvider.createZoweSession(ussFileProvider)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.refreshAll", async () => {
            await Profiles.getInstance().refresh(ZoweExplorerApiRegister.getInstance());
            await refreshActions.refreshAll(ussFileProvider);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.refreshUSS", () => {
            let selectedNodes = ussFileProvider.getTreeView().selection as IZoweUSSTreeNode[];
            selectedNodes = selectedNodes.filter((x) => x.contextValue === globals.DS_TEXT_FILE_CONTEXT);
            selectedNodes.forEach((selectedNode) => {
                selectedNode.refreshUSS();
            });
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.refreshUSSInTree", (node: IZoweUSSTreeNode) =>
            ussActions.refreshUSSInTree(node, ussFileProvider)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.refreshDirectory", (node: IZoweUSSTreeNode) => {
            ussActions.refreshDirectory(node, ussFileProvider);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.fullPath", (node: IZoweUSSTreeNode) =>
            ussFileProvider.filterPrompt(node)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.editSession", async (node) =>
            ussFileProvider.editSession(node, ussFileProvider)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.ZoweUSSNode.open", (node: IZoweUSSTreeNode) =>
            node.openUSS(false, true, ussFileProvider)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.removeSession", async (node: IZoweUSSTreeNode) =>
            ussFileProvider.deleteSession(node)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.createFile", async (node: IZoweUSSTreeNode) =>
            ussActions.createUSSNode(node, ussFileProvider, "file")
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.createFolder", async (node: IZoweUSSTreeNode) =>
            ussActions.createUSSNode(node, ussFileProvider, "directory")
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.deleteNode", (node: IZoweUSSTreeNode) => {
            const tempNode = ussFileProvider.getTreeView().selection[0] as IZoweUSSTreeNode;
            tempNode.deleteUSSNode(ussFileProvider, tempNode.getUSSDocumentFilePath());
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.binary", async (node: IZoweUSSTreeNode) =>
            ussActions.changeFileType(node, true, ussFileProvider)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.text", async (node: IZoweUSSTreeNode) =>
            ussActions.changeFileType(node, false, ussFileProvider)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.renameNode", async (node: IZoweUSSTreeNode) =>
            ussFileProvider.rename(node)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.uploadDialog", async (node: IZoweUSSTreeNode) =>
            ussActions.uploadDialog(node, ussFileProvider)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.copyPath", async (node: IZoweUSSTreeNode) =>
            ussActions.copyPath(node)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.editFile", (node: IZoweUSSTreeNode) =>
            node.openUSS(false, false, ussFileProvider)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.saveSearch", async (node: IZoweUSSTreeNode) =>
            ussFileProvider.saveSearch(node)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.removeSavedSearch", async (node: IZoweUSSTreeNode) =>
            ussFileProvider.removeFavorite(node)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.removeFavProfile", async (node) =>
            ussFileProvider.removeFavProfile(node.label, true)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.disableValidation", async (node) =>
            Profiles.getInstance().disableValidation(node)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.enableValidation", async (node) =>
            Profiles.getInstance().enableValidation(node)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.ssoLogin", async (node: IZoweTreeNode) =>
            ussFileProvider.ssoLogin(node)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.ssoLogout", async (node: IZoweTreeNode) =>
            ussFileProvider.ssoLogout(node)
        )
    );
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            ussFileProvider.onDidChangeConfiguration(e);
        })
    );

    initSubscribers(context, ussFileProvider);
}

function initJobsProvider(context: vscode.ExtensionContext, jobsProvider: IZoweTree<IZoweJobTreeNode>) {
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.zosJobsOpenspool", (session, spool, refreshTimestamp) =>
            jobActions.getSpoolContent(session, spool, refreshTimestamp)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.deleteJob", async (job, jobs) =>
            jobActions.deleteCommand(jobsProvider, job, jobs)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.runModifyCommand", (job) => jobActions.modifyCommand(job))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.runStopCommand", (job) => jobActions.stopCommand(job))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.refreshJobsServer", async (job) =>
            jobActions.refreshJobsServer(job, jobsProvider)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.refreshAllJobs", async () => {
            await Profiles.getInstance().refresh(ZoweExplorerApiRegister.getInstance());
            await refreshActions.refreshAll(jobsProvider);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.refreshJob", async (job) => jobActions.refreshJob(job, jobsProvider))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.refreshSpool", (node) =>
            jobActions.getSpoolContentFromMainframe(node)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.addJobsSession", () => jobsProvider.createZoweSession(jobsProvider))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.setOwner", (job) => jobActions.setOwner(job, jobsProvider))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.setPrefix", (job) => jobActions.setPrefix(job, jobsProvider))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.removeJobsSession", (job) => jobsProvider.deleteSession(job))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.downloadSpool", (job) => jobActions.downloadSpool(job))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.getJobJcl", (job) => jobActions.downloadJcl(job))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.setJobSpool", async (session, jobId) =>
            jobActions.focusOnJob(jobsProvider, session, jobId)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.search", (node) => jobsProvider.filterPrompt(node))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.editSession", async (node) =>
            jobsProvider.editSession(node, jobsProvider)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.addFavorite", async (node) => jobsProvider.addFavorite(node))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.removeFavorite", async (node) => jobsProvider.removeFavorite(node))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.saveSearch", async (node) => jobsProvider.saveSearch(node))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.removeSearchFavorite", async (node) =>
            jobsProvider.removeFavorite(node)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.removeFavProfile", async (node) =>
            jobsProvider.removeFavProfile(node.label, true)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.disableValidation", async (node) =>
            Profiles.getInstance().disableValidation(node)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.enableValidation", async (node) =>
            Profiles.getInstance().enableValidation(node)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.ssoLogin", async (node: IZoweTreeNode) =>
            jobsProvider.ssoLogin(node)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.ssoLogout", async (node: IZoweTreeNode) =>
            jobsProvider.ssoLogout(node)
        )
    );
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            jobsProvider.onDidChangeConfiguration(e);
        })
    );

    initSubscribers(context, jobsProvider);
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
}
