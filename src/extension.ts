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

// tslint:disable-next-line: no-duplicate-imports
import * as zowe from "@zowe/cli";
import * as fs from "fs";
import * as path from "path";
import * as globals from "./globals";
import * as vscode from "vscode";
import * as ussActions from "./uss/actions";
import * as dsActions from "./dataset/actions";
import * as jobActions from "./job/actions";
import * as sharedActions from "./shared/actions";
import { IZoweDatasetTreeNode, IZoweJobTreeNode, IZoweUSSTreeNode, IZoweTreeNode } from "./api/IZoweTreeNode";
import { IZoweTree } from "./api/IZoweTree";
import { CredentialManagerFactory, ImperativeError, CliProfileManager } from "@zowe/imperative";
import { createDatasetTree } from "./dataset/DatasetTree";
import { createJobsTree } from "./job/ZosJobsProvider";
import { createUSSTree } from "./uss/USSTree";
import { MvsCommandHandler } from "./command/MvsCommandHandler";
import { Profiles } from "./Profiles";
import { errorHandling, getZoweDir, cleanTempDir, addZoweSession, moveTempFolder, getSecurityModules } from "./utils";
import SpoolProvider from "./SpoolProvider";
import { ZoweExplorerApiRegister } from "./api/ZoweExplorerApiRegister";
import { KeytarCredentialManager } from "./KeytarCredentialManager";

import * as nls from "vscode-nls";
const localize = nls.config({messageFormat: nls.MessageFormat.file})();

/**
 * The function that runs when the extension is loaded
 *
 * @export
 * @param {vscode.ExtensionContext} context - Context of vscode at the time that the function is called
 * @returns {Promise<ZoweExplorerApiRegister>}
 */
export async function activate(context: vscode.ExtensionContext): Promise<ZoweExplorerApiRegister> {
    // Get temp folder location from settings
    let preferencesTempPath: string =
        vscode.workspace.getConfiguration()
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
        errorHandling(err, null, err.message);
    }

    let datasetProvider: IZoweTree<IZoweDatasetTreeNode>;
    let ussFileProvider: IZoweTree<IZoweUSSTreeNode>;
    let jobsProvider: IZoweTree<IZoweJobTreeNode>;

    try {
        globals.initLogger(context);
        globals.LOG.debug(localize("initialize.log.debug", "Initialized logger from VSCode extension"));

        const keytar = getSecurityModules("keytar");
        if (keytar) {
            KeytarCredentialManager.keytar = keytar;
            const service: string = vscode.workspace.getConfiguration().get("Zowe Security: Credential Key");

            try {
                await CredentialManagerFactory.initialize(
                    {
                        service: service || "Zowe-Plugin",
                        Manager: KeytarCredentialManager,
                        displayName: localize("displayName", "Zowe Explorer")
                    }
                );
            } catch (err) { throw new ImperativeError({msg: err.toString()}); }
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
        errorHandling(err, null, (localize("initialize.log.error", "Error encountered while activating and initializing logger! ")));
        globals.LOG.error(localize("initialize.log.error",
                                           "Error encountered while activating and initializing logger! ") + JSON.stringify(err));
    }

    const spoolProvider = new SpoolProvider();
    const providerRegistration = vscode.Disposable.from(
        vscode.workspace.registerTextDocumentContentProvider(SpoolProvider.scheme, spoolProvider)
    );
    context.subscriptions.push(spoolProvider, providerRegistration);

    // Register functions & event listeners
    vscode.workspace.onDidChangeConfiguration((e) => {
        // If the temp folder location has been changed, update current temp folder preference
        if (e.affectsConfiguration("Zowe-Temp-Folder-Location")) {
            const updatedPreferencesTempPath: string = vscode.workspace.getConfiguration()
                    /* tslint:disable:no-string-literal */
                    .get("Zowe-Temp-Folder-Location")["folderPath"];
            moveTempFolder(preferencesTempPath, updatedPreferencesTempPath);
            preferencesTempPath = updatedPreferencesTempPath;
        }
    });
    if (datasetProvider) { initDatasetProvider(context, datasetProvider); }
    if (ussFileProvider) { initUSSProvider(context, ussFileProvider); }
    if (jobsProvider) { initJobsProvider(context, jobsProvider); }
    if (datasetProvider || ussFileProvider) {
        vscode.commands.registerCommand("zowe.openRecentMember", () => sharedActions.openRecentMemberPrompt(datasetProvider, ussFileProvider));
        vscode.commands.registerCommand("zowe.searchInAllLoadedItems",
            async () => sharedActions.searchInAllLoadedItems(datasetProvider, ussFileProvider));
        vscode.workspace.onDidSaveTextDocument(async (savedFile) => {
            globals.LOG.debug(localize("onDidSaveTextDocument1",
                "File was saved -- determining whether the file is a USS file or Data set.\n Comparing (case insensitive) ") +
                savedFile.fileName +
                localize("onDidSaveTextDocument2", " against directory ") +
                globals.DS_DIR + localize("onDidSaveTextDocument3", "and") + globals.USS_DIR);
            if (savedFile.fileName.toUpperCase().indexOf(globals.DS_DIR.toUpperCase()) >= 0) {
                globals.LOG.debug(localize("activate.didSaveText.isDataSet", "File is a data set-- saving "));
                await dsActions.saveFile(savedFile, datasetProvider); // TODO MISSED TESTING
            } else if (savedFile.fileName.toUpperCase().indexOf(globals.USS_DIR.toUpperCase()) >= 0) {
                globals.LOG.debug(localize("activate.didSaveText.isUSSFile", "File is a USS file -- saving"));
                await ussActions.saveUSSFile(savedFile, ussFileProvider); // TODO MISSED TESTING
            } else {
                globals.LOG.debug(localize("activate.didSaveText.file", "File ") + savedFile.fileName +
                    localize("activate.didSaveText.notDataSet", " is not a data set or USS file "));
            }
        });
    }

    // return the Extension's API to other extensions that want to register their APIs.
    return ZoweExplorerApiRegister.getInstance();
}

