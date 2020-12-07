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
import * as sharedActions from "./shared/actions";
import { moveSync } from "fs-extra";
import {
    IZoweDatasetTreeNode,
    IZoweJobTreeNode,
    IZoweUSSTreeNode,
    IZoweTreeNode,
    IZoweTree,
} from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "./ZoweExplorerApiRegister";
import { ZoweExplorerExtender } from "./ZoweExplorerExtender";
import { Profiles } from "./Profiles";
import { errorHandling, getZoweDir } from "./utils/ProfilesUtils";
import { linkProfileDialog } from "./ProfileLink";
import { CredentialManagerFactory, ImperativeError, CliProfileManager } from "@zowe/imperative";
import { createDatasetTree } from "./dataset/DatasetTree";
import { createJobsTree } from "./job/ZosJobsProvider";
import { createUSSTree } from "./uss/USSTree";
import { MvsCommandHandler } from "./command/MvsCommandHandler";
import SpoolProvider from "./SpoolProvider";
import { KeytarCredentialManager } from "./KeytarCredentialManager";
import * as nls from "vscode-nls";
declare const __webpack_require__: typeof require;
declare const __non_webpack_require__: typeof require;

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

        const keytar = getSecurityModules("keytar");
        if (keytar) {
            KeytarCredentialManager.keytar = keytar;
            const service: string = vscode.workspace.getConfiguration().get("Zowe Security: Credential Key");

            try {
                await CredentialManagerFactory.initialize({
                    service: service || "Zowe-Plugin",
                    Manager: KeytarCredentialManager,
                    displayName: localize("displayName", "Zowe Explorer"),
                });
            } catch (err) {
                throw new ImperativeError({ msg: err.toString() });
            }
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
            await dsActions.refreshAll(datasetProvider);
            await ussActions.refreshAllUSS(ussFileProvider);
            await jobActions.refreshAllJobs(jobsProvider);
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
        vscode.commands.registerCommand("zowe.deleteProfile", async (node) =>
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
    }

    ZoweExplorerExtender.createInstance(datasetProvider, ussFileProvider, jobsProvider);
    return ZoweExplorerApiRegister.getInstance();
}

