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

import * as zowe from "@zowe/cli";
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
    KeytarApi,
} from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "./ZoweExplorerApiRegister";
import { ZoweExplorerExtender } from "./ZoweExplorerExtender";
import { Profiles } from "./Profiles";
import { errorHandling, getZoweDir } from "./utils/ProfilesUtils";
import { linkProfileDialog } from "./ProfileLink";
import { CliProfileManager, ImperativeError } from "@zowe/imperative";
import { createDatasetTree } from "./dataset/DatasetTree";
import { createJobsTree } from "./job/ZosJobsProvider";
import { createUSSTree } from "./uss/USSTree";
import { MvsCommandHandler } from "./command/MvsCommandHandler";
import SpoolProvider from "./SpoolProvider";
import * as nls from "vscode-nls";
import { TsoCommandHandler } from "./command/TsoCommandHandler";
import { cleanTempDir, moveTempFolder } from "./utils/TempFolder";

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
        .get("Zowe-Temp-Folder-Location")["folderPath"];

    // Determine the runtime framework to support special behavior for Theia
    globals.defineGlobals(preferencesTempPath);

    // Call cleanTempDir before continuing
    // this is to handle if the application crashed on a previous execution and
    // VSC didn't get a chance to call our deactivate to cleanup.
    await deactivate();

    try {
        fs.mkdirSync(globals.ZOWETEMPFOLDER);
        fs.mkdirSync(globals.ZOWE_TMP_FOLDER);
        fs.mkdirSync(globals.USS_DIR);
        fs.mkdirSync(globals.DS_DIR);
    } catch (err) {
        await errorHandling(err, null, err.message);
    }

    let datasetProvider: IZoweTree<IZoweDatasetTreeNode>;
    let ussFileProvider: IZoweTree<IZoweUSSTreeNode>;
    let jobsProvider: IZoweTree<IZoweJobTreeNode>;

    try {
        globals.initLogger(context);
        globals.LOG.debug(localize("initialize.log.debug", "Initialized logger from VSCode extension"));

        try {
            const keytarApi = new KeytarApi(globals.LOG);
            await keytarApi.activateKeytar(false, globals.ISTHEIA);
        } catch (err) {
            throw new ImperativeError({ msg: err.toString() });
        }

        // Ensure that ~/.zowe folder exists
        await CliProfileManager.initialize({
            configuration: zowe.getImperativeConfig().profiles,
            profileRootDirectory: path.join(getZoweDir(), "profiles"),
        });

        // Initialize profile manager
        await Profiles.createInstance(globals.LOG);
        // Initialize dataset provider
        datasetProvider = await createDatasetTree(globals.LOG);
        // Initialize uss provider
        ussFileProvider = await createUSSTree(globals.LOG);
        // Initialize Jobs provider with the created session and the selected pattern
        jobsProvider = await createJobsTree(globals.LOG);
    } catch (err) {
        await errorHandling(
            err,
            null,
            localize("initialize.log.error", "Error encountered while activating and initializing logger! ")
        );
        globals.LOG.error(
            localize("initialize.log.error", "Error encountered while activating and initializing logger! ") +
                JSON.stringify(err)
        );
    }

    const spoolProvider = new SpoolProvider();
    const providerRegistration = vscode.Disposable.from(
        vscode.workspace.registerTextDocumentContentProvider(SpoolProvider.scheme, spoolProvider)
    );
    context.subscriptions.push(spoolProvider, providerRegistration);

    // Register functions & event listeners
    vscode.workspace.onDidChangeConfiguration(async (e) => {
        // If the temp folder location has been changed, update current temp folder preference
        if (e.affectsConfiguration("Zowe-Temp-Folder-Location")) {
            const updatedPreferencesTempPath: string = vscode.workspace
                .getConfiguration()
                /* tslint:disable:no-string-literal */
                .get("Zowe-Temp-Folder-Location")["folderPath"];
            moveTempFolder(preferencesTempPath, updatedPreferencesTempPath);
            preferencesTempPath = updatedPreferencesTempPath;
        }
        if (e.affectsConfiguration("Zowe-Automatic-Validation")) {
            await refreshActions.refreshAll(datasetProvider);
            await refreshActions.refreshAll(ussFileProvider);
            await refreshActions.refreshAll(jobsProvider);
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
        vscode.commands.registerCommand("zowe.openRecentMember", () =>
            sharedActions.openRecentMemberPrompt(datasetProvider, ussFileProvider)
        );
        vscode.commands.registerCommand("zowe.searchInAllLoadedItems", async () =>
            sharedActions.searchInAllLoadedItems(datasetProvider, ussFileProvider)
        );
        vscode.workspace.onDidSaveTextDocument(async (savedFile) => {
            globals.LOG.debug(
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
                globals.LOG.debug(localize("activate.didSaveText.isDataSet", "File is a data set-- saving "));
                await dsActions.saveFile(savedFile, datasetProvider); // TODO MISSED TESTING
            } else if (savedFile.fileName.toUpperCase().indexOf(globals.USS_DIR.toUpperCase()) >= 0) {
                globals.LOG.debug(localize("activate.didSaveText.isUSSFile", "File is a USS file -- saving"));
                await ussActions.saveUSSFile(savedFile, ussFileProvider); // TODO MISSED TESTING
            } else {
                globals.LOG.debug(
                    localize("activate.didSaveText.file", "File ") +
                        savedFile.fileName +
                        localize("activate.didSaveText.notDataSet", " is not a data set or USS file ")
                );
            }
        });
    }
    if (datasetProvider || ussFileProvider || jobsProvider) {
        vscode.commands.registerCommand("zowe.ds.deleteProfile", async (node) =>
            Profiles.getInstance().deleteProfile(datasetProvider, ussFileProvider, jobsProvider, node)
        );
        vscode.commands.registerCommand("zowe.cmd.deleteProfile", async () =>
            Profiles.getInstance().deleteProfile(datasetProvider, ussFileProvider, jobsProvider)
        );
        vscode.commands.registerCommand("zowe.uss.deleteProfile", async (node) =>
            Profiles.getInstance().deleteProfile(datasetProvider, ussFileProvider, jobsProvider, node)
        );
        vscode.commands.registerCommand("zowe.jobs.deleteProfile", async (node) =>
            Profiles.getInstance().deleteProfile(datasetProvider, ussFileProvider, jobsProvider, node)
        );
        vscode.commands.registerCommand("zowe.issueTsoCmd", async (node?, command?) => {
            if (node) {
                TsoCommandHandler.getInstance().issueTsoCommand(node.session, command, node);
            } else {
                TsoCommandHandler.getInstance().issueTsoCommand();
            }
        });
        vscode.commands.registerCommand("zowe.issueMvsCmd", async (node?, command?) => {
            if (node) {
                MvsCommandHandler.getInstance().issueMvsCommand(node.session, command, node);
            } else {
                MvsCommandHandler.getInstance().issueMvsCommand();
            }
        });
    }

    ZoweExplorerExtender.createInstance(datasetProvider, ussFileProvider, jobsProvider);
    return ZoweExplorerApiRegister.getInstance();
}

function initDatasetProvider(context: vscode.ExtensionContext, datasetProvider: IZoweTree<IZoweDatasetTreeNode>) {
    vscode.commands.registerCommand("zowe.ds.addSession", async () =>
        datasetProvider.createZoweSession(datasetProvider)
    );
    vscode.commands.registerCommand("zowe.ds.addFavorite", async (node) => datasetProvider.addFavorite(node));
    vscode.commands.registerCommand("zowe.ds.refreshAll", () => refreshActions.refreshAll(datasetProvider));
    vscode.commands.registerCommand("zowe.ds.refreshNode", (node) => dsActions.refreshPS(node));
    vscode.commands.registerCommand("zowe.ds.refreshDataset", (node) =>
        dsActions.refreshDataset(node, datasetProvider)
    );
    vscode.commands.registerCommand("zowe.ds.pattern", (node) => datasetProvider.filterPrompt(node));
    vscode.commands.registerCommand("zowe.ds.editSession", async (node) =>
        datasetProvider.editSession(node, datasetProvider)
    );
    vscode.commands.registerCommand("zowe.ds.ZoweNode.openPS", (node) => dsActions.openPS(node, true, datasetProvider));
    vscode.commands.registerCommand("zowe.ds.createDataset", (node) => dsActions.createFile(node, datasetProvider));
    vscode.commands.registerCommand("zowe.all.profilelink", (node) => linkProfileDialog(node.getProfile()));
    vscode.commands.registerCommand("zowe.ds.createMember", (node) => dsActions.createMember(node, datasetProvider));
    vscode.commands.registerCommand("zowe.ds.deleteDataset", (node) => dsActions.deleteDataset(node, datasetProvider));
    vscode.commands.registerCommand("zowe.ds.allocateLike", (node) => dsActions.allocateLike(datasetProvider, node));
    vscode.commands.registerCommand("zowe.ds.uploadDialog", (node) => dsActions.uploadDialog(node, datasetProvider));
    vscode.commands.registerCommand("zowe.ds.deleteMember", (node) => dsActions.deleteDataset(node, datasetProvider));
    vscode.commands.registerCommand("zowe.ds.editDataSet", (node) => dsActions.openPS(node, false, datasetProvider));
    vscode.commands.registerCommand("zowe.ds.editMember", (node) => dsActions.openPS(node, false, datasetProvider));
    vscode.commands.registerCommand("zowe.ds.removeSession", async (node) => datasetProvider.deleteSession(node));
    vscode.commands.registerCommand("zowe.ds.removeFavorite", async (node) => datasetProvider.removeFavorite(node));
    vscode.commands.registerCommand("zowe.ds.saveSearch", async (node) => datasetProvider.addFavorite(node));
    vscode.commands.registerCommand("zowe.ds.removeSavedSearch", async (node) => datasetProvider.removeFavorite(node));
    vscode.commands.registerCommand("zowe.ds.removeFavProfile", async (node) =>
        datasetProvider.removeFavProfile(node.label, true)
    );
    vscode.commands.registerCommand("zowe.ds.submitJcl", async () => dsActions.submitJcl(datasetProvider));
    vscode.commands.registerCommand("zowe.ds.submitMember", async (node) => dsActions.submitMember(node));
    vscode.commands.registerCommand("zowe.ds.showDSAttributes", (node) =>
        dsActions.showDSAttributes(node, datasetProvider)
    );
    vscode.commands.registerCommand("zowe.ds.renameDataSet", (node) => datasetProvider.rename(node));
    vscode.commands.registerCommand("zowe.ds.copyMember", (node) => dsActions.copyDataSet(node));
    vscode.commands.registerCommand("zowe.ds.copyDataSet", (node) => dsActions.copyDataSet(node));
    vscode.commands.registerCommand("zowe.ds.pasteMember", (node) => dsActions.pasteMember(node, datasetProvider));
    vscode.commands.registerCommand("zowe.ds.renameDataSetMember", (node) => datasetProvider.rename(node));
    vscode.commands.registerCommand("zowe.ds.hMigrateDataSet", (node) => dsActions.hMigrateDataSet(node));
    vscode.commands.registerCommand("zowe.ds.hRecallDataSet", (node) => dsActions.hRecallDataSet(node));
    vscode.commands.registerCommand("zowe.ds.disableValidation", async (node) =>
        Profiles.getInstance().disableValidation(node)
    );
    vscode.commands.registerCommand("zowe.ds.enableValidation", async (node) =>
        Profiles.getInstance().enableValidation(node)
    );
    vscode.commands.registerCommand("zowe.ds.ssoLogin", async (node) => datasetProvider.ssoLogin(node));
    vscode.commands.registerCommand("zowe.ds.ssoLogout", async (node) => datasetProvider.ssoLogout(node));
    vscode.workspace.onDidChangeConfiguration((e) => {
        datasetProvider.onDidChangeConfiguration(e);
    });

    initSubscribers(context, datasetProvider);
}

function initUSSProvider(context: vscode.ExtensionContext, ussFileProvider: IZoweTree<IZoweUSSTreeNode>) {
    vscode.commands.registerCommand("zowe.uss.addFavorite", async (node: IZoweUSSTreeNode) =>
        ussFileProvider.addFavorite(node)
    );
    vscode.commands.registerCommand("zowe.uss.removeFavorite", async (node: IZoweUSSTreeNode) =>
        ussFileProvider.removeFavorite(node)
    );
    vscode.commands.registerCommand("zowe.uss.addSession", async () =>
        ussFileProvider.createZoweSession(ussFileProvider)
    );
    vscode.commands.registerCommand("zowe.uss.refreshAll", () => refreshActions.refreshAll(ussFileProvider));
    vscode.commands.registerCommand("zowe.uss.refreshUSS", (node: IZoweUSSTreeNode) => node.refreshUSS());
    vscode.commands.registerCommand("zowe.uss.refreshUSSInTree", (node: IZoweUSSTreeNode) =>
        ussActions.refreshUSSInTree(node, ussFileProvider)
    );
    vscode.commands.registerCommand("zowe.uss.fullPath", (node: IZoweUSSTreeNode) =>
        ussFileProvider.filterPrompt(node)
    );
    vscode.commands.registerCommand("zowe.uss.editSession", async (node) =>
        ussFileProvider.editSession(node, ussFileProvider)
    );
    vscode.commands.registerCommand("zowe.uss.ZoweUSSNode.open", (node: IZoweUSSTreeNode) =>
        node.openUSS(false, true, ussFileProvider)
    );
    vscode.commands.registerCommand("zowe.uss.removeSession", async (node: IZoweUSSTreeNode) =>
        ussFileProvider.deleteSession(node)
    );
    vscode.commands.registerCommand("zowe.uss.createFile", async (node: IZoweUSSTreeNode) =>
        ussActions.createUSSNode(node, ussFileProvider, "file")
    );
    vscode.commands.registerCommand("zowe.uss.createFolder", async (node: IZoweUSSTreeNode) =>
        ussActions.createUSSNode(node, ussFileProvider, "directory")
    );
    vscode.commands.registerCommand("zowe.uss.deleteNode", async (node: IZoweUSSTreeNode) =>
        node.deleteUSSNode(ussFileProvider, node.getUSSDocumentFilePath())
    );
    vscode.commands.registerCommand("zowe.uss.binary", async (node: IZoweUSSTreeNode) =>
        ussActions.changeFileType(node, true, ussFileProvider)
    );
    vscode.commands.registerCommand("zowe.uss.text", async (node: IZoweUSSTreeNode) =>
        ussActions.changeFileType(node, false, ussFileProvider)
    );
    vscode.commands.registerCommand("zowe.uss.renameNode", async (node: IZoweUSSTreeNode) =>
        ussFileProvider.rename(node)
    );
    vscode.commands.registerCommand("zowe.uss.uploadDialog", async (node: IZoweUSSTreeNode) =>
        ussActions.uploadDialog(node, ussFileProvider)
    );
    vscode.commands.registerCommand("zowe.uss.copyPath", async (node: IZoweUSSTreeNode) => ussActions.copyPath(node));
    vscode.commands.registerCommand("zowe.uss.editFile", (node: IZoweUSSTreeNode) =>
        node.openUSS(false, false, ussFileProvider)
    );
    vscode.commands.registerCommand("zowe.uss.saveSearch", async (node: IZoweUSSTreeNode) =>
        ussFileProvider.saveSearch(node)
    );
    vscode.commands.registerCommand("zowe.uss.removeSavedSearch", async (node: IZoweUSSTreeNode) =>
        ussFileProvider.removeFavorite(node)
    );
    vscode.commands.registerCommand("zowe.uss.removeFavProfile", async (node) =>
        ussFileProvider.removeFavProfile(node.label, true)
    );
    vscode.commands.registerCommand("zowe.uss.disableValidation", async (node) =>
        Profiles.getInstance().disableValidation(node)
    );
    vscode.commands.registerCommand("zowe.uss.enableValidation", async (node) =>
        Profiles.getInstance().enableValidation(node)
    );
    vscode.commands.registerCommand("zowe.uss.ssoLogin", async (node) => ussFileProvider.ssoLogin(node));
    vscode.commands.registerCommand("zowe.uss.ssoLogout", async (node) => ussFileProvider.ssoLogout(node));
    vscode.workspace.onDidChangeConfiguration((e) => {
        ussFileProvider.onDidChangeConfiguration(e);
    });

    initSubscribers(context, ussFileProvider);
}

function initJobsProvider(context: vscode.ExtensionContext, jobsProvider: IZoweTree<IZoweJobTreeNode>) {
    vscode.commands.registerCommand("zowe.jobs.zosJobsOpenspool", (session, spool) =>
        jobActions.getSpoolContent(jobsProvider, session, spool)
    );
    vscode.commands.registerCommand("zowe.jobs.deleteJob", async (job) => jobActions.deleteCommand(job, jobsProvider));
    vscode.commands.registerCommand("zowe.jobs.runModifyCommand", (job) => jobActions.modifyCommand(job));
    vscode.commands.registerCommand("zowe.jobs.runStopCommand", (job) => jobActions.stopCommand(job));
    vscode.commands.registerCommand("zowe.jobs.refreshJobsServer", async (job) =>
        jobActions.refreshJobsServer(job, jobsProvider)
    );
    vscode.commands.registerCommand("zowe.jobs.refreshAllJobs", async () => refreshActions.refreshAll(jobsProvider));
    vscode.commands.registerCommand("zowe.jobs.addJobsSession", () => jobsProvider.createZoweSession(jobsProvider));
    vscode.commands.registerCommand("zowe.jobs.setOwner", (job) => jobActions.setOwner(job, jobsProvider));
    vscode.commands.registerCommand("zowe.jobs.setPrefix", (job) => jobActions.setPrefix(job, jobsProvider));
    vscode.commands.registerCommand("zowe.jobs.removeJobsSession", (job) => jobsProvider.deleteSession(job));
    vscode.commands.registerCommand("zowe.jobs.downloadSpool", (job) => jobActions.downloadSpool(job));
    vscode.commands.registerCommand("zowe.jobs.getJobJcl", (job) => jobActions.downloadJcl(job));
    vscode.commands.registerCommand("zowe.jobs.setJobSpool", async (session, jobid) => {
        const sessionNode: IZoweJobTreeNode = jobsProvider.mSessionNodes.find(
            (jobNode) => jobNode.label.trim() === session.trim()
        );
        sessionNode.dirty = true;
        jobsProvider.refresh();
        sessionNode.searchId = jobid;
        const jobs: IZoweJobTreeNode[] = await sessionNode.getChildren();
        const job: IZoweJobTreeNode = jobs.find((jobNode) => jobNode.job.jobid === jobid);
        jobsProvider.setItem(jobsProvider.getTreeView(), job);
    });
    vscode.commands.registerCommand("zowe.jobs.search", (node) => jobsProvider.filterPrompt(node));
    vscode.commands.registerCommand("zowe.jobs.editSession", async (node) =>
        jobsProvider.editSession(node, jobsProvider)
    );
    vscode.commands.registerCommand("zowe.jobs.addFavorite", async (node) => jobsProvider.addFavorite(node));
    vscode.commands.registerCommand("zowe.jobs.removeFavorite", async (node) => jobsProvider.removeFavorite(node));
    vscode.commands.registerCommand("zowe.jobs.saveSearch", async (node) => jobsProvider.saveSearch(node));
    vscode.commands.registerCommand("zowe.jobs.removeSearchFavorite", async (node) =>
        jobsProvider.removeFavorite(node)
    );
    vscode.commands.registerCommand("zowe.jobs.removeFavProfile", async (node) =>
        jobsProvider.removeFavProfile(node.label, true)
    );
    vscode.commands.registerCommand("zowe.jobs.disableValidation", async (node) =>
        Profiles.getInstance().disableValidation(node)
    );
    vscode.commands.registerCommand("zowe.jobs.enableValidation", async (node) =>
        Profiles.getInstance().enableValidation(node)
    );
    vscode.commands.registerCommand("zowe.jobs.ssoLogin", async (node) => jobsProvider.ssoLogin(node));
    vscode.commands.registerCommand("zowe.jobs.ssoLogout", async (node) => jobsProvider.ssoLogout(node));
    vscode.workspace.onDidChangeConfiguration((e) => {
        jobsProvider.onDidChangeConfiguration(e);
    });

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
