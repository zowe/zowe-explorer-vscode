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
import * as os from "os";
import { moveSync } from "fs-extra";
import * as path from "path";
import * as vscode from "vscode";
import { IZoweDatasetTreeNode, IZoweJobTreeNode, IZoweTreeNode, IZoweUSSTreeNode, IZoweNodeType } from "./api/IZoweTreeNode";
import { IZoweTree } from "./api/IZoweTree";
import { Logger, TextUtils, IProfileLoaded, ImperativeConfig, Session, CredentialManagerFactory,
    ImperativeError, CliProfileManager } from "@zowe/imperative";
import { DatasetTree, createDatasetTree } from "./DatasetTree";
import { ZosJobsProvider, createJobsTree } from "./ZosJobsProvider";
import { Job } from "./ZoweJobNode";
import { createUSSTree, USSTree } from "./USSTree";
import * as ussActions from "./uss/ussNodeActions";
import * as mvsActions from "./mvs/mvsNodeActions";
import * as dsActions from "./dataset/dsNodeActions";
import * as jobActions from "./job/jobNodeActions";
import { MvsCommandHandler } from "./command/MvsCommandHandler";
import { Profiles } from "./Profiles";
import * as nls from "vscode-nls";
import * as utils from "./utils";
import SpoolProvider, { encodeJobFile } from "./SpoolProvider";
import { ZoweExplorerApiRegister } from "./api/ZoweExplorerApiRegister";
import { ZoweDatasetNode } from "./ZoweDatasetNode";
import { KeytarCredentialManager } from "./KeytarCredentialManager";
import { getIconByNode } from "./generators/icons";

// Localization support
const localize = nls.config({messageFormat: nls.MessageFormat.file})();

// Globals
export let ZOWETEMPFOLDER;
export let ZOWE_TMP_FOLDER;
export let USS_DIR;
export let DS_DIR;
export let ISTHEIA: boolean = false; // set during activate
export const FAV_SUFFIX = "_fav";
export const INFORMATION_CONTEXT = "information";
export const FAVORITE_CONTEXT = "favorite";
export const DS_FAV_CONTEXT = "ds_fav";
export const PDS_FAV_CONTEXT = "pds_fav";
export const DS_SESSION_CONTEXT = "session";
export const DS_PDS_CONTEXT = "pds";
export const DS_DS_CONTEXT = "ds";
export const DS_MEMBER_CONTEXT = "member";
export const DS_TEXT_FILE_CONTEXT = "textFile";
export const DS_FAV_TEXT_FILE_CONTEXT = "textFile_fav";
export const DS_BINARY_FILE_CONTEXT = "binaryFile";
export const DS_MIGRATED_FILE_CONTEXT = "migr";
export const USS_SESSION_CONTEXT = "uss_session";
export const USS_DIR_CONTEXT = "directory";
export const USS_FAV_DIR_CONTEXT = "directory_fav";
export const JOBS_SESSION_CONTEXT = "server";
export const JOBS_JOB_CONTEXT = "job";
export const JOBS_SPOOL_CONTEXT = "spool";
export const ICON_STATE_OPEN = "open";
export const ICON_STATE_CLOSED = "closed";