function initDatasetProvider(context: vscode.ExtensionContext, datasetProvider: IZoweTree<IZoweDatasetTreeNode>) {
    vscode.commands.registerCommand("zowe.addSession", async () => datasetProvider.createZoweSession(datasetProvider));
    vscode.commands.registerCommand("zowe.addFavorite", async (node) => datasetProvider.addFavorite(node));
    vscode.commands.registerCommand("zowe.refreshAll", () => dsActions.refreshAll(datasetProvider));
    vscode.commands.registerCommand("zowe.refreshNode", (node) => dsActions.refreshPS(node));
    vscode.commands.registerCommand("zowe.pattern", (node) => datasetProvider.filterPrompt(node));
    vscode.commands.registerCommand("zowe.editSession", async (node) => datasetProvider.editSession(node));
    vscode.commands.registerCommand("zowe.ZoweNode.openPS", (node) => dsActions.openPS(node, true, datasetProvider));
    vscode.commands.registerCommand("zowe.createDataset", (node) => dsActions.createFile(node, datasetProvider));
    vscode.commands.registerCommand("zowe.all.profilelink", (node) => linkProfileDialog(node.getProfile()));
    vscode.commands.registerCommand("zowe.createMember", (node) => dsActions.createMember(node, datasetProvider));
    vscode.commands.registerCommand("zowe.deleteDataset", (node) => dsActions.deleteDataset(node, datasetProvider));
    vscode.commands.registerCommand("zowe.deletePDS", (node) => dsActions.deleteDataset(node, datasetProvider));
    vscode.commands.registerCommand("zowe.allocateLike", (node) => dsActions.allocateLike(datasetProvider, node));
    vscode.commands.registerCommand("zowe.uploadDialog", (node) => dsActions.uploadDialog(node, datasetProvider));
    vscode.commands.registerCommand("zowe.deleteMember", (node) => dsActions.deleteDataset(node, datasetProvider));
    vscode.commands.registerCommand("zowe.editMember", (node) => dsActions.openPS(node, false, datasetProvider));
    vscode.commands.registerCommand("zowe.removeSession", async (node) => datasetProvider.deleteSession(node));
    vscode.commands.registerCommand("zowe.removeFavorite", async (node) => datasetProvider.removeFavorite(node));
    vscode.commands.registerCommand("zowe.saveSearch", async (node) => datasetProvider.addFavorite(node));
    vscode.commands.registerCommand("zowe.removeSavedSearch", async (node) => datasetProvider.removeFavorite(node));
    vscode.commands.registerCommand("zowe.removeFavProfile", async (node) =>
        datasetProvider.removeFavProfile(node.label, true)
    );
    vscode.commands.registerCommand("zowe.submitJcl", async () => dsActions.submitJcl(datasetProvider));
    vscode.commands.registerCommand("zowe.submitMember", async (node) => dsActions.submitMember(node));
    vscode.commands.registerCommand("zowe.showDSAttributes", (node) =>
        dsActions.showDSAttributes(node, datasetProvider)
    );
    vscode.commands.registerCommand("zowe.renameDataSet", (node) => datasetProvider.rename(node));
    vscode.commands.registerCommand("zowe.copyDataSet", (node) => dsActions.copyDataSet(node));
    vscode.commands.registerCommand("zowe.pasteDataSet", (node) => dsActions.pasteDataSet(node, datasetProvider));
    vscode.commands.registerCommand("zowe.renameDataSetMember", (node) => datasetProvider.rename(node));
    vscode.commands.registerCommand("zowe.hMigrateDataSet", (node) => dsActions.hMigrateDataSet(node));
    vscode.commands.registerCommand("zowe.hRecallDataSet", (node) => dsActions.hRecallDataSet(node));
    vscode.commands.registerCommand("zowe.disableValidation", async (node) =>
        Profiles.getInstance().disableValidation(node)
    );
    vscode.commands.registerCommand("zowe.enableValidation", async (node) =>
        Profiles.getInstance().enableValidation(node)
    );
    vscode.commands.registerCommand("zowe.ssoLogin", async (node) => datasetProvider.ssoLogin(node));
    vscode.commands.registerCommand("zowe.ssoLogout", async (node) => datasetProvider.ssoLogout(node));
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
    vscode.commands.registerCommand("zowe.uss.refreshAll", () => ussActions.refreshAllUSS(ussFileProvider));
    vscode.commands.registerCommand("zowe.uss.refreshUSS", (node: IZoweUSSTreeNode) => node.refreshUSS());
    vscode.commands.registerCommand("zowe.uss.refreshUSSInTree", (node: IZoweUSSTreeNode) =>
        ussActions.refreshUSSInTree(node, ussFileProvider)
    );
    vscode.commands.registerCommand("zowe.uss.fullPath", (node: IZoweUSSTreeNode) =>
        ussFileProvider.filterPrompt(node)
    );
    vscode.commands.registerCommand("zowe.uss.editSession", async (node) => ussFileProvider.editSession(node));
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
    vscode.commands.registerCommand("zowe.uss.createNode", async (node: IZoweUSSTreeNode) =>
        ussActions.createUSSNodeDialog(node, ussFileProvider)
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
    vscode.commands.registerCommand("zowe.zosJobsOpenspool", (session, spool) =>
        jobActions.getSpoolContent(jobsProvider, session, spool)
    );
    vscode.commands.registerCommand("zowe.deleteJob", (job) => jobsProvider.delete(job));
    vscode.commands.registerCommand("zowe.runModifyCommand", (job) => jobActions.modifyCommand(job));
    vscode.commands.registerCommand("zowe.runStopCommand", (job) => jobActions.stopCommand(job));
    vscode.commands.registerCommand("zowe.refreshJobsServer", async (job) =>
        jobActions.refreshJobsServer(job, jobsProvider)
    );
    vscode.commands.registerCommand("zowe.refreshAllJobs", async () => jobActions.refreshAllJobs(jobsProvider));
    vscode.commands.registerCommand("zowe.addJobsSession", () => jobsProvider.createZoweSession(jobsProvider));
    vscode.commands.registerCommand("zowe.setOwner", (job) => jobActions.setOwner(job, jobsProvider));
    vscode.commands.registerCommand("zowe.setPrefix", (job) => jobActions.setPrefix(job, jobsProvider));
    vscode.commands.registerCommand("zowe.removeJobsSession", (job) => jobsProvider.deleteSession(job));
    vscode.commands.registerCommand("zowe.downloadSpool", (job) => jobActions.downloadSpool(job));
    vscode.commands.registerCommand("zowe.getJobJcl", (job) => jobActions.downloadJcl(job));
    vscode.commands.registerCommand("zowe.setJobSpool", async (session, jobid) => {
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
    vscode.commands.registerCommand("zowe.jobs.editSession", async (node) => jobsProvider.editSession(node));
    vscode.commands.registerCommand("zowe.issueTsoCmd", async () => MvsCommandHandler.getInstance().issueMvsCommand());
    vscode.commands.registerCommand("zowe.issueMvsCmd", async (node, command) =>
        MvsCommandHandler.getInstance().issueMvsCommand(node.session, command, node)
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
 * function to check if imperative.json contains
 * information about security or not and then
 * Imports the neccesary security modules
 */
export function getSecurityModules(moduleName): NodeRequire | undefined {
    let imperativeIsSecure: boolean = false;
    const r = typeof __webpack_require__ === "function" ? __non_webpack_require__ : require;
    try {
        const fileName = path.join(getZoweDir(), "settings", "imperative.json");
        let settings: any;
        if (fs.existsSync(fileName)) {
            settings = JSON.parse(fs.readFileSync(fileName).toString());
        }
        const value1 = settings?.overrides.CredentialManager;
        const value2 = settings?.overrides["credential-manager"];
        imperativeIsSecure =
            (typeof value1 === "string" && value1.length > 0) || (typeof value2 === "string" && value2.length > 0);
    } catch (error) {
        globals.LOG.warn(localize("profile.init.read.imperative", "Unable to read imperative file. ") + error.message);
        vscode.window.showWarningMessage(error.message);
        return undefined;
    }
    if (imperativeIsSecure) {
        // Workaround for Theia issue (https://github.com/eclipse-theia/theia/issues/4935)
        const appRoot = globals.ISTHEIA ? process.cwd() : vscode.env.appRoot;
        try {
            return r(`${appRoot}/node_modules/${moduleName}`);
        } catch (err) {
            /* Do nothing */
        }
        try {
            return r(`${appRoot}/node_modules.asar/${moduleName}`);
        } catch (err) {
            /* Do nothing */
        }
        vscode.window.showWarningMessage(
            localize("initialize.module.load", "Credentials not managed, unable to load security file: ") + moduleName
        );
    }
    return undefined;
}

/**
 * Moves temp folder to user defined location in preferences
 * @param previousTempPath temp path settings value before updated by user
 * @param currentTempPath temp path settings value after updated by user
 */
export function moveTempFolder(previousTempPath: string, currentTempPath: string) {
    // Re-define globals with updated path
    globals.defineGlobals(currentTempPath);

    if (previousTempPath === "") {
        previousTempPath = path.join(__dirname, "..", "..", "resources");
    }

    // Make certain that "temp" folder is cleared
    cleanTempDir();

    try {
        fs.mkdirSync(globals.ZOWETEMPFOLDER);
        fs.mkdirSync(globals.ZOWE_TMP_FOLDER);
        fs.mkdirSync(globals.USS_DIR);
        fs.mkdirSync(globals.DS_DIR);
    } catch (err) {
        globals.LOG.error(
            localize("moveTempFolder.error", "Error encountered when creating temporary folder! ") + JSON.stringify(err)
        );
        errorHandling(
            err,
            null,
            localize("moveTempFolder.error", "Error encountered when creating temporary folder! ") + err.message
        );
    }
    const previousTemp = path.join(previousTempPath, "temp");
    try {
        // If source and destination path are same, exit
        if (previousTemp === globals.ZOWETEMPFOLDER) {
            return;
        }

        // TODO: Possibly remove when supporting "Multiple Instances"
        // If a second instance has already moved the temp folder, exit
        // Ideally, `moveSync()` would alert user if path doesn't exist.
        // However when supporting "Multiple Instances", might not be possible.
        if (!fs.existsSync(previousTemp)) {
            return;
        }

        moveSync(previousTemp, globals.ZOWETEMPFOLDER, { overwrite: true });
    } catch (err) {
        globals.LOG.error("Error moving temporary folder! " + JSON.stringify(err));
        vscode.window.showErrorMessage(err.message);
    }
}

/**
 * Recursively deletes directory
 *
 * @param directory path to directory to be deleted
 */
export function cleanDir(directory) {
    if (!fs.existsSync(directory)) {
        return;
    }
    fs.readdirSync(directory).forEach((file) => {
        const fullpath = path.join(directory, file);
        const lstat = fs.lstatSync(fullpath);
        if (lstat.isFile()) {
            fs.unlinkSync(fullpath);
        } else {
            cleanDir(fullpath);
        }
    });
    fs.rmdirSync(directory);
}

/**
 * Cleans up local temp directory
 *
 * @export
 */
export async function cleanTempDir() {
    // logger hasn't necessarily been initialized yet, don't use the `log` in this function
    if (!fs.existsSync(globals.ZOWETEMPFOLDER)) {
        return;
    }
    try {
        cleanDir(globals.ZOWETEMPFOLDER);
    } catch (err) {
        vscode.window.showErrorMessage(localize("deactivate.error", "Unable to delete temporary folder. ") + err);
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