function initDatasetProvider(context: vscode.ExtensionContext, datasetProvider: IZoweTree<IZoweDatasetTreeNode>) {
    vscode.commands.registerCommand("zowe.addSession", async () => addZoweSession(datasetProvider));
    vscode.commands.registerCommand("zowe.addFavorite", async (node) => datasetProvider.addFavorite(node));
    vscode.commands.registerCommand("zowe.refreshAll", () => dsActions.refreshAll(datasetProvider));
    vscode.commands.registerCommand("zowe.refreshNode", (node) => dsActions.refreshPS(node));
    vscode.commands.registerCommand("zowe.pattern", (node) => datasetProvider.filterPrompt(node));
    vscode.commands.registerCommand("zowe.ZoweNode.openPS", (node) => dsActions.openPS(node, true, datasetProvider));
    vscode.commands.registerCommand("zowe.createDataset", (node) => dsActions.createFile(node, datasetProvider));
    vscode.commands.registerCommand("zowe.createMember", (node) => dsActions.createMember(node, datasetProvider));
    vscode.commands.registerCommand("zowe.deleteDataset", (node) => dsActions.deleteDataset(node, datasetProvider));
    vscode.commands.registerCommand("zowe.deletePDS", (node) => dsActions.deleteDataset(node, datasetProvider));
    vscode.commands.registerCommand("zowe.uploadDialog", (node) => dsActions.uploadDialog(node, datasetProvider));
    vscode.commands.registerCommand("zowe.deleteMember", (node) => dsActions.deleteDataset(node, datasetProvider));
    vscode.commands.registerCommand("zowe.editMember", (node) => dsActions.openPS(node, false, datasetProvider));
    vscode.commands.registerCommand("zowe.removeSession", async (node) => datasetProvider.deleteSession(node));
    vscode.commands.registerCommand("zowe.removeFavorite", async (node) => datasetProvider.removeFavorite(node));
    vscode.commands.registerCommand("zowe.saveSearch", async (node) => datasetProvider.addFavorite(node));
    vscode.commands.registerCommand("zowe.removeSavedSearch", async (node) => datasetProvider.removeFavorite(node));
    vscode.commands.registerCommand("zowe.submitJcl", async () => dsActions.submitJcl(datasetProvider));
    vscode.commands.registerCommand("zowe.submitMember", async (node) => dsActions.submitMember(node));
    vscode.commands.registerCommand("zowe.showDSAttributes", (node) => dsActions.showDSAttributes(node, datasetProvider));
    vscode.commands.registerCommand("zowe.renameDataSet", (node) => datasetProvider.rename(node));
    vscode.commands.registerCommand("zowe.copyDataSet", (node) => dsActions.copyDataSet(node));
    vscode.commands.registerCommand("zowe.pasteDataSet", (node) => dsActions.pasteDataSet(node, datasetProvider));
    vscode.commands.registerCommand("zowe.renameDataSetMember", (node) => datasetProvider.rename(node));
    vscode.commands.registerCommand("zowe.hMigrateDataSet", (node) => dsActions.hMigrateDataSet(node));
    vscode.workspace.onDidChangeConfiguration(async (e) => { datasetProvider.onDidChangeConfiguration(e); });

    initSubscribers(context, datasetProvider);
}
function initUSSProvider(context: vscode.ExtensionContext, ussFileProvider: IZoweTree<IZoweUSSTreeNode>) {
    vscode.commands.registerCommand("zowe.uss.addFavorite", async (node: IZoweUSSTreeNode) => ussFileProvider.addFavorite(node));
    vscode.commands.registerCommand("zowe.uss.removeFavorite", async (node: IZoweUSSTreeNode) => ussFileProvider.removeFavorite(node));
    vscode.commands.registerCommand("zowe.uss.addSession", async () => addZoweSession(ussFileProvider));
    vscode.commands.registerCommand("zowe.uss.refreshAll", () => ussActions.refreshAllUSS(ussFileProvider));
    vscode.commands.registerCommand("zowe.uss.refreshUSS", (node: IZoweUSSTreeNode) => node.refreshUSS());
    vscode.commands.registerCommand("zowe.uss.refreshUSSInTree", (node: IZoweUSSTreeNode) => ussActions.refreshUSSInTree(node, ussFileProvider));
    vscode.commands.registerCommand("zowe.uss.fullPath", (node: IZoweUSSTreeNode) => ussFileProvider.filterPrompt(node));
    vscode.commands.registerCommand("zowe.uss.ZoweUSSNode.open", (node: IZoweUSSTreeNode) => node.openUSS(false, true, ussFileProvider));
    vscode.commands.registerCommand("zowe.uss.removeSession", async (node: IZoweUSSTreeNode) => ussFileProvider.deleteSession(node));
    vscode.commands.registerCommand("zowe.uss.createFile", async (node: IZoweUSSTreeNode) => ussActions.createUSSNode(node, ussFileProvider, "file"));
    vscode.commands.registerCommand("zowe.uss.createFolder", async (node: IZoweUSSTreeNode) => ussActions.createUSSNode(node, ussFileProvider, "directory"));
    vscode.commands.registerCommand("zowe.uss.deleteNode", async (node: IZoweUSSTreeNode) =>
        node.deleteUSSNode(ussFileProvider, node.getUSSDocumentFilePath()));
    vscode.commands.registerCommand("zowe.uss.binary", async (node: IZoweUSSTreeNode) => ussActions.changeFileType(node, true, ussFileProvider));
    vscode.commands.registerCommand("zowe.uss.text", async (node: IZoweUSSTreeNode) => ussActions.changeFileType(node, false, ussFileProvider));
    vscode.commands.registerCommand("zowe.uss.renameNode", async (node: IZoweUSSTreeNode) => ussFileProvider.rename(node));
    vscode.commands.registerCommand("zowe.uss.uploadDialog", async (node: IZoweUSSTreeNode) => ussActions.uploadDialog(node, ussFileProvider));
    vscode.commands.registerCommand("zowe.uss.createNode", async (node: IZoweUSSTreeNode) => ussActions.createUSSNodeDialog(node, ussFileProvider));
    vscode.commands.registerCommand("zowe.uss.copyPath", async (node: IZoweUSSTreeNode) => ussActions.copyPath(node));
    vscode.commands.registerCommand("zowe.uss.editFile", (node: IZoweUSSTreeNode) => node.openUSS(false, false, ussFileProvider));
    vscode.commands.registerCommand("zowe.uss.saveSearch", async (node: IZoweUSSTreeNode) => ussFileProvider.saveSearch(node));
    vscode.commands.registerCommand("zowe.uss.removeSavedSearch", async (node: IZoweUSSTreeNode) => ussFileProvider.removeFavorite(node));
    vscode.workspace.onDidChangeConfiguration(async (e) => { ussFileProvider.onDidChangeConfiguration(e); });

    initSubscribers(context, ussFileProvider);
}