let usrNme: string;
let passWrd: string;
let baseEncd: string;
let validProfile: number = -1;
let log: Logger;

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
    const theia = "Eclipse Theia";
    const appName: string = vscode.env.appName;
    if (appName && appName === theia) {
        ISTHEIA = true;
    }

    defineGlobals(preferencesTempPath);

    // Call cleanTempDir before continuing
    // this is to handle if the application crashed on a previous execution and
    // VSC didn't get a chance to call our deactivate to cleanup.
    await deactivate();

    try {
        fs.mkdirSync(ZOWETEMPFOLDER);
        fs.mkdirSync(ZOWE_TMP_FOLDER);
        fs.mkdirSync(USS_DIR);
        fs.mkdirSync(DS_DIR);
    } catch (err) {
        await utils.errorHandling(err, null, err.message);
    }

    let datasetProvider: IZoweTree<IZoweDatasetTreeNode>;
    let ussFileProvider: IZoweTree<IZoweUSSTreeNode>;
    let jobsProvider: IZoweTree<IZoweJobTreeNode>;

    try {
        // Initialize Imperative Logger
        const loggerConfig = require(path.join(context.extensionPath, "log4jsconfig.json"));
        loggerConfig.log4jsConfig.appenders.default.filename = path.join(context.extensionPath, "logs", "imperative.log");
        loggerConfig.log4jsConfig.appenders.imperative.filename = path.join(context.extensionPath, "logs", "imperative.log");
        loggerConfig.log4jsConfig.appenders.app.filename = path.join(context.extensionPath, "logs", "zowe.log");
        Logger.initLogger(loggerConfig);

        log = Logger.getAppLogger();
        log.debug(localize("initialize.log.debug", "Initialized logger from VSCode extension"));

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
            } catch (err) {
                throw new ImperativeError({msg: err.toString()});
            }
        }

        // Ensure that ~/.zowe folder exists
        await CliProfileManager.initialize({
            configuration: zowe.getImperativeConfig().profiles,
            profileRootDirectory: path.join(getZoweDir(), "profiles"),
        });
        // Initialize profile manager
        await Profiles.createInstance(log);
        // Initialize dataset provider
        datasetProvider = await createDatasetTree(log);
        // Initialize uss provider
        ussFileProvider = await createUSSTree(log);
        // Initialize Jobs provider with the created session and the selected pattern
        jobsProvider = await createJobsTree(log);

    } catch (err) {
        await utils.errorHandling(err, null, (localize("initialize.log.error", "Error encountered while activating and initializing logger! ")));
        log.error(localize("initialize.log.error", "Error encountered while activating and initializing logger! ") + JSON.stringify(err));
    }

    const spoolProvider = new SpoolProvider();
    const providerRegistration = vscode.Disposable.from(
        vscode.workspace.registerTextDocumentContentProvider(SpoolProvider.scheme, spoolProvider)
    );
    context.subscriptions.push(spoolProvider, providerRegistration);

    if (datasetProvider) {
        vscode.commands.registerCommand("zowe.addSession", async () => addZoweSession(datasetProvider));
        vscode.commands.registerCommand("zowe.addFavorite", async (node) => datasetProvider.addFavorite(node));
        vscode.commands.registerCommand("zowe.refreshAll", () => dsActions.refreshAll(datasetProvider));
        vscode.commands.registerCommand("zowe.refreshNode", (node) => refreshPS(node));
        vscode.commands.registerCommand("zowe.pattern", (node) => datasetProvider.filterPrompt(node));
        vscode.commands.registerCommand("zowe.ZoweNode.openPS", (node) => openPS(node, true, datasetProvider));
        vscode.workspace.onDidSaveTextDocument(async (savedFile) => {
            log.debug(localize("onDidSaveTextDocument1",
                "File was saved -- determining whether the file is a USS file or Data set.\n Comparing (case insensitive) ") +
                savedFile.fileName +
                localize("onDidSaveTextDocument2", " against directory ") +
                DS_DIR + localize("onDidSaveTextDocument3", "and") + USS_DIR);
            if (savedFile.fileName.toUpperCase().indexOf(DS_DIR.toUpperCase()) >= 0) {
                log.debug(localize("activate.didSaveText.isDataSet", "File is a data set-- saving "));
                await saveFile(savedFile, datasetProvider); // TODO MISSED TESTING
            } else if (savedFile.fileName.toUpperCase().indexOf(USS_DIR.toUpperCase()) >= 0) {
                log.debug(localize("activate.didSaveText.isUSSFile", "File is a USS file -- saving"));
                await saveFile(savedFile, ussFileProvider); // TODO MISSED TESTING
            } else {
                log.debug(localize("activate.didSaveText.file", "File ") + savedFile.fileName +
                    localize("activate.didSaveText.notDataSet", " is not a data set or USS file "));
            }
        });
        vscode.commands.registerCommand("zowe.createDataset", (node) => createFile(node, datasetProvider));
        vscode.commands.registerCommand("zowe.createMember", (node) => createMember(node, datasetProvider));
        vscode.commands.registerCommand("zowe.deleteDataset", (node) => deleteDataset(node, datasetProvider));
        vscode.commands.registerCommand("zowe.deletePDS", (node) => deleteDataset(node, datasetProvider));
        vscode.commands.registerCommand("zowe.uploadDialog", (node) => mvsActions.uploadDialog(node, datasetProvider));
        vscode.commands.registerCommand("zowe.deleteMember", (node) => deleteDataset(node, datasetProvider));
        vscode.commands.registerCommand("zowe.editMember", (node) => openPS(node, false, datasetProvider));
        vscode.commands.registerCommand("zowe.removeSession", async (node) => datasetProvider.deleteSession(node));
        vscode.commands.registerCommand("zowe.removeFavorite", async (node) => datasetProvider.removeFavorite(node));
        vscode.commands.registerCommand("zowe.saveSearch", async (node) => datasetProvider.addFavorite(node));
        vscode.commands.registerCommand("zowe.removeSavedSearch", async (node) => datasetProvider.removeFavorite(node));
        vscode.commands.registerCommand("zowe.submitJcl", async () => submitJcl(datasetProvider));
        vscode.commands.registerCommand("zowe.submitMember", async (node) => submitMember(node));
        vscode.commands.registerCommand("zowe.showDSAttributes", (node) => showDSAttributes(node, datasetProvider));
        vscode.commands.registerCommand("zowe.renameDataSet", (node) => datasetProvider.rename(node));
        vscode.commands.registerCommand("zowe.copyDataSet", (node) => copyDataSet(node));
        vscode.commands.registerCommand("zowe.pasteDataSet", (node) => pasteDataSet(node, datasetProvider));
        vscode.commands.registerCommand("zowe.renameDataSetMember", (node) => datasetProvider.rename(node));
        vscode.commands.registerCommand("zowe.hMigrateDataSet", (node) => hMigrateDataSet(node));
        vscode.workspace.onDidChangeConfiguration(async (e) => {
            datasetProvider.onDidChangeConfiguration(e);
        });
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("Zowe-Temp-Folder-Location")) {
                const updatedPreferencesTempPath: string =
                    vscode.workspace.getConfiguration()
                        /* tslint:disable:no-string-literal */
                        .get("Zowe-Temp-Folder-Location")["folderPath"];
                moveTempFolder(preferencesTempPath, updatedPreferencesTempPath);
                // Update current temp folder preference
                preferencesTempPath = updatedPreferencesTempPath;
            }
        });
        // Attaches the TreeView as a subscriber to the refresh event of datasetProvider
        const theTreeView = datasetProvider.getTreeView();
        context.subscriptions.push(theTreeView);
        if (!ISTHEIA) {
            theTreeView.onDidCollapseElement(async (e) => {
                datasetProvider.flipState(e.element, false);
            });
            theTreeView.onDidExpandElement(async (e) => {
                datasetProvider.flipState(e.element, true);
            });
        }
    }
    if (ussFileProvider) {
        vscode.commands.registerCommand("zowe.uss.addFavorite", async (node: IZoweUSSTreeNode) => ussFileProvider.addFavorite(node));
        vscode.commands.registerCommand("zowe.uss.removeFavorite", async (node: IZoweUSSTreeNode) => ussFileProvider.removeFavorite(node));
        vscode.commands.registerCommand("zowe.uss.addSession", async () => addZoweSession(ussFileProvider));
        vscode.commands.registerCommand("zowe.uss.refreshAll", () => ussActions.refreshAllUSS(ussFileProvider));
        vscode.commands.registerCommand("zowe.uss.refreshUSS", (node: IZoweUSSTreeNode) => node.refreshUSS());
        vscode.commands.registerCommand("zowe.uss.refreshUSSInTree", (node: IZoweUSSTreeNode) => refreshUSSInTree(node, ussFileProvider));
        vscode.commands.registerCommand("zowe.uss.fullPath", (node: IZoweUSSTreeNode) => ussFileProvider.filterPrompt(node));
        vscode.commands.registerCommand("zowe.uss.ZoweUSSNode.open", (node: IZoweUSSTreeNode) => node.openUSS(false, true, ussFileProvider));
        vscode.commands.registerCommand("zowe.uss.removeSession", async (node: IZoweUSSTreeNode) => ussFileProvider.deleteSession(node));
        vscode.commands.registerCommand("zowe.uss.createFile", async (node: IZoweUSSTreeNode) =>
            ussActions.createUSSNode(node, ussFileProvider, "file"));
        vscode.commands.registerCommand("zowe.uss.createFolder", async (node: IZoweUSSTreeNode) =>
            ussActions.createUSSNode(node, ussFileProvider, "directory"));
        vscode.commands.registerCommand("zowe.uss.deleteNode", async (node: IZoweUSSTreeNode) =>
                                                                         node.deleteUSSNode(ussFileProvider, node.getUSSDocumentFilePath()));
        vscode.commands.registerCommand("zowe.uss.binary", async (node: IZoweUSSTreeNode) => changeFileType(node, true, ussFileProvider));
        vscode.commands.registerCommand("zowe.uss.text", async (node: IZoweUSSTreeNode) => changeFileType(node, false, ussFileProvider));
        vscode.commands.registerCommand("zowe.uss.renameNode", async (node: IZoweUSSTreeNode) => ussFileProvider.rename(node));
        vscode.commands.registerCommand("zowe.uss.uploadDialog", async (node: IZoweUSSTreeNode) => ussActions.uploadDialog(node, ussFileProvider));
        vscode.commands.registerCommand("zowe.uss.createNode", async (node: IZoweUSSTreeNode) =>
                                                                            ussActions.createUSSNodeDialog(node, ussFileProvider));
        vscode.commands.registerCommand("zowe.uss.copyPath", async (node: IZoweUSSTreeNode) => ussActions.copyPath(node));
        vscode.commands.registerCommand("zowe.uss.editFile", (node: IZoweUSSTreeNode) => node.openUSS(false, false, ussFileProvider));
        vscode.commands.registerCommand("zowe.uss.saveSearch", async (node: IZoweUSSTreeNode) => node.saveSearch(ussFileProvider));
        vscode.commands.registerCommand("zowe.uss.removeSavedSearch", async (node: IZoweUSSTreeNode) => ussFileProvider.removeFavorite(node));
        vscode.workspace.onDidChangeConfiguration(async (e) => {
            ussFileProvider.onDidChangeConfiguration(e);
        });
        const theTreeView = ussFileProvider.getTreeView();
        context.subscriptions.push(theTreeView);
        if (!ISTHEIA) {
            theTreeView.onDidCollapseElement(async (e) => {
                ussFileProvider.flipState(e.element, false);
            });
            theTreeView.onDidExpandElement(async (e) => {
                ussFileProvider.flipState(e.element, true);
            });
        }
    }

    if (jobsProvider) {
        vscode.commands.registerCommand("zowe.zosJobsOpenspool", (session, spool) => {
            getSpoolContent(session, spool);
        });
        vscode.commands.registerCommand("zowe.deleteJob", (job) => jobsProvider.delete(job));
        vscode.commands.registerCommand("zowe.runModifyCommand", (job) => {
            modifyCommand(job);
        });
        vscode.commands.registerCommand("zowe.runStopCommand", (job) => {
            stopCommand(job);
        });
        vscode.commands.registerCommand("zowe.refreshJobsServer", async (node) => refreshJobsServer(node, jobsProvider));
        vscode.commands.registerCommand("zowe.refreshAllJobs", async () => jobActions.refreshAllJobs(jobsProvider));

        vscode.commands.registerCommand("zowe.addJobsSession", () => addZoweSession(jobsProvider));
        vscode.commands.registerCommand("zowe.setOwner", (node) => {
            setOwner(node, jobsProvider);
        });
        vscode.commands.registerCommand("zowe.setPrefix", (node) => {
            setPrefix(node, jobsProvider);
        });
        vscode.commands.registerCommand("zowe.removeJobsSession", (node) => jobsProvider.deleteSession(node));
        vscode.commands.registerCommand("zowe.downloadSpool", (job) => downloadSpool(job));
        vscode.commands.registerCommand("zowe.getJobJcl", (job) => {
            downloadJcl(job);
        });
        vscode.commands.registerCommand("zowe.setJobSpool", async (session, jobid) => {
            const sessionNode = jobsProvider.mSessionNodes.find((jobNode) => {
                return jobNode.label.trim() === session.trim();
            });
            sessionNode.dirty = true;
            jobsProvider.refresh();
            const jobs: IZoweJobTreeNode[] = await sessionNode.getChildren();
            const job: IZoweJobTreeNode = jobs.find((jobNode) => {
                return jobNode.job.jobid === jobid;
            });
            jobsProvider.setItem(theTreeView, job);
        });
        vscode.commands.registerCommand("zowe.jobs.search", (node) => jobsProvider.filterPrompt(node));
        vscode.commands.registerCommand("zowe.issueTsoCmd", async () => MvsCommandHandler.getInstance().issueMvsCommand());
        vscode.commands.registerCommand("zowe.issueMvsCmd", async (node, command) =>
            MvsCommandHandler.getInstance().issueMvsCommand(node.session, command));
        vscode.workspace.onDidChangeConfiguration(async (e) => {
            jobsProvider.onDidChangeConfiguration(e);
        });
        vscode.commands.registerCommand("zowe.jobs.addFavorite", async (node) => jobsProvider.addFavorite(node));
        vscode.commands.registerCommand("zowe.jobs.removeFavorite", async (node) => jobsProvider.removeFavorite(node));
        vscode.commands.registerCommand("zowe.jobs.saveSearch", async (node) => jobsProvider.saveSearch(node));
        vscode.commands.registerCommand("zowe.jobs.removeSearchFavorite", async (node) => jobsProvider.removeFavorite(node));
        const theTreeView = jobsProvider.getTreeView();
        context.subscriptions.push(theTreeView);
        if (!ISTHEIA) {
            theTreeView.onDidCollapseElement( async (e: { element: IZoweJobTreeNode; }) => {
                jobsProvider.flipState(e.element, false);
            });
            theTreeView.onDidExpandElement( async (e: { element: IZoweJobTreeNode; }) => {
                jobsProvider.flipState(e.element, true);
            });
        }
    }

    // return the Extension's API to other extensions that want to register their APIs.
    return ZoweExplorerApiRegister.getInstance();
}

/**
 * Defines all global variables
 * @param tempPath File path for temporary folder defined in preferences
 */
export function defineGlobals(tempPath: string | undefined) {
    tempPath !== "" && tempPath !== undefined ?
        ZOWETEMPFOLDER = path.join(tempPath, "temp") :
        ZOWETEMPFOLDER = path.join(__dirname, "..", "..", "resources", "temp");

    ZOWE_TMP_FOLDER = path.join(ZOWETEMPFOLDER, "tmp");
    USS_DIR = path.join(ZOWETEMPFOLDER, "_U_");
    DS_DIR = path.join(ZOWETEMPFOLDER, "_D_");
}

/**
 * function to check if imperative.json contains
 * information about security or not and then
 * Imports the neccesary security modules
 */
export function getSecurityModules(moduleName): NodeRequire | undefined {
    let imperativeIsSecure: boolean = false;
    try {
        const fileName = path.join(getZoweDir(), "settings", "imperative.json");
        let settings: any;
        if (fs.existsSync(fileName)) {
            settings = JSON.parse(fs.readFileSync(fileName).toString());
        }
        const value1 = settings?.overrides.CredentialManager;
        const value2 = settings?.overrides["credential-manager"];
        imperativeIsSecure = ((typeof value1 === "string") && (value1.length > 0)) ||
            ((typeof value2 === "string") && (value2.length > 0));
    } catch (error) {
        log.warn(localize("profile.init.read.imperative", "Unable to read imperative file. ") + error.message);
        vscode.window.showWarningMessage(error.message);
        return undefined;
    }
    if (imperativeIsSecure) {
        // Workaround for Theia issue (https://github.com/eclipse-theia/theia/issues/4935)
        const appRoot = ISTHEIA ? process.cwd() : vscode.env.appRoot;
        try {
            return require(`${appRoot}/node_modules/${moduleName}`);
        } catch (err) { /* Do nothing */ }
        try {
            return require(`${appRoot}/node_modules.asar/${moduleName}`);
        } catch (err) { /* Do nothing */ }
        vscode.window.showWarningMessage(localize("initialize.module.load",
            "Credentials not managed, unable to load security file: ") + moduleName);
    }
    return undefined;
}

/**
 * Function to retrieve the home directory. In the situation Imperative has
 * not initialized it we mock a default value.
 */
export function getZoweDir(): string {
    ImperativeConfig.instance.loadedConfig = {
        defaultHome: path.join(os.homedir(), ".zowe"),
        envVariablePrefix: "ZOWE"
    };
    return ImperativeConfig.instance.cliHome;
}

/**
 * Moves temp folder to user defined location in preferences
 * @param previousTempPath temp path settings value before updated by user
 * @param currentTempPath temp path settings value after updated by user
 */
export function moveTempFolder(previousTempPath: string, currentTempPath: string) {
    // Re-define globals with updated path
    defineGlobals(currentTempPath);

    if (previousTempPath === "") {
        previousTempPath = path.join(__dirname, "..", "..", "resources");
    }

    // Make certain that "temp" folder is cleared
    cleanTempDir();

    try {
        fs.mkdirSync(ZOWETEMPFOLDER);
        fs.mkdirSync(ZOWE_TMP_FOLDER);
        fs.mkdirSync(USS_DIR);
        fs.mkdirSync(DS_DIR);
    } catch (err) {
        log.error(localize("moveTempFolder.error", "Error encountered when creating temporary folder! ") + JSON.stringify(err));
        utils.errorHandling(err, null, localize("moveTempFolder.error", "Error encountered when creating temporary folder! ") + err.message);
    }
    const previousTemp = path.join(previousTempPath, "temp");
    try {
        // If source and destination path are same, exit
        if (previousTemp === ZOWETEMPFOLDER) {
            return;
        }

        // TODO: Possibly remove when supporting "Multiple Instances"
        // If a second instance has already moved the temp folder, exit
        // Ideally, `moveSync()` would alert user if path doesn't exist.
        // However when supporting "Multiple Instances", might not be possible.
        if (!fs.existsSync(previousTemp)) {
            return;
        }

        moveSync(previousTemp, ZOWETEMPFOLDER, { overwrite: true });
    } catch (err) {
        log.error("Error moving temporary folder! " + JSON.stringify(err));
        vscode.window.showErrorMessage(err.message);
    }
}

/**
 * Download all the spool content for the specified job.
 *
 * @param job The job to download the spool content from
 */
export async function downloadSpool(job: IZoweJobTreeNode){
    try {
        const dirUri = await vscode.window.showOpenDialog({
            openLabel: localize("downloadSpool.select", "Select"),
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false
        });
        if (dirUri !== undefined) {
            ZoweExplorerApiRegister.getJesApi(job.getProfile()).downloadSpoolContent({
                jobid: job.job.jobid,
                jobname: job.job.jobname,
                outDir: dirUri[0].fsPath
            });
        }
    } catch (error) {
        await utils.errorHandling(error, null, error.message);
    }

}

export async function downloadJcl(job: Job) {
    try {
        const jobJcl = await ZoweExplorerApiRegister.getJesApi(job.getProfile()).getJclForJob(job.job);
        const jclDoc = await vscode.workspace.openTextDocument({language: "jcl", content: jobJcl});
        await vscode.window.showTextDocument(jclDoc);
    } catch (error) {
        await utils.errorHandling(error, null, error.message);
    }
}

/**
 * Switch the download type and redownload the file.
 *
 * @param node The file that is going to be downloaded
 * @param binary Whether the file should be downloaded as binary or not
 * @param ussFileProvider Our USSTree object
 */
export async function changeFileType(node: IZoweUSSTreeNode, binary: boolean, ussFileProvider: IZoweTree<IZoweUSSTreeNode>) {
    node.setBinary(binary);
    await node.openUSS(true, true, ussFileProvider);
    ussFileProvider.refresh();
}

/**
 * Submit the contents of the editor as JCL.
 *
 * @export
 * @param {DatasetTree} datasetProvider - our DatasetTree object
 */
export async function submitJcl(datasetProvider: IZoweTree<IZoweDatasetTreeNode>) {
    if (!vscode.window.activeTextEditor) {
        vscode.window.showErrorMessage(
            localize("submitJcl.noDocumentOpen", "No editor with a document that could be submitted as JCL is currently open."));
        return;
    }
    const doc = vscode.window.activeTextEditor.document;
    log.debug(localize("submitJcl.log.debug", "Submitting JCL in document ") + doc.fileName);
    // get session name
    const sessionregex = /\[(.*)(\])(?!.*\])/g;
    const regExp = sessionregex.exec(doc.fileName);
    const profiles = await Profiles.getInstance();
    let sessProfileName;
    if (regExp === null) {
        const allProfiles: IProfileLoaded[] = profiles.allProfiles;
        const profileNamesList = allProfiles.map((profile) => {
            return profile.name;
        });
        if (profileNamesList.length) {
            const quickPickOptions: vscode.QuickPickOptions = {
                placeHolder: localize("submitJcl.quickPickOption", "Select the Profile to use to submit the job"),
                ignoreFocusOut: true,
                canPickMany: false
            };
            sessProfileName = await vscode.window.showQuickPick(profileNamesList, quickPickOptions);
        } else {
            vscode.window.showInformationMessage(localize("submitJcl.noProfile", "No profiles available"));
        }
    } else {
        sessProfileName = regExp[1];
        if (sessProfileName.includes("[")) {
            // if submitting from favorites, sesName might be the favorite node, so extract further
            sessProfileName = sessionregex.exec(sessProfileName)[1];
        }
    }

    // get profile from session name
    let sessProfile: IProfileLoaded;
    const sesNode = (await datasetProvider.getChildren()).find((child) => child.label.trim() === sessProfileName);
    if (sesNode) {
        sessProfile = sesNode.getProfile();
    } else {
        // if submitting from favorites, a session might not exist for this node
        sessProfile = profiles.loadNamedProfile(sessProfileName);
    }
    if (sessProfile == null) {
        log.error(localize("submitJcl.log.error.nullSession", "Session for submitting JCL was null or undefined!"));
        return;
    }
    try {
        const job = await ZoweExplorerApiRegister.getJesApi(sessProfile).submitJcl(doc.getText());
        const args = [sessProfileName, job.jobid];
        const setJobCmd = `command:zowe.setJobSpool?${encodeURIComponent(JSON.stringify(args))}`;
        vscode.window.showInformationMessage(localize("submitJcl.jobSubmitted", "Job submitted ") + `[${job.jobid}](${setJobCmd})`);
    } catch (error) {
        await utils.errorHandling(error, sessProfileName, localize("submitJcl.jobSubmissionFailed", "Job submission failed\n") + error.message);
    }
}

/**
 * Submit the selected dataset member as a Job.
 *
 * @export
 * @param node The dataset member
 */
export async function submitMember(node: IZoweTreeNode) {
    const labelregex = /\[(.+)\]\: (.+)/g;
    let label;
    let sesName;
    let sessProfile;
    let regex;
    const profiles = await Profiles.getInstance();
    switch (node.getParent().contextValue) {
        case (FAVORITE_CONTEXT):
            regex = labelregex.exec(node.getLabel());
            sesName = regex[1];
            label = regex[2];
            sessProfile = profiles.loadNamedProfile(sesName);
            break;
        case (DS_PDS_CONTEXT + FAV_SUFFIX):
            regex = labelregex.exec(node.getParent().getLabel());
            sesName = regex[1];
            label = regex[2] + "(" + node.label.trim()+ ")";
            sessProfile = node.getParent().getProfile();
            break;
        case (DS_SESSION_CONTEXT):
            sesName = node.getParent().getLabel();
            label = node.label;
            sessProfile = node.getParent().getProfile();
            break;
        case (DS_PDS_CONTEXT):
            sesName = node.getParent().getParent().getLabel();
            label = node.getParent().getLabel() + "(" + node.label.trim()+ ")";
            sessProfile = node.getParent().getParent().getProfile();
            break;
        default:
            vscode.window.showErrorMessage(localize("submitMember.invalidNode", "submitMember() called from invalid node."));
            throw Error(localize("submitMember.error.invalidNode", "submitMember() called from invalid node."));
    }
    try {
        const job = await ZoweExplorerApiRegister.getJesApi(sessProfile).submitJob(label);
        const args = [sesName, job.jobid];
        const setJobCmd = `command:zowe.setJobSpool?${encodeURIComponent(JSON.stringify(args))}`;
        vscode.window.showInformationMessage(localize("submitMember.jobSubmitted", "Job submitted ") + `[${job.jobid}](${setJobCmd})`);
    } catch (error) {
        await utils.errorHandling(error, sesName, localize("submitMember.jobSubmissionFailed", "Job submission failed\n") + error.message);
    }
}

/**
 * Adds a new Profile to the provided treeview by clicking the 'Plus' button and
 * selecting which profile you would like to add from the drop-down that appears.
 * The profiles that are in the tree view already will not appear in the
 * drop-down.
 *
 * @export
 * @param {USSTree} zoweFileProvider - either the USS, MVS, JES tree
 */