function initJobsProvider(context: vscode.ExtensionContext, jobsProvider: IZoweTree<IZoweJobTreeNode>) {
    vscode.commands.registerCommand("zowe.zosJobsOpenspool", (session, spool) => jobActions.getSpoolContent(jobsProvider, session, spool));
    vscode.commands.registerCommand("zowe.deleteJob", (job) => jobsProvider.delete(job));
    vscode.commands.registerCommand("zowe.runModifyCommand", (job) => jobActions.modifyCommand(job));
    vscode.commands.registerCommand("zowe.runStopCommand", (job) => jobActions.stopCommand(job));
    vscode.commands.registerCommand("zowe.refreshJobsServer", async (job) => jobActions.refreshJobsServer(job, jobsProvider));
    vscode.commands.registerCommand("zowe.refreshAllJobs", async () => jobActions.refreshAllJobs(jobsProvider));
    vscode.commands.registerCommand("zowe.addJobsSession", () => addZoweSession(jobsProvider));
    vscode.commands.registerCommand("zowe.setOwner", (job) => jobActions.setOwner(job, jobsProvider));
    vscode.commands.registerCommand("zowe.setPrefix", (job) => jobActions.setPrefix(job, jobsProvider));
    vscode.commands.registerCommand("zowe.removeJobsSession", (job) => jobsProvider.deleteSession(job));
    vscode.commands.registerCommand("zowe.downloadSpool", (job) => jobActions.downloadSpool(job));
    vscode.commands.registerCommand("zowe.getJobJcl", (job) => jobActions.downloadJcl(job));
    vscode.commands.registerCommand("zowe.setJobSpool", async (session, jobid) => {
        const sessionNode = jobsProvider.mSessionNodes.find((jobNode) => jobNode.label.trim() === session.trim());
        sessionNode.dirty = true;
        jobsProvider.refresh();
        const jobs: IZoweJobTreeNode[] = await sessionNode.getChildren();
        const job: IZoweJobTreeNode = jobs.find((jobNode) => jobNode.job.jobid === jobid);
        jobsProvider.setItem(jobsProvider.getTreeView(), job);
    });
    vscode.commands.registerCommand("zowe.jobs.search", (node) => jobsProvider.filterPrompt(node));
    vscode.commands.registerCommand("zowe.issueTsoCmd", async () => MvsCommandHandler.getInstance().issueMvsCommand());
    vscode.commands.registerCommand("zowe.issueMvsCmd", async (node, command) =>
        MvsCommandHandler.getInstance().issueMvsCommand(node.session, command));
    vscode.commands.registerCommand("zowe.jobs.addFavorite", async (node) => jobsProvider.addFavorite(node));
    vscode.commands.registerCommand("zowe.jobs.removeFavorite", async (node) => jobsProvider.removeFavorite(node));
    vscode.commands.registerCommand("zowe.jobs.saveSearch", async (node) => jobsProvider.saveSearch(node));
    vscode.commands.registerCommand("zowe.jobs.removeSearchFavorite", async (node) => jobsProvider.removeFavorite(node));
    vscode.workspace.onDidChangeConfiguration(async (e) => { jobsProvider.onDidChangeConfiguration(e); });

    initSubscribers(context, jobsProvider);
}

function initSubscribers(context: vscode.ExtensionContext, theProvider: IZoweTree<IZoweTreeNode>) {
    const theTreeView = theProvider.getTreeView();
    context.subscriptions.push(theTreeView);
    if (!globals.ISTHEIA) {
        theTreeView.onDidCollapseElement(async (e) => { await theProvider.flipState(e.element, false); });
        theTreeView.onDidExpandElement(async (e) => { await theProvider.flipState(e.element, true); });
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