export async function addZoweSession(zoweFileProvider: IZoweTree<IZoweDatasetTreeNode>) {

    const allProfiles = (await Profiles.getInstance()).allProfiles;
    const createNewProfile = "Create a New Connection to z/OS";
    let chosenProfile: string;

    // Get all profiles
    let profileNamesList = allProfiles.map((profile) => {
        return profile.name;
    });
    // Filter to list of the APIs available for current tree explorer
    profileNamesList = profileNamesList.filter((profileName) => {
        const profile = Profiles.getInstance().loadNamedProfile(profileName);
        if (zoweFileProvider instanceof USSTree) {
            const ussProfileTypes = ZoweExplorerApiRegister.getInstance().registeredUssApiTypes();
            return ussProfileTypes.includes(profile.type);
        }
        if (zoweFileProvider instanceof DatasetTree) {
            const mvsProfileTypes = ZoweExplorerApiRegister.getInstance().registeredMvsApiTypes();
            return mvsProfileTypes.includes(profile.type);
        }
        if (zoweFileProvider instanceof ZosJobsProvider) {
            const jesProfileTypes = ZoweExplorerApiRegister.getInstance().registeredJesApiTypes();
            return jesProfileTypes.includes(profile.type);
        }
    });
    if (profileNamesList) {
        profileNamesList = profileNamesList.filter((profileName) =>
            // Find all cases where a profile is not already displayed
            !zoweFileProvider.mSessionNodes.find((sessionNode) =>
                sessionNode.getProfileName() === profileName
            )
        );
    }
    const createPick = new utils.FilterDescriptor("\uFF0B " + createNewProfile);
    const items: vscode.QuickPickItem[] = profileNamesList.map((element) => new utils.FilterItem(element));
    const quickpick = vscode.window.createQuickPick();
    const placeholder = localize("addSession.quickPickOption",
        "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the USS Explorer");

    if (ISTHEIA) {
        const options: vscode.QuickPickOptions = {
            placeHolder: placeholder
        };
        // get user selection
        const choice = (await vscode.window.showQuickPick([createPick, ...items], options));
        if (!choice) {
            vscode.window.showInformationMessage(localize("enterPattern.pattern", "No selection made."));
            return;
        }
        chosenProfile = choice === createPick ? "" : choice.label;
    } else {
        quickpick.items = [createPick, ...items];
        quickpick.placeholder = placeholder;
        quickpick.ignoreFocusOut = true;
        quickpick.show();
        const choice = await utils.resolveQuickPickHelper(quickpick);
        quickpick.hide();
        if (!choice) {
            vscode.window.showInformationMessage(localize("enterPattern.pattern", "No selection made."));
            return;
        }
        if (choice instanceof utils.FilterDescriptor) {
            chosenProfile = "";
        } else {
            chosenProfile = choice.label;
        }
    }

    if (chosenProfile === "") {
        let newprofile: any;
        let profileName: string;
        if (quickpick.value) {
            profileName = quickpick.value;
        }

        const options = {
            placeHolder: localize("createNewConnection.option.prompt.profileName.placeholder", "Connection Name"),
            prompt: localize("createNewConnection.option.prompt.profileName", "Enter a name for the connection"),
            value: profileName
        };
        profileName = await vscode.window.showInputBox(options);
        if (!profileName) {
            vscode.window.showInformationMessage(localize("createNewConnection.enterprofileName",
                "Profile Name was not supplied. Operation Cancelled"));
            return;
        }
        chosenProfile = profileName;
        log.debug(localize("addSession.log.debug.createNewProfile", "User created a new profile"));
        try {
            newprofile = await Profiles.getInstance().createNewConnection(chosenProfile);
        } catch (error) {
            await utils.errorHandling(error, chosenProfile, error.message);
        }
        if (newprofile) {
            try {
                await Profiles.getInstance().refresh();
            } catch (error) {
                await utils.errorHandling(error, newprofile, error.message);
            }
            await zoweFileProvider.addSession(newprofile);
            await zoweFileProvider.refresh();
        }
    } else if (chosenProfile) {
        log.debug(localize("addZoweSession.log.debug.selectProfile", "User selected profile ") + chosenProfile);
        await zoweFileProvider.addSession(chosenProfile);
    } else {
        log.debug(localize("addZoweSession.log.debug.cancelledSelection", "User cancelled profile selection"));
    }
}

/**
 * Creates a new file and uploads to the server
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 * TODO: Consider changing configuration to allow "custom" data set specifications
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 * @export
 * @param {IZoweDatasetTreeNode} node - Desired Zowe session
 * @param {DatasetTree} datasetProvider - the tree which contains the nodes
 */
export async function createFile(node: IZoweDatasetTreeNode, datasetProvider: IZoweTree<IZoweDatasetTreeNode>) {
    const quickPickOptions: vscode.QuickPickOptions = {
        placeHolder: localize("createFile.quickPickOption.dataSetType", "Type of Data Set to be Created"),
        ignoreFocusOut: true,
        canPickMany: false
    };
    const types = [
        localize("createFile.dataSetBinary", "Data Set Binary"),
        localize("createFile.dataSetC", "Data Set C"),
        localize("createFile.dataSetClassic", "Data Set Classic"),
        localize("createFile.dataSetPartitioned", "Data Set Partitioned"),
        localize("createFile.dataSetSequential", "Data Set Sequential")
    ];
    let sesNamePrompt: string;
    if (node.contextValue.endsWith(FAV_SUFFIX)) {
        sesNamePrompt = node.label.substring(1, node.label.indexOf("]"));
    } else {
        sesNamePrompt = node.label;
    }

    if ((!node.getSession().ISession.user) || (!node.getSession().ISession.password)) {
        try {
            const values = await Profiles.getInstance().promptCredentials(sesNamePrompt);
            if (values !== undefined) {
                usrNme = values[0];
                passWrd = values[1];
                baseEncd = values[2];
            }
        } catch (error) {
            await utils.errorHandling(error, node.getProfileName(), error.message);
        }
        if (usrNme !== undefined && passWrd !== undefined && baseEncd !== undefined) {
            node.getSession().ISession.user = usrNme;
            node.getSession().ISession.password = passWrd;
            node.getSession().ISession.base64EncodedAuth = baseEncd;
            validProfile = 0;
        } else {
            return;
        }
        await datasetProvider.refreshElement(node);
        await datasetProvider.refresh();
    } else {
        validProfile = 0;
    }
    if (validProfile === 0) {
        // get data set type
        const type = await vscode.window.showQuickPick(types, quickPickOptions);
        if (type == null) {
            log.debug(localize("createFile.log.debug.noValidTypeSelected", "No valid data type selected"));
            return;
        } else {
            log.debug(localize("createFile.log.debug.creatingNewDataSet", "Creating new data set"));
        }

        let typeEnum;
        let createOptions;
        switch (type) {
            case localize("createFile.dataSetBinary", "Data Set Binary"):
                typeEnum = zowe.CreateDataSetTypeEnum.DATA_SET_BINARY;
                createOptions = vscode.workspace.getConfiguration("Zowe-Default-Datasets-Binary");
                break;
            case localize("createFile.dataSetC", "Data Set C"):
                typeEnum = zowe.CreateDataSetTypeEnum.DATA_SET_C;
                createOptions = vscode.workspace.getConfiguration("Zowe-Default-Datasets-C");
                break;
            case localize("createFile.dataSetClassic", "Data Set Classic"):
                typeEnum = zowe.CreateDataSetTypeEnum.DATA_SET_CLASSIC;
                createOptions = vscode.workspace.getConfiguration("Zowe-Default-Datasets-Classic");
                break;
            case localize("createFile.dataSetPartitioned", "Data Set Partitioned"):
                typeEnum = zowe.CreateDataSetTypeEnum.DATA_SET_PARTITIONED;
                createOptions = vscode.workspace.getConfiguration("Zowe-Default-Datasets-PDS");
                break;
            case localize("createFile.dataSetSequential", "Data Set Sequential"):
                typeEnum = zowe.CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL;
                createOptions = vscode.workspace.getConfiguration("Zowe-Default-Datasets-PS");
                break;
        }

        // get name of data set
        let name = await vscode.window.showInputBox({placeHolder: localize("dataset.name", "Name of Data Set")});
        name = name.toUpperCase();

        try {
            await ZoweExplorerApiRegister.getMvsApi(node.getProfile()).createDataSet(typeEnum, name, createOptions);
            node.dirty = true;

            // Store previous filters (before refreshing)
            const currChildren = await node.getChildren();
            let theFilter = datasetProvider.getHistory()[0] || null;

            // Check if filter is currently applied
            if (currChildren[0].contextValue !== "information" && theFilter) {
                const currentFilters = theFilter.split(",");

                // Check if current filter includes the new node
                const matchedFilters = currentFilters.filter((filter) => {
                    const regex = new RegExp(filter.trim().replace(`*`, "") + "(.*)$");
                    return regex.test(name);
                });

                if (matchedFilters.length === 0) {
                    // remove the last segement with a dot of the name for the new filter
                    const newFilterBase = name.replace(/\.(?:.(?!\.))+$/, "");
                    theFilter = `${theFilter},${newFilterBase}.*`;
                    datasetProvider.addHistory(theFilter);
                }
            } else {
                // No filter is currently applied
                theFilter = name;
                datasetProvider.addHistory(theFilter);
            }

            datasetProvider.refresh();

            // Show newly-created data set in expanded tree view
            if (name) {
                node.label = `${node.label} `;
                node.label = node.label.trim();
                node.tooltip = node.pattern = theFilter.toUpperCase();
                node.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
                const icon = getIconByNode(node);
                if (icon) {
                    node.iconPath = icon.path;
                }
                node.dirty = true;

                const newNode = await node.getChildren().then((children) => children.find((child) => child.label === name));
                datasetProvider.getTreeView().reveal(newNode, {select: true});
            }
        } catch (err) {
            log.error(localize("createDataSet.error", "Error encountered when creating data set! ") + JSON.stringify(err));
            await utils.errorHandling(err, node.getProfileName(), localize("createDataSet.error", "Error encountered when creating data set! ") +
                err.message);
            throw (err);
        }
    }
}

/**
 * Creates a PDS member
 *
 * @export
 * @param {IZoweDatasetTreeNode} parent - The parent Node
 * @param {DatasetTree} datasetProvider - the tree which contains the nodes
 */
export async function createMember(parent: IZoweDatasetTreeNode, datasetProvider: IZoweTree<IZoweDatasetTreeNode>) {
    const name = await vscode.window.showInputBox({ placeHolder: localize("createMember.inputBox", "Name of Member") });
    log.debug(localize("createMember.log.debug.createNewDataSet", "creating new data set member of name ") + name);
    if (name) {
        let label = parent.label.trim();
        if (parent.contextValue === DS_PDS_CONTEXT + FAV_SUFFIX) {
            label = parent.label.substring(parent.label.indexOf(":") + 2); // TODO MISSED TESTING
        }

        try {
            await ZoweExplorerApiRegister.getMvsApi(parent.getProfile()).createDataSetMember(label + "(" + name + ")");
        } catch (err) {
            log.error(localize("createMember.log.error", "Error encountered when creating member! ") + JSON.stringify(err));
            await utils.errorHandling(err, label, localize("createMember.error", "Unable to create member: ") + err.message);
            throw (err);
        }
        parent.dirty = true;
        datasetProvider.refreshElement(parent);
        openPS(
            new ZoweDatasetNode(name, vscode.TreeItemCollapsibleState.None, parent, null, undefined, undefined, parent.getProfile()),
            true, datasetProvider);
        datasetProvider.refresh();
    }
}


/**
 * Shows data set attributes in a new text editor
 *
 * @export
 * @param {IZoweDatasetTreeNode} parent - The parent Node
 * @param {DatasetTree} datasetProvider - the tree which contains the nodes
 */
export async function showDSAttributes(parent: IZoweDatasetTreeNode, datasetProvider: IZoweTree<IZoweDatasetTreeNode>) {

    let label = parent.label.trim();
    if (parent.contextValue === DS_PDS_CONTEXT + FAV_SUFFIX || parent.contextValue === DS_DS_CONTEXT + FAV_SUFFIX) {
        label = parent.label.trim().substring(parent.label.trim().indexOf(":") + 2);
    }

    log.debug(localize("showDSAttributes.debug", "showing attributes of data set ") + label);
    let attributes: any;
    try {
        attributes = await ZoweExplorerApiRegister.getMvsApi(parent.getProfile()).dataSet(label, { attributes: true });
        attributes = attributes.apiResponse.items;
        attributes = attributes.filter((dataSet) => {
            return dataSet.dsname.toUpperCase() === label.toUpperCase();
        });
        if (attributes.length === 0) {
            throw new Error(localize("showDSAttributes.lengthError", "No matching data set names found for query: ") + label);
        }
    } catch (err) {
        log.error(localize("showDSAttributes.log.error", "Error encountered when listing attributes! ") + JSON.stringify(err));
        await utils.errorHandling(err, parent.getProfileName(), localize("showDSAttributes.error", "Unable to list attributes: ") + err.message);
        throw (err);
    }

    // shouldn't be possible for there to be two cataloged data sets with the same name,
    // but just in case we'll display all of the results
    // if there's only one result (which there should be), we will just pass in attributes[0]
    // so that prettyJson doesn't display the attributes as an array with a hyphen character
    const attributesText = TextUtils.prettyJson(attributes.length > 1 ? attributes : attributes[0], undefined, false);
    // const attributesFilePath = path.join(ZOWETEMPFOLDER, label + ".yaml");
    // fs.writeFileSync(attributesFilePath, attributesText);
    // const document = await vscode.workspace.openTextDocument(attributesFilePath);
    // await vscode.window.showTextDocument(document);
    const attributesMessage = localize("attributes.title", "Attributes");
    const webviewHTML = `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>${label} "${attributesMessage}"</title>
    </head>
    <body>
     ${attributesText.replace(/\n/g, "</br>")}
    </body>
    </html>`;
    const column = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn
        : undefined;
    const panel: vscode.WebviewPanel = vscode.window.createWebviewPanel(
        "zowe",
        label + " " + localize("attributes.title", "Attributes"),
        column || 1,
        {}
    );
    panel.webview.html = webviewHTML;

}

/**
 * Rename data sets
 *
 * @export
 * @param {IZoweDatasetTreeNode} node - The node
 * @param {DatasetTree} datasetProvider - the tree which contains the nodes
 */
export async function renameDataSet(node: IZoweDatasetTreeNode, datasetProvider: IZoweTree<IZoweDatasetTreeNode>) {
    let beforeDataSetName = node.label.trim();
    let favPrefix;
    let isFavourite;

    if (node.contextValue.includes(FAV_SUFFIX)) {
        isFavourite = true;
        favPrefix = node.label.substring(0, node.label.indexOf(":") + 2);
        beforeDataSetName = node.label.substring(node.label.indexOf(":") + 2);
    }
    const afterDataSetName = await vscode.window.showInputBox({value: beforeDataSetName});

    log.debug(localize("renameDataSet.log.debug", "Renaming data set ") + afterDataSetName);
    if (afterDataSetName) {
        try {
            await ZoweExplorerApiRegister.getMvsApi(node.getProfile()).renameDataSet(beforeDataSetName, afterDataSetName);
            node.label = `${favPrefix}${afterDataSetName}`;
        } catch (err) {
            log.error(localize("renameDataSet.log.error", "Error encountered when renaming data set! ") + JSON.stringify(err));
            await utils.errorHandling(err, favPrefix, localize("renameDataSet.error", "Unable to rename data set: ") + err.message);
            throw err;
        }
        if (isFavourite) {
            const profile = favPrefix.substring(1, favPrefix.indexOf("]"));
            datasetProvider.renameNode(profile, beforeDataSetName, afterDataSetName);
        } else {
            const temp = node.label;
            node.label = "[" + node.getSessionNode().label.trim() + "]: " + beforeDataSetName;
            datasetProvider.renameFavorite(node, afterDataSetName);
            node.label = temp;
        }
        datasetProvider.refreshElement(node.getParent());
        datasetProvider.updateFavorites();
    }
}

function getProfileAndDataSetName(node: IZoweNodeType) {
    let profileName;
    let dataSetName;
    if (node.contextValue.includes(FAV_SUFFIX)) {
        profileName = node.label.substring(1, node.label.indexOf("]"));
        dataSetName = node.label.substring(node.label.indexOf(":") + 2);
    } else {
        profileName = node.getParent().getLabel();
        dataSetName = node.label.trim();
    }

    return {profileName, dataSetName};
}

function getNodeLabels(node: IZoweNodeType) {
    if (node.contextValue.includes(DS_MEMBER_CONTEXT)) {
        return { ...getProfileAndDataSetName(node.getParent()), memberName: node.getLabel()};
    } else {
        return getProfileAndDataSetName(node);
    }
}

/**
 * Copy data sets
 *
 * @export
 * @param {IZoweNodeType} node - The node to copy
 */
export async function copyDataSet(node: IZoweNodeType) {
    return vscode.env.clipboard.writeText(JSON.stringify(getNodeLabels(node)));
}

/**
 * Migrate data sets
 *
 * @export
 * @param {IZoweDatasetTreeNode} node - The node to paste to
 */
export async function hMigrateDataSet(node: ZoweDatasetNode) {
    const { dataSetName } = getNodeLabels(node);
    vscode.window.showInformationMessage(localize("hMigrate.requestSent1", "Migration of dataset: ") + dataSetName +
    localize("hMigrate.requestSent2", " requested."));
    return ZoweExplorerApiRegister.getMvsApi(node.getProfile()).hMigrateDataSet(dataSetName);
}

/**
 * Paste data sets
 *
 * @export
 * @param {ZoweNode} node - The node to paste to
 * @param {DatasetTree} datasetProvider - the tree which contains the nodes
 */
export async function pasteDataSet(node: IZoweDatasetTreeNode, datasetProvider: IZoweTree<IZoweDatasetTreeNode>) {
    const { profileName, dataSetName } = getNodeLabels(node);
    let memberName;
    let beforeDataSetName;
    let beforeProfileName;
    let beforeMemberName;

    if (node.contextValue.includes(DS_PDS_CONTEXT)) {
        memberName = await vscode.window.showInputBox({placeHolder: localize("renameDataSet.name", "Name of Data Set Member")});
        if (!memberName) {
            return;
        }
    }

    try {
        ({
            dataSetName: beforeDataSetName,
            memberName: beforeMemberName,
            profileName: beforeProfileName,
        } = JSON.parse(await vscode.env.clipboard.readText()));
    } catch (err) {
        throw Error("Invalid clipboard. Copy from data set first");
    }

    if (beforeProfileName === profileName) {
        if (memberName) {
            try {
                await ZoweExplorerApiRegister.getMvsApi(node.getProfile()).getContents(`${dataSetName}(${memberName})`, {
                    file: path.join(ZOWE_TMP_FOLDER, getProfile(node), `${dataSetName}(${memberName})`)
                });
                throw Error(`${dataSetName}(${memberName}) already exists. You cannot replace a member`);
            } catch (err) {
                if (!err.message.includes("Member not found")) {
                    throw err;
                }
            }
        }
        await ZoweExplorerApiRegister.getMvsApi(node.getProfile()).copyDataSetMember(
            { dataSetName: beforeDataSetName, memberName: beforeMemberName },
            { dataSetName, memberName }
        );

        if (memberName) {
            datasetProvider.refreshElement(node);
            let node2;
            if (node.contextValue.includes(FAV_SUFFIX)) {
                node2 = datasetProvider.findNonFavoritedNode(node);
            } else {
                node2 = datasetProvider.findFavoritedNode(node);
            }
            if (node2) {
                datasetProvider.refreshElement(node2);
            }
        } else {
            refreshPS(node);
        }
    }
}

/**
 * Rename data set members
 *
 * @export
 * @param {IZoweTreeNode} node - The node
 * @param {DatasetTree} datasetProvider - the tree which contains the nodes
 */
export async function renameDataSetMember(node: IZoweTreeNode, datasetProvider: IZoweTree<IZoweDatasetTreeNode>) {
    const beforeMemberName = node.label.trim();
    let dataSetName;
    let profileLabel;

    if (node.getParent().contextValue.includes(FAV_SUFFIX)) {
        profileLabel = node.getParent().getLabel().substring(0, node.getParent().getLabel().indexOf(":") + 2);
        dataSetName = node.getParent().getLabel().substring(node.getParent().getLabel().indexOf(":") + 2);
    } else {
        dataSetName = node.getParent().getLabel();
    }
    const afterMemberName = await vscode.window.showInputBox({value: beforeMemberName});

    log.debug(localize("renameDataSet.log.debug", "Renaming data set ") + afterMemberName);
    if (afterMemberName) {
        try {
            await ZoweExplorerApiRegister.getMvsApi(node.getProfile()).renameDataSetMember(dataSetName, beforeMemberName, afterMemberName);
            node.label = `${profileLabel}${afterMemberName}`;
        } catch (err) {
            log.error(localize("renameDataSet.log.error", "Error encountered when renaming data set! ") + JSON.stringify(err));
            await utils.errorHandling(err, profileLabel, localize("renameDataSet.error", "Unable to rename data set: ") + err.message);
            throw err;
        }
        if (node.getParent().contextValue.includes(FAV_SUFFIX)) {
            const nonFavoritedParent = datasetProvider.findNonFavoritedNode(node.getParent());
            if (nonFavoritedParent) {
                const nonFavoritedMember = nonFavoritedParent.children.find((child) => child.label === beforeMemberName);
                if (nonFavoritedMember) {
                    nonFavoritedMember.label = afterMemberName;
                    datasetProvider.refreshElement(nonFavoritedParent);
                }
            }
        } else {
            const favoritedParent = datasetProvider.findFavoritedNode(node.getParent());
            if (favoritedParent) {
                const favoritedMember = favoritedParent.children.find((child) => child.label === beforeMemberName);
                if (favoritedMember) {
                    favoritedMember.label = afterMemberName;
                    datasetProvider.refreshElement(favoritedParent);
                }
            }
        }
        datasetProvider.refreshElement(node.getParent());
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
    if (!fs.existsSync(ZOWETEMPFOLDER)) {
        return;
    }
    try {
        cleanDir(ZOWETEMPFOLDER);
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

/**
 * Deletes a dataset
 *
 * @export
 * @param {IZoweTreeNode} node - The node to be deleted
 * @param {IZoweTree<IZoweDatasetTreeNode>} datasetProvider - the tree which contains the nodes
 */
export async function deleteDataset(node: IZoweTreeNode, datasetProvider: IZoweTree<IZoweDatasetTreeNode>) {
    log.debug(localize("deleteDataset.log.debug", "Deleting data set ") + node.label);
    const quickPickOptions: vscode.QuickPickOptions = {
        placeHolder: localize("deleteDataset.quickPickOption", "Are you sure you want to delete ") + node.label,
        ignoreFocusOut: true,
        canPickMany: false
    };
    // confirm that the user really wants to delete
    if (await vscode.window.showQuickPick([localize("deleteDataset.showQuickPick.yes", "Yes"),
        localize("deleteDataset.showQuickPick.no", "No")], quickPickOptions) !== localize("deleteDataset.showQuickPick.yes", "Yes")) {
        log.debug(localize("deleteDataset.showQuickPick.log.debug", "User picked no. Cancelling delete of data set"));
        return;
    }

    let label = "";
    let fav = false;
    try {
        switch (node.getParent().contextValue) {
            case (FAVORITE_CONTEXT):
                label = node.label.substring(node.label.indexOf(":") + 1).trim();
                fav = true;
                break;
            case (DS_PDS_CONTEXT + FAV_SUFFIX):
                label = node.getParent().getLabel().substring(node.getParent().getLabel().indexOf(":") + 1).trim() + "(" + node.getLabel()+ ")";
                fav = true;
                break;
            case (DS_SESSION_CONTEXT):
                label = node.getLabel();
                break;
            case (DS_PDS_CONTEXT):
                label = node.getParent().getLabel()+ "(" + node.getLabel()+ ")";
                break;
            default:
                throw Error(localize("deleteDataSet.invalidNode.error", "deleteDataSet() called from invalid node."));
        }
        await ZoweExplorerApiRegister.getMvsApi(node.getProfile()).deleteDataSet(label);
    } catch (err) {
        log.error(localize("deleteDataSet.delete.log.error", "Error encountered when deleting data set! ") + JSON.stringify(err));
        if (err.message.includes(localize("deleteDataSet.error.notFound", "not found"))) {
            vscode.window.showInformationMessage(localize("deleteDataSet.notFound.error1", "Unable to find file: ") + label +
                localize("deleteDataSet.notFound.error2", " was probably already deleted."));
        } else {
            await utils.errorHandling(err, node.getProfileName(), err.message);
        }
        throw err;
    }

    // remove node from tree
    if (fav) {
        datasetProvider.mSessionNodes.forEach((ses) => {
            if (node.label.substring(node.label.indexOf("[") + 1, node.label.indexOf("]")) === ses.label.trim()||
                node.getParent().getLabel().substring(node.getParent().getLabel().indexOf("["),
                        node.getParent().getLabel().indexOf("]")) === ses.label) {
                ses.dirty = true;
            }
        });
        datasetProvider.removeFavorite(node);
    } else {
        node.getSessionNode().dirty = true;
        const temp = node.label;
        node.label = "[" + node.getSessionNode().label.trim() + "]: " + node.label;
        datasetProvider.removeFavorite(node);
        node.label = temp;
    }

    // refresh Tree View & favorites
    if (node.getParent() && node.getParent().contextValue !== DS_SESSION_CONTEXT) {
        datasetProvider.refreshElement(node.getParent());
        if (node.getParent().contextValue.includes(FAV_SUFFIX) || node.getParent().contextValue === FAVORITE_CONTEXT) {
            const nonFavNode = datasetProvider.findNonFavoritedNode(node.getParent());
            if (nonFavNode) { datasetProvider.refreshElement(nonFavNode); }
        } else {
            const favNode = datasetProvider.findFavoritedNode(node.getParent());
            if (favNode) { datasetProvider.refreshElement(favNode); }
        }
    } else {
        datasetProvider.refresh();
    }

    // remove local copy of file
    const fileName = getDocumentFilePath(label, node);
    try {
        if (fs.existsSync(fileName)) {
            fs.unlinkSync(fileName);
        }
    } catch (err) {
        // do nothing
    }
}

/**
 * Prompts the user for a pattern, and populates the [TreeView]{@link vscode.TreeView} based on the pattern
 *
 * @param {IZoweDatasetTreeNode} node - The session node
 * @param {DatasetTree} datasetProvider - Current DatasetTree used to populate the TreeView
 * @returns {Promise<void>}
 */
export async function enterPattern(node: IZoweDatasetTreeNode, datasetProvider: DatasetTree) {
    if (log) {
        log.debug(localize("enterPattern.log.debug.prompt", "Prompting the user for a data set pattern"));
    }
    let pattern: string;
    if (node.contextValue === DS_SESSION_CONTEXT) {
        // manually entering a search
        const options: vscode.InputBoxOptions = {
            prompt: localize("enterPattern.options.prompt", "Search data sets by entering patterns: use a comma to separate multiple patterns"),
            value: node.pattern
        };
        // get user input
        pattern = await vscode.window.showInputBox(options);
        if (!pattern) {
            vscode.window.showInformationMessage(localize("enterPattern.pattern", "You must enter a pattern."));
            return;
        }
    } else {
        // executing search from saved search in favorites
        pattern = node.label.trim().substring(node.label.trim().indexOf(":") + 2);
        const session = node.label.trim().substring(node.label.trim().indexOf("[") + 1, node.label.trim().indexOf("]"));
        await datasetProvider.addSession(session);
        node = datasetProvider.mSessionNodes.find((tempNode) => tempNode.label.trim() === session);
    }

    // update the treeview with the new pattern
    // TODO figure out why a label change is needed to refresh the treeview,
    // instead of changing the collapsible state
    // change label so the treeview updates
    node.label = node.label.trim() + " ";
    node.label.trim();
    node.tooltip = node.pattern = pattern.toUpperCase();
    node.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    node.dirty = true;
    const icon = getIconByNode(node);
    if (icon) {
        node.iconPath = icon.path;
    }
    datasetProvider.addHistory(node.pattern);
}

/**
 * Returns the profile for the specified node
 *
 * @export
 * @param {IZoweTreeNode} node
 */
export function getProfile(node: IZoweTreeNode) {
    let profile = node.getSessionNode().label.trim();
    // if this is a favorite node, further extraction is necessary
    if (profile.includes("[")) {
        profile = profile.substring(profile.indexOf("[") + 1, profile.indexOf("]"));
    }
    return profile;
}

/**
 * Returns the profile for the specified node
 *
 * @export
 * @param {ZoweUSSNode} node
 */
export function getUSSProfile(node: IZoweUSSTreeNode) {
    return node.getSessionNode().getProfileName();
}

/**
 * Append a suffix on a ds file so it can be interpretted with syntax highlighter
 *
 * Rules of mapping:
 *  1. Start with LLQ and work backwards as it is at this end usually
 *   the language is specified
 *  2. Dont do this for the top level HLQ
 */
function appendSuffix(label: string): string {
    const limit = 5;
    const bracket = label.indexOf("(");
    const split = (bracket > -1) ? label.substr(0, bracket).split(".", limit) : label.split(".", limit);
    for (let i = split.length - 1; i > 0; i--) {
        if (["JCL", "CNTL"].includes(split[i])) {
            return label.concat(".jcl");
        }
        if (["COBOL", "CBL", "COB", "SCBL"].includes(split[i])) {
            return label.concat(".cbl");
        }
        if (["COPYBOOK", "COPY", "CPY", "COBCOPY"].includes(split[i])) {
            return label.concat(".cpy");
        }
        if (["INC", "INCLUDE", "PLINC"].includes(split[i])) {
            return label.concat(".inc");
        }
        if (["PLI", "PL1", "PLX", "PCX"].includes(split[i])) {
            return label.concat(".pli");
        }
        if (["SH", "SHELL"].includes(split[i])) {
            return label.concat(".sh");
        }
        if (["REXX", "REXEC", "EXEC"].includes(split[i])) {
            return label.concat(".rexx");
        }
        if (split[i] === "XML") {
            return label.concat(".xml");
        }
        if (split[i] === "ASM" || split[i].indexOf("ASSEMBL") > -1) {
            return label.concat(".asm");
        }
        if (split[i] === "LOG" || split[i].indexOf("SPFLOG") > -1) {
            return label.concat(".log");
        }
    }
    return label;
}

/**
 * Returns the file path for the IZoweTreeNode
 *
 * @export
 * @param {string} label - If node is a member, label includes the name of the PDS
 * @param {IZoweDatasetTreeNode} node
 */
export function getDocumentFilePath(label: string, node: IZoweTreeNode) {
    return path.join(DS_DIR, "/" + getProfile(node) + "/" + appendSuffix(label) );
}

/**
 * Downloads and displays a PS in a text editor view
 *
 * @param {IZoweDatasetTreeNode} node
 */
export async function openPS(node: IZoweDatasetTreeNode, previewMember: boolean, datasetProvider?: IZoweTree<IZoweDatasetTreeNode>) {
    let sesNamePrompt: string;
    if (node.contextValue.endsWith(FAV_SUFFIX)) {
        sesNamePrompt = node.getLabel().substring(1, node.getLabel().indexOf("]"));
    } else {
        sesNamePrompt = node.getLabel();
    }
    if ((!node.getSession().ISession.user) || (!node.getSession().ISession.password)) {
        try {
            const values = await Profiles.getInstance().promptCredentials(sesNamePrompt);
            if (values !== undefined) {
                usrNme = values[0];
                passWrd = values[1];
                baseEncd = values[2];
            }
        } catch (error) {
            await utils.errorHandling(error, node.getProfileName(), error.message);
        }
        if (usrNme !== undefined && passWrd !== undefined && baseEncd !== undefined) {
            node.getSession().ISession.user = usrNme;
            node.getSession().ISession.password = passWrd;
            node.getSession().ISession.base64EncodedAuth = baseEncd;
            validProfile = 0;
        } else {
            return;
        }
        await datasetProvider.refreshElement(node);
        await datasetProvider.refresh();
    } else {
        validProfile = 0;
    }
    if (validProfile === 0) {
        try {
            let label: string;
            switch (node.getParent().contextValue) {
                case (FAVORITE_CONTEXT):
                    label = node.label.substring(node.label.indexOf(":") + 1).trim();
                    break;
                case (DS_PDS_CONTEXT + FAV_SUFFIX):
                    label = node.getParent().getLabel().substring(node.getParent().getLabel().indexOf(":") + 1).trim() + "(" + node.getLabel()+ ")";
                    break;
                case (DS_SESSION_CONTEXT):
                    label = node.label.trim();
                    break;
                case (DS_PDS_CONTEXT):
                    label = node.getParent().getLabel().trim() + "(" + node.getLabel()+ ")";
                    break;
                default:
                    vscode.window.showErrorMessage(localize("openPS.invalidNode", "openPS() called from invalid node."));
                    throw Error(localize("openPS.error.invalidNode", "openPS() called from invalid node."));
            }
            log.debug(localize("openPS.log.debug.openDataSet", "opening physical sequential data set from label ") + label);
            // if local copy exists, open that instead of pulling from mainframe
            const documentFilePath = getDocumentFilePath(label, node);
            if (!fs.existsSync(documentFilePath)) {
                const response = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Opening data set..."
                }, function downloadDataset() {
                    return ZoweExplorerApiRegister.getMvsApi(node.getProfile()).getContents(label, {
                        file: documentFilePath,
                        returnEtag: true
                    });
                });
                node.setEtag(response.apiResponse.etag);
            }
            const document = await vscode.workspace.openTextDocument(getDocumentFilePath(label, node));
            if (previewMember === true) {
                await vscode.window.showTextDocument(document);
            } else {
                await vscode.window.showTextDocument(document, {preview: false});
            }
        } catch (err) {
            log.error(localize("openPS.log.error.openDataSet", "Error encountered when opening data set! ") + JSON.stringify(err));
            await utils.errorHandling(err, node.getProfileName(), err.message);
            throw (err);
        }
    }
}

/**
 * Refreshes the passed node with current mainframe data
 *
 * @param {IZoweDatasetTreeNode} node - The node which represents the dataset
 */
export async function refreshPS(node: IZoweDatasetTreeNode) {
    let label;
    try {
        switch (node.getParent().contextValue) {
            case (FAVORITE_CONTEXT):
                label = node.label.substring(node.label.indexOf(":") + 1).trim();
                break;
            case (DS_PDS_CONTEXT + FAV_SUFFIX):
                label = node.getParent().getLabel().substring(node.getParent().getLabel().indexOf(":") + 1).trim() + "(" + node.getLabel()+ ")";
                break;
            case (DS_SESSION_CONTEXT):
                label = node.label.trim();
                break;
            case (DS_PDS_CONTEXT):
                label = node.getParent().getLabel() + "(" + node.getLabel() + ")";
                break;
            default:
                throw Error(localize("refreshPS.error.invalidNode", "refreshPS() called from invalid node."));
        }
        const documentFilePath = getDocumentFilePath(label, node);
        const response = await ZoweExplorerApiRegister.getMvsApi(node.getProfile()).getContents(label, {
            file: documentFilePath,
            returnEtag: true
        });
        node.setEtag(response.apiResponse.etag);

        const document = await vscode.workspace.openTextDocument(documentFilePath);
        vscode.window.showTextDocument(document);
        // if there are unsaved changes, vscode won't automatically display the updates, so close and reopen
        if (document.isDirty) {
            await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
            vscode.window.showTextDocument(document);
        }
    } catch (err) {
        log.error(localize("refreshPS.log.error.refresh", "Error encountered when refreshing data set view: ") + JSON.stringify(err));
        if (err.message.includes(localize("refreshPS.error.notFound", "not found"))) {
            vscode.window.showInformationMessage(localize("refreshPS.file1", "Unable to find file: ") + label +
                localize("refreshPS.file2", " was probably deleted."));
        } else {
            await utils.errorHandling(err, node.getProfileName(), err.message);
        }
    }
}

export async function refreshUSSInTree(node: IZoweUSSTreeNode, ussFileProvider: IZoweTree<IZoweUSSTreeNode>) {
    await ussFileProvider.refreshElement(node);
}

function checkForAddedSuffix(filename: string): boolean {
    // identify how close to the end of the string the last . is
    const dotPos = filename.length - (1 + filename.lastIndexOf("."));
    // tslint:disable-next-line: no-magic-numbers
    return ((dotPos >= 2 && dotPos <= 4) && // if the last characters are 2 to 4 long and lower case it has been added
        ((filename.substring(filename.length - dotPos) === filename.substring(filename.length - dotPos).toLowerCase())));

}

/**
 * Uploads the file to the mainframe
 *
 * @export
 * @param {vscode.TextDocument} doc - TextDocument that is being saved
 */
export async function saveFile(doc: vscode.TextDocument, datasetProvider: IZoweTree<IZoweDatasetTreeNode>) {
    // Check if file is a data set, instead of some other file
    log.debug(localize("saveFile.log.debug.request", "requested to save data set: ") + doc.fileName);
    const docPath = path.join(doc.fileName, "..");
    log.debug("requested to save data set: " + doc.fileName);
    if (docPath.toUpperCase().indexOf(DS_DIR.toUpperCase()) === -1) {
        log.debug(localize("saveFile.log.debug.path", "path.relative returned a non-blank directory.") +
            localize("saveFile.log.debug.directory", "Assuming we are not in the DS_DIR directory: ") + path.relative(docPath, DS_DIR));
        return;
    }
    const start = path.join(DS_DIR + path.sep).length;
    const ending = doc.fileName.substring(start);
    const sesName = ending.substring(0, ending.indexOf(path.sep));
    const profile = (await Profiles.getInstance()).loadNamedProfile(sesName);
    if (!profile) {
        log.error(localize("saveFile.log.error.session", "Couldn't locate session when saving data set!"));
        return vscode.window.showErrorMessage(localize("saveFile.log.error.session", "Couldn't locate session when saving data set!"));
    }

    // get session from session name
    let documentSession: Session;
    let node: IZoweUSSTreeNode;
    const sesNode = (await datasetProvider.getChildren()).find((child) =>
        child.label.trim() === sesName);
    if (sesNode) {
        log.debug(localize("saveFile.log.debug.load", "Loading session from session node in saveFile()"));
        documentSession = sesNode.getSession();
    } else {
        // if saving from favorites, a session might not exist for this node
        log.debug(localize("saveFile.log.debug.sessionNode", "couldn't find session node, loading profile with CLI profile manager"));
        documentSession = ZoweExplorerApiRegister.getMvsApi(profile).getSession();
    }

    // If not a member
    const label = doc.fileName.substring(doc.fileName.lastIndexOf(path.sep) + 1,
        checkForAddedSuffix(doc.fileName) ? doc.fileName.lastIndexOf(".") : doc.fileName.length);
    log.debug(localize("saveFile.log.debug.saving", "Saving file ") + label);
    if (!label.includes("(")) {
        try {
            // Checks if file still exists on server
            const response = await ZoweExplorerApiRegister.getMvsApi(profile).dataSet(label);
            if (!response.apiResponse.items.length) {
                return vscode.window.showErrorMessage(
                    localize("saveFile.error.saveFailed", "Data set failed to save. Data set may have been deleted on mainframe."));
            }
        } catch (err) {
            await utils.errorHandling(err, sesName, err.message);
        }
    }
    // Get specific node based on label and parent tree (session / favorites)
    let nodes: IZoweNodeType[];
    let isFromFavorites: boolean;
    if (!sesNode || sesNode.children.length === 0) {
        // saving from favorites
        nodes = utils.concatChildNodes(datasetProvider.mFavorites);
        isFromFavorites = true;
    } else {
        // saving from session
        nodes = utils.concatChildNodes([sesNode]);
        isFromFavorites = false;
    }
    node = nodes.find((zNode) => {
        // dataset in Favorites
        if (zNode.contextValue === DS_FAV_CONTEXT) {
            return (zNode.label === `[${sesName}]: ${label}`);
            // member in Favorites
        } else if (zNode.contextValue === DS_MEMBER_CONTEXT && isFromFavorites) {
            const zNodeDetails = getProfileAndDataSetName(zNode);
            return (`${zNodeDetails.profileName}(${zNodeDetails.dataSetName})` === `[${sesName}]: ${label}`);
        } else if (zNode.contextValue === DS_MEMBER_CONTEXT && !isFromFavorites) {
            const zNodeDetails = getProfileAndDataSetName(zNode);
            return (`${zNodeDetails.profileName}(${zNodeDetails.dataSetName})` === `${label}`);
        } else if (zNode.contextValue === DS_DS_CONTEXT) {
            return (zNode.label.trim() === label);
        } else {
            return false;
        }
    });

    // define upload options
    let uploadOptions: zowe.IUploadOptions;
    if (node) {
        uploadOptions = {
            etag: node.getEtag(),
            returnEtag: true
        };
    }

    try {
        const uploadResponse = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: localize("saveFile.response.save.title", "Saving data set...")
        }, () => {
            return ZoweExplorerApiRegister.getMvsApi(node ? node.getProfile(): profile).putContents(doc.fileName, label, uploadOptions);
        });
        if (uploadResponse.success) {
            vscode.window.showInformationMessage(uploadResponse.commandResponse);
            // set local etag with the new etag from the updated file on mainframe
            if (node) {
                node.setEtag(uploadResponse.apiResponse[0].etag);
            }
        } else if (!uploadResponse.success && uploadResponse.commandResponse.includes(
            localize("saveFile.error.ZosmfEtagMismatchError", "Rest API failure with HTTP(S) status 412"))) {
            const downloadResponse = await ZoweExplorerApiRegister.getMvsApi(node ? node.getProfile(): profile).getContents(label, {
                file: doc.fileName,
                returnEtag: true
            });
            // re-assign etag, so that it can be used with subsequent requests
            const downloadEtag = downloadResponse.apiResponse.etag;
            if (node && downloadEtag !== node.getEtag()) {
                node.setEtag(downloadEtag);
            }
            vscode.window.showWarningMessage(localize("saveFile.error.etagMismatch",
                "Remote file has been modified in the meantime.\nSelect 'Compare' to resolve the conflict."));
            // Store document in a separate variable, to be used on merge conflict
            const oldDoc = doc;
            const oldDocText = oldDoc.getText();
            const startPosition = new vscode.Position(0, 0);
            const endPosition = new vscode.Position(oldDoc.lineCount, 0);
            const deleteRange = new vscode.Range(startPosition, endPosition);
            await vscode.window.activeTextEditor.edit((editBuilder) => {
                // re-write the old content in the editor view
                editBuilder.delete(deleteRange);
                editBuilder.insert(startPosition, oldDocText);
            });
            await vscode.window.activeTextEditor.document.save();
        } else {
            vscode.window.showErrorMessage(uploadResponse.commandResponse);
        }
    } catch (err) {
        vscode.window.showErrorMessage(err.message);
    }
}

/**
 * Uploads the file to the mainframe
 *
 * @export
 * @param {Session} session - Desired session
 * @param {vscode.TextDocument} doc - TextDocument that is being saved
 */
export async function saveUSSFile(doc: vscode.TextDocument, ussFileProvider: IZoweTree<IZoweUSSTreeNode>) {
    log.debug(localize("saveUSSFile.log.debug.saveRequest", "save requested for USS file ") + doc.fileName);
    const start = path.join(USS_DIR + path.sep).length;
    const ending = doc.fileName.substring(start);
    const sesName = ending.substring(0, ending.indexOf(path.sep));
    const remote = ending.substring(sesName.length).replace(/\\/g, "/");

    // get session from session name
    let documentSession: Session;
    let binary;
    let node: IZoweUSSTreeNode;
    // TODO remove as
    const sesNode: IZoweUSSTreeNode = (ussFileProvider.mSessionNodes.find((child) =>
                                child.getProfileName() && child.getProfileName() === sesName.trim()));
    if (sesNode) {
        documentSession = sesNode.getSession();
        binary = Object.keys(sesNode.binaryFiles).find((child) => child === remote) !== undefined;
    }
    // Get specific node based on label and parent tree (session / favorites)
    let nodes: IZoweUSSTreeNode[];
    if (!sesNode || sesNode.children.length === 0) {
        // saving from favorites
        nodes = utils.concatChildNodes(ussFileProvider.mFavorites);
    } else {
        // saving from session
        nodes = utils.concatChildNodes([sesNode]);
    }
    node = nodes.find((zNode) => {
        if (zNode.contextValue === DS_FAV_TEXT_FILE_CONTEXT || zNode.contextValue === DS_TEXT_FILE_CONTEXT) {
            return (zNode.fullPath.trim() === remote);
        }
        else {
            return false;
        }
    });

    // define upload options
    let etagToUpload: string;
    let returnEtag: boolean;
    if (node) {
        etagToUpload = node.getEtag();
        if (etagToUpload) {
            returnEtag = true;
        }
    }

    try {
        const uploadResponse: zowe.IZosFilesResponse = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: localize("saveUSSFile.response.title", "Saving file...")
        }, () => {
            return ZoweExplorerApiRegister.getUssApi(sesNode.getProfile()).putContents(
                doc.fileName, remote, binary, null, etagToUpload, returnEtag);  // TODO MISSED TESTING
        });
        if (uploadResponse.success) {
            vscode.window.showInformationMessage(uploadResponse.commandResponse);
            // set local etag with the new etag from the updated file on mainframe
            node.setEtag(uploadResponse.apiResponse.etag);
            // this part never runs! zowe.Upload.fileToUSSFile doesn't return success: false, it just throws the error which is caught below!!!!!
        } else {
            vscode.window.showErrorMessage(uploadResponse.commandResponse);
        }
    } catch (err) {
        // TODO: error handling must not be zosmf specific
        if (err.message.includes(localize("saveFile.error.ZosmfEtagMismatchError", "Rest API failure with HTTP(S) status 412"))) {
            // Store old document text in a separate variable, to be used on merge conflict
            const oldDocText = doc.getText();
            const oldDocLineCount = doc.lineCount;
            const downloadResponse = await ZoweExplorerApiRegister.getUssApi(node.getProfile()).getContents(
                node.fullPath, {
                    file: node.getUSSDocumentFilePath(),
                    binary,
                    returnEtag: true
                });
            // re-assign etag, so that it can be used with subsequent requests
            const downloadEtag = downloadResponse.apiResponse.etag;
            if (downloadEtag !== etagToUpload) {
                node.setEtag(downloadEtag);
            }
            this.downloaded = true;

            vscode.window.showWarningMessage(localize("saveFile.error.etagMismatch",
                "Remote file has been modified in the meantime.\nSelect 'Compare' to resolve the conflict."));
            const startPosition = new vscode.Position(0, 0);
            const endPosition = new vscode.Position(oldDocLineCount, 0);
            const deleteRange = new vscode.Range(startPosition, endPosition);
            await vscode.window.activeTextEditor.edit((editBuilder) => {
                // re-write the old content in the editor view
                editBuilder.delete(deleteRange);
                editBuilder.insert(startPosition, oldDocText);
            });
            await vscode.window.activeTextEditor.document.save();
        } else {
            log.error(localize("saveUSSFile.log.error.save", "Error encountered when saving USS file: ") + JSON.stringify(err));
            await utils.errorHandling(err, sesName, err.message);
        }
    }
}

export async function modifyCommand(job: Job) {
    try {
        const command = await vscode.window.showInputBox({prompt: localize("modifyCommand.command.prompt", "Modify Command")});
        if (command !== undefined) {
            const response = await zowe.IssueCommand.issueSimple(job.getSession(), `f ${job.job.jobname},${command}`);
            vscode.window.showInformationMessage(localize("modifyCommand.response", "Command response: ") + response.commandResponse);
        }
    } catch (error) {
        await utils.errorHandling(error, null, error.message);
    }
}

export async function stopCommand(job: Job) {
    try {
        const response = await zowe.IssueCommand.issueSimple(job.getSession(), `p ${job.job.jobname}`);
        vscode.window.showInformationMessage(localize("stopCommand.response", "Command response: ") + response.commandResponse);
    } catch (error) {
        await utils.errorHandling(error, null, error.message);
    }
}

export async function getSpoolContent(session: string, spool: zowe.IJobFile) {
    const zosmfProfile = Profiles.getInstance().loadNamedProfile(session);
    const spoolSess = zowe.ZosmfSession.createBasicZosmfSession(zosmfProfile.profile);
    if ((!spoolSess.ISession.user) || (!spoolSess.ISession.password)) {
        try {
            const values = await Profiles.getInstance().promptCredentials(session);
            if (values !== undefined) {
                usrNme = values[0];
                passWrd = values[1];
                baseEncd = values[2];
            }
        } catch (error) {
            await utils.errorHandling(error, session, error.message);
        }
        if (usrNme !== undefined && passWrd !== undefined && baseEncd !== undefined) {
            spoolSess.ISession.user = usrNme;
            spoolSess.ISession.password = passWrd;
            spoolSess.ISession.base64EncodedAuth = baseEncd;
            validProfile = 0;
        }
    } else {
        validProfile = 0;
    }
    if (validProfile === 0) {
        try {
            const uri = encodeJobFile(session, spool);
            const document = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(document);
        } catch (error) {
            await utils.errorHandling(error, session, error.message);
        }
    }
}

export async function setOwner(job: IZoweJobTreeNode, jobsProvider: IZoweTree<IZoweJobTreeNode>) {
    const newOwner = await vscode.window.showInputBox({ prompt: localize("setOwner.newOwner.prompt.owner", "Owner") });
    job.owner = newOwner;
    jobsProvider.refreshElement(job);
}

export async function setPrefix(job: IZoweJobTreeNode, jobsProvider: IZoweTree<IZoweJobTreeNode>) {
    const newPrefix = await vscode.window.showInputBox({ prompt: localize("setOwner.newOwner.prompt.prefix", "Prefix") });
    job.prefix = newPrefix;
    jobsProvider.refreshElement(job);
}

export async function refreshJobsServer(node: IZoweJobTreeNode, jobsProvider: IZoweTree<IZoweJobTreeNode>) {
    let sesNamePrompt: string;
    if (node.contextValue.endsWith(FAV_SUFFIX)) {
        sesNamePrompt = node.label.substring(1, node.label.indexOf("]"));
    } else {
        sesNamePrompt = node.label;
    }
    if ((!node.getSession().ISession.user ) || (!node.getSession().ISession.password)) {
        try {
            const values = await Profiles.getInstance().promptCredentials(sesNamePrompt);
            if (values !== undefined) {
                usrNme = values[0];
                passWrd = values[1];
                baseEncd = values[2];
            }
        } catch (error) {
            await utils.errorHandling(error, node.getProfileName(), error.message);
        }
        if (usrNme !== undefined && passWrd !== undefined && baseEncd !== undefined) {
            node.getSession().ISession.user = usrNme;
            node.getSession().ISession.password = passWrd;
            node.getSession().ISession.base64EncodedAuth = baseEncd;
            node.owner = usrNme;
            validProfile = 0;
        }
    } else {
        validProfile = 0;
    }
    if (validProfile === 0) {
        await jobsProvider.refreshElement(node);
    }
}
