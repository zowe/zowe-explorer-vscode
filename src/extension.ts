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

import * as zowe from "@brightside/core";
import * as fs from "fs";
import { moveSync } from "fs-extra";
import * as path from "path";
import * as vscode from "vscode";
import { IZoweTree, IZoweTreeNode } from "./ZoweTree";
import { ZoweNode } from "./ZoweNode";
import { Logger, TextUtils, IProfileLoaded, ISession, IProfile, Session } from "@brightside/imperative";
import { DatasetTree, createDatasetTree } from "./DatasetTree";
import { ZosJobsProvider, createJobsTree } from "./ZosJobsProvider";
import { Job } from "./ZoweJobNode";
import { USSTree, createUSSTree } from "./USSTree";
import { ZoweUSSNode } from "./ZoweUSSNode";
import * as ussActions from "./uss/ussNodeActions";
import * as mvsActions from "./mvs/mvsNodeActions";
// tslint:disable-next-line: no-duplicate-imports
import { IJobFile, IUploadOptions } from "@brightside/core";
import { Profiles } from "./Profiles";
import * as nls from "vscode-nls";
import * as utils from "./utils";
import SpoolProvider, { encodeJobFile } from "./SpoolProvider";
import { ZoweExplorerApiRegister } from "./api/ZoweExplorerApiRegister";

// Localization support
const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

// Globals
export let BRIGHTTEMPFOLDER;
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
        fs.mkdirSync(BRIGHTTEMPFOLDER);
        fs.mkdirSync(USS_DIR);
        fs.mkdirSync(DS_DIR);
    } catch (err) {
        vscode.window.showErrorMessage(err.message);
    }

    let datasetProvider: DatasetTree;
    let ussFileProvider: USSTree;
    let jobsProvider: ZosJobsProvider;
    const outputChannel = vscode.window.createOutputChannel("Zowe TSO Command");

    try {
        // Initialize Imperative Logger
        const loggerConfig = require(path.join(context.extensionPath, "log4jsconfig.json"));
        loggerConfig.log4jsConfig.appenders.default.filename = path.join(context.extensionPath, "logs", "imperative.log");
        loggerConfig.log4jsConfig.appenders.imperative.filename = path.join(context.extensionPath, "logs", "imperative.log");
        loggerConfig.log4jsConfig.appenders.app.filename = path.join(context.extensionPath, "logs", "zowe.log");
        Logger.initLogger(loggerConfig);

        log = Logger.getAppLogger();
        log.debug(localize("initialize.log.debug", "Initialized logger from VSCode extension"));
        await Profiles.createInstance(log);

        // Initialize dataset provider
        datasetProvider = await createDatasetTree(log);
        // Initialize uss provider
        ussFileProvider = await createUSSTree(log);
        // Initialize Jobs provider with the created session and the selected pattern
        jobsProvider = await createJobsTree(log);

    } catch (err) {
        log.error(localize("initialize.log.error", "Error encountered while activating and initializing logger! ") + JSON.stringify(err));
        vscode.window.showErrorMessage(err.message); // TODO MISSED TESTING
    }

    const spoolProvider = new SpoolProvider();
    const providerRegistration = vscode.Disposable.from(
        vscode.workspace.registerTextDocumentContentProvider(SpoolProvider.scheme, spoolProvider)
    );
    context.subscriptions.push(spoolProvider, providerRegistration);

    if (datasetProvider) {
        vscode.commands.registerCommand("zowe.addSession", async () => addZoweSession(datasetProvider));
        vscode.commands.registerCommand("zowe.addFavorite", async (node) => datasetProvider.addFavorite(node));
        vscode.commands.registerCommand("zowe.refreshAll", () => refreshAll(datasetProvider));
        vscode.commands.registerCommand("zowe.refreshNode", (node) => refreshPS(node));
        vscode.commands.registerCommand("zowe.pattern", (node) => datasetProvider.datasetFilterPrompt(node));
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
                await saveUSSFile(savedFile, ussFileProvider); // TODO MISSED TESTING
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
        vscode.commands.registerCommand("zowe.renameDataSet", (node) => renameDataSet(node, datasetProvider));
        vscode.commands.registerCommand("zowe.copyDataSet", (node) => copyDataSet(node));
        vscode.commands.registerCommand("zowe.pasteDataSet", (node) => pasteDataSet(node, datasetProvider));
        vscode.commands.registerCommand("zowe.renameDataSetMember", (node) => renameDataSetMember(node, datasetProvider));
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
        const databaseView = vscode.window.createTreeView("zowe.explorer", { treeDataProvider: datasetProvider });
        context.subscriptions.push(databaseView);
        if (!ISTHEIA) {
            databaseView.onDidCollapseElement( async (e) => {
                datasetProvider.flipState(e.element, false);
            });
            databaseView.onDidExpandElement( async (e) => {
                datasetProvider.flipState(e.element, true);
            });
        }
    }
    if (ussFileProvider) {
        vscode.commands.registerCommand("zowe.uss.addFavorite", async (node) => ussFileProvider.addUSSFavorite(node));
        vscode.commands.registerCommand("zowe.uss.removeFavorite", async (node) => ussFileProvider.removeUSSFavorite(node));
        vscode.commands.registerCommand("zowe.uss.addSession", async () => addZoweSession(ussFileProvider));
        vscode.commands.registerCommand("zowe.uss.refreshAll", () => ussActions.refreshAllUSS(ussFileProvider));
        vscode.commands.registerCommand("zowe.uss.refreshUSS", (node) => refreshUSS(node));
        vscode.commands.registerCommand("zowe.uss.fullPath", (node) => ussFileProvider.ussFilterPrompt(node));
        vscode.commands.registerCommand("zowe.uss.ZoweUSSNode.open", (node) => openUSS(node, false, true, ussFileProvider));
        vscode.commands.registerCommand("zowe.uss.removeSession", async (node) => ussFileProvider.deleteSession(node));
        vscode.commands.registerCommand("zowe.uss.createFile", async (node) => ussActions.createUSSNode(node, ussFileProvider, "file"));
        vscode.commands.registerCommand("zowe.uss.createFolder", async (node) => ussActions.createUSSNode(node, ussFileProvider, "directory"));
        vscode.commands.registerCommand("zowe.uss.deleteNode",
            async (node) => ussActions.deleteUSSNode(node, ussFileProvider, getUSSDocumentFilePath(node)));
        vscode.commands.registerCommand("zowe.uss.binary", async (node) => changeFileType(node, true, ussFileProvider));
        vscode.commands.registerCommand("zowe.uss.text", async (node) => changeFileType(node, false, ussFileProvider));
        vscode.commands.registerCommand("zowe.uss.renameNode",
            async (node) => ussActions.renameUSSNode(node, ussFileProvider, getUSSDocumentFilePath(node)));
        vscode.commands.registerCommand("zowe.uss.uploadDialog", async (node) => ussActions.uploadDialog(node, ussFileProvider));
        vscode.commands.registerCommand("zowe.uss.createNode", async (node) => ussActions.createUSSNodeDialog(node, ussFileProvider));
        vscode.commands.registerCommand("zowe.uss.copyPath", async (node) => ussActions.copyPath(node));
        vscode.commands.registerCommand("zowe.uss.editFile", (node) => openUSS(node, false, false, ussFileProvider));
        vscode.commands.registerCommand("zowe.uss.saveSearch", async (node) => ussFileProvider.addUSSSearchFavorite(node));
        vscode.commands.registerCommand("zowe.uss.removeSavedSearch", async (node) => ussFileProvider.removeUSSFavorite(node));
        vscode.workspace.onDidChangeConfiguration(async (e) => {
            ussFileProvider.onDidChangeConfiguration(e);
        });
        const ussView = vscode.window.createTreeView("zowe.uss.explorer", { treeDataProvider: ussFileProvider });
        context.subscriptions.push(ussView);
        if (!ISTHEIA) {
            ussView.onDidCollapseElement( async (e) => {
                ussFileProvider.flipState(e.element, false);
            });
            ussView.onDidExpandElement( async (e) => {
                ussFileProvider.flipState(e.element, true);
            });
        }
    }

    if (jobsProvider) {
        vscode.commands.registerCommand("zowe.zosJobsOpenspool", (session, spool) => {
            getSpoolContent(session, spool);
        });
        vscode.commands.registerCommand("zowe.deleteJob", (job) => jobsProvider.deleteJob(job));
        vscode.commands.registerCommand("zowe.runModifyCommand", (job) => {
            modifyCommand(job);
        });
        vscode.commands.registerCommand("zowe.runStopCommand", (job) => {
            stopCommand(job);
        });
        vscode.commands.registerCommand("zowe.refreshJobsServer", async (node) => refreshJobsServer(node, jobsProvider));
        vscode.commands.registerCommand("zowe.refreshAllJobs", () => {
            jobsProvider.mSessionNodes.forEach((jobNode) => {
                if (jobNode.contextValue === JOBS_SESSION_CONTEXT) {
                    jobNode.reset();
                }
            });
            jobsProvider.refresh();
            Profiles.getInstance().refresh();
        });
        vscode.commands.registerCommand("zowe.addJobsSession", () => addZoweSession(jobsProvider));
        vscode.commands.registerCommand("zowe.setOwner", (node) => {
            setOwner(node, jobsProvider);
        });
        vscode.commands.registerCommand("zowe.setPrefix", (node) => {
            setPrefix(node, jobsProvider);
        });
        vscode.commands.registerCommand("zowe.removeJobsSession", (node) => jobsProvider.deleteSession(node));
        vscode.commands.registerCommand("zowe.downloadSpool", (job) => downloadSpool(job));
        vscode.commands.registerCommand("zowe.getJobJcl",  (job) => {
            downloadJcl(job);
        });
        vscode.commands.registerCommand("zowe.setJobSpool", async (session, jobid) => {
            const sessionNode = jobsProvider.mSessionNodes.find((jobNode) => {
                return jobNode.label.trim() === session.trim();
            });
            sessionNode.dirty = true;
            jobsProvider.refresh();
            const jobs = await sessionNode.getChildren();
            const job = jobs.find((jobNode) => {
                return jobNode.job.jobid === jobid;
            });
            jobsProvider.setJob(jobView, job);
        });
        vscode.commands.registerCommand("zowe.jobs.search", (node) => jobsProvider.searchPrompt(node));
        vscode.commands.registerCommand("zowe.issueTsoCmd", async () => issueTsoCommand(outputChannel));
        vscode.workspace.onDidChangeConfiguration(async (e) => {
            jobsProvider.onDidChangeConfiguration(e);
        });
        vscode.commands.registerCommand("zowe.jobs.addFavorite", async (node) => jobsProvider.addJobsFavorite(node));
        vscode.commands.registerCommand("zowe.jobs.removeFavorite", async (node) => jobsProvider.removeJobsFavorite(node));
        vscode.commands.registerCommand("zowe.jobs.saveSearch", async (node) => jobsProvider.saveSearch(node));
        vscode.commands.registerCommand("zowe.jobs.removeSearchFavorite", async (node) => jobsProvider.removeJobsFavorite(node));
        const jobView = vscode.window.createTreeView("zowe.jobs", { treeDataProvider: jobsProvider });
        context.subscriptions.push(jobView);
        if (!ISTHEIA) {
            jobView.onDidCollapseElement( async (e: { element: Job; }) => {
                jobsProvider.flipState(e.element, false);
            });
            jobView.onDidExpandElement( async (e: { element: Job; }) => {
                jobsProvider.flipState(e.element, true);
            });
        }
    }

    // return the Extension's API to other extensions that want to register their APIs.
    return ZoweExplorerApiRegister.getInstance();
}

/**
 * Allow the user to submit a TSO command to the selected server. Response is written
 * to the output channel.
 * @param outputChannel The Output Channel to write the command and response to
 */
export async function issueTsoCommand(outputChannel: vscode.OutputChannel) {
    const profiles = Profiles.getInstance();
    const allProfiles: IProfileLoaded[] = profiles.allProfiles;
    let sesName: string;
    let zosmfProfile: IProfileLoaded;

    const profileNamesList = allProfiles.map((profile) => {
        return profile.name;
    });
    if (profileNamesList.length) {
        const quickPickOptions: vscode.QuickPickOptions = {
            placeHolder: localize("issueTsoCommand.quickPickOption", "Select the Profile to use to submit the command"),
            ignoreFocusOut: true,
            canPickMany: false
        };
        sesName = await vscode.window.showQuickPick(profileNamesList, quickPickOptions);
        zosmfProfile = allProfiles.filter((profile) => profile.name === sesName)[0];
        const updProfile = zosmfProfile.profile as ISession;
        if ((!updProfile.user) || (!updProfile.password)) {
            try {
                const values = await Profiles.getInstance().promptCredentials(zosmfProfile.name);
                if (values !== undefined) {
                    usrNme = values [0];
                    passWrd = values [1];
                    baseEncd = values [2];
                }
            } catch (error) {
                vscode.window.showErrorMessage(error.message);
            }
            if (usrNme !== undefined && passWrd !== undefined && baseEncd !== undefined) {
                updProfile.user = usrNme;
                updProfile.password = passWrd;
                updProfile.base64EncodedAuth = baseEncd;
                zosmfProfile.profile = updProfile as IProfile;
            }
        }
    } else {
        vscode.window.showInformationMessage(localize("issueTsoCommand.noProfilesLoaded", "No profiles available"));
    }
    let command = await vscode.window.showInputBox({ prompt: localize("issueTsoCommand.command", "Command") });
    try {
        if (command !== undefined) {
            // If the user has started their command with a / then remove it
            if (command.startsWith("/")) {
                command = command.substring(1);
            }
            outputChannel.appendLine(`> ${command}`);
            const response = await zowe.IssueCommand.issueSimple(zowe.ZosmfSession.createBasicZosmfSession(zosmfProfile.profile), command);
            outputChannel.appendLine(response.commandResponse);
            outputChannel.show(true);
        }
    } catch (error) {
        vscode.window.showErrorMessage(error.message);
    }
}

/**
 * Defines all global variables
 * @param tempPath File path for temporary folder defined in preferences
 */
export function defineGlobals(tempPath: string | undefined) {
    tempPath !== "" && tempPath !== undefined ?
        BRIGHTTEMPFOLDER = path.join(tempPath, "temp") :
        BRIGHTTEMPFOLDER = path.join(__dirname, "..", "..", "resources", "temp");

    USS_DIR = path.join(BRIGHTTEMPFOLDER, "_U_");
    DS_DIR = path.join(BRIGHTTEMPFOLDER, "_D_");
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
        fs.mkdirSync(BRIGHTTEMPFOLDER);
        fs.mkdirSync(USS_DIR);
        fs.mkdirSync(DS_DIR);
    } catch (err) {
        log.error("Error encountered when creating temporary folder! " + JSON.stringify(err));
        vscode.window.showErrorMessage(err.message);
    }
    const previousTemp = path.join(previousTempPath, "temp");
    try {
        // If source and destination path are same, exit
        if(previousTemp === BRIGHTTEMPFOLDER) {
            return;
        }

        // TODO: Possibly remove when supporting "Multiple Instances"
        // If a second instance has already moved the temp folder, exit
        // Ideally, `moveSync()` would alert user if path doesn't exist.
        // However when supporting "Multiple Instances", might not be possible.
        if(!fs.existsSync(previousTemp)) {
            return;
        }

        moveSync(previousTemp, BRIGHTTEMPFOLDER, { overwrite: true });
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
export async function downloadSpool(job: Job){
    try {
        const dirUri = await vscode.window.showOpenDialog({
            openLabel: localize("downloadSpool.select", "Select"),
            canSelectFolders:true,
            canSelectFiles: false,
            canSelectMany: false
        });
        if (dirUri !== undefined) {
            ZoweExplorerApiRegister.getJesApi(job.profile).downloadSpoolContent({
                jobid: job.job.jobid,
                jobname: job.job.jobname,
                outDir: dirUri[0].fsPath
            });
        }
    } catch (error) {
        vscode.window.showErrorMessage(error.message);
    }

}

export async function downloadJcl(job: Job) {
    try {
        const jobJcl = await ZoweExplorerApiRegister.getJesApi(job.profile).getJclForJob(job.job);
        const jclDoc = await vscode.workspace.openTextDocument({language: "jcl", content: jobJcl});
        await vscode.window.showTextDocument(jclDoc);
    } catch (error) {
        vscode.window.showErrorMessage(error.message);
    }
}

/**
 * Switch the download type and redownload the file.
 *
 * @param node The file that is going to be downloaded
 * @param binary Whether the file should be downloaded as binary or not
 * @param ussFileProvider Our USSTree object
 */
export async function changeFileType(node: ZoweUSSNode, binary: boolean, ussFileProvider: USSTree) {
    node.setBinary(binary);
    await openUSS(node, true, true, ussFileProvider);
    ussFileProvider.refresh();
}

/**
 * Submit the contents of the editor as JCL.
 *
 * @export
 * @param {DatasetTree} datasetProvider - our DatasetTree object
 */
export async function submitJcl(datasetProvider: DatasetTree) {
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
    if(regExp === null){
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
    const sesNode = (await datasetProvider.getChildren()).find((child) => child.label.trim()=== sessProfileName);
    if (sesNode) {
        sessProfile = sesNode.profile;
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
        vscode.window.showInformationMessage(localize("submitJcl.jobSubmitted" ,"Job submitted ") + `[${job.jobid}](${setJobCmd})`);
    } catch (error) {
        vscode.window.showErrorMessage(localize("submitJcl.jobSubmissionFailed", "Job submission failed\n") + error.message);
    }
}

/**
 * Submit the selected dataset member as a Job.
 *
 * @export
 * @param node The dataset member
 */
export async function submitMember(node: ZoweNode) {
    const labelregex = /\[(.+)\]\: (.+)/g;
    let label;
    let sesName;
    let sessProfile;
    const profiles = await Profiles.getInstance();
    switch (node.mParent.contextValue) {
        case (FAVORITE_CONTEXT): {
            const regex = labelregex.exec(node.label);
            sesName = regex[1];
            label = regex[2];
            sessProfile = profiles.loadNamedProfile(sesName);
            break;
        }
        case (DS_PDS_CONTEXT + FAV_SUFFIX): {
            const regex = labelregex.exec(node.mParent.label);
            sesName = regex[1];
            label = regex[2] + "(" + node.label.trim()+ ")";
            sessProfile = node.mParent.profile;
            break;
        }
        case (DS_SESSION_CONTEXT):
            sesName = node.mParent.label;
            label = node.label;
            sessProfile = node.mParent.profile;
            break;
        case (DS_PDS_CONTEXT):
            sesName = node.mParent.mParent.label;
            label = node.mParent.label.trim()+ "(" + node.label.trim()+ ")";
            sessProfile = node.mParent.mParent.profile;
            break;
        default:
            vscode.window.showErrorMessage(localize("submitMember.invalidNode", "submitMember() called from invalid node."));
            throw Error(localize("submitMember.error.invalidNode", "submitMember() called from invalid node."));
    }
    try {
        const job = await ZoweExplorerApiRegister.getJesApi(sessProfile).submitJob(label);
        const args = [sesName, job.jobid];
        const setJobCmd = `command:zowe.setJobSpool?${encodeURIComponent(JSON.stringify(args))}`;
        vscode.window.showInformationMessage(localize("submitMember.jobSubmitted" ,"Job submitted ") + `[${job.jobid}](${setJobCmd})`);
    } catch (error) {
        vscode.window.showErrorMessage(localize("submitMember.jobSubmissionFailed", "Job submission failed\n") + error.message);
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
export async function addZoweSession(zoweFileProvider: IZoweTree<IZoweTreeNode>) {

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
        const quickpick = vscode.window.createQuickPick();
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
            vscode.window.showErrorMessage(error.message);
        }
        if (newprofile) {
            try {
                await Profiles.getInstance().listProfile();
            } catch (error) {
                vscode.window.showErrorMessage(error.message);
            }
            await zoweFileProvider.addSession(newprofile);
            await zoweFileProvider.refresh();
        }
    } else if(chosenProfile) {
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
 * @param {ZoweNode} node - Desired Brightside session
 * @param {DatasetTree} datasetProvider - the tree which contains the nodes
 */
export async function createFile(node: ZoweNode, datasetProvider: DatasetTree) {
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
                usrNme = values [0];
                passWrd = values [1];
                baseEncd = values [2];
            }
        } catch (error) {
            vscode.window.showErrorMessage(error.message);
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
        let name = await vscode.window.showInputBox({ placeHolder: localize("dataset.name", "Name of Data Set") });
        name = name.toUpperCase();

        try {
            await ZoweExplorerApiRegister.getMvsApi(node.profile).createDataSet(typeEnum, name, createOptions);
            node.dirty = true;

            // Store previous filters (before refreshing)
            const currChildren = await node.getChildren();
            let theFilter = datasetProvider.getHistory()[0] || null;

            // Check if filter is currently applied
            if (currChildren[0].contextValue !== "information" && theFilter) {
                let addNewFilter = true;
                const currentFilters = theFilter.split(", ");

                // Check if current filter includes the new node
                currentFilters.forEach((filter) => {
                    const regex = new RegExp(filter.replace(`*`, `(.+)`) + "$");
                    addNewFilter = regex.test(name) ? false : addNewFilter;
                });

                if (addNewFilter) {
                    theFilter = `${theFilter}, ${name}`;
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
                node.iconPath = utils.applyIcons(node, ICON_STATE_OPEN);
                node.dirty = true;

                const newNode = await node.getChildren().then((children) => children.find((child) => child.label === name));
                const newNodeView = vscode.window.createTreeView("zowe.explorer", {treeDataProvider: datasetProvider});
                newNodeView.reveal(newNode, {select: true});
            }
        } catch (err) {
            log.error(localize("createDataSet.error", "Error encountered when creating data set! ") + JSON.stringify(err));
            vscode.window.showErrorMessage(err.message);
            throw (err);
        }
    }
}

/**
 * Creates a PDS member
 *
 * @export
 * @param {ZoweNode} parent - The parent Node
 * @param {DatasetTree} datasetProvider - the tree which contains the nodes
 */
export async function createMember(parent: ZoweNode, datasetProvider: DatasetTree) {
    const name = await vscode.window.showInputBox({ placeHolder: localize("createMember.inputBox", "Name of Member") });
    log.debug(localize("createMember.log.debug.createNewDataSet", "creating new data set member of name ") + name);
    if (name) {
        let label = parent.label.trim();
        if (parent.contextValue === DS_PDS_CONTEXT + FAV_SUFFIX) {
            label = parent.label.substring(parent.label.indexOf(":") + 2); // TODO MISSED TESTING
        }

        try {
            await ZoweExplorerApiRegister.getMvsApi(parent.profile).createDataSetMember(label + "(" + name + ")");
        } catch (err) {
            log.error(localize("createMember.log.error", "Error encountered when creating member! ") + JSON.stringify(err));
            vscode.window.showErrorMessage(localize("createMember.error", "Unable to create member: ") + err.message);
            throw (err);
        }
        parent.dirty = true;
        datasetProvider.refreshElement(parent);
        openPS(
            new ZoweNode(name, vscode.TreeItemCollapsibleState.None, parent, null, undefined, undefined, parent.profile),
            true, datasetProvider);
        datasetProvider.refresh();
    }
}


/**
 * Shows data set attributes in a new text editor
 *
 * @export
 * @param {ZoweNode} parent - The parent Node
 * @param {DatasetTree} datasetProvider - the tree which contains the nodes
 */
export async function showDSAttributes(parent: ZoweNode, datasetProvider: DatasetTree) {

    let label = parent.label.trim();
    if (parent.contextValue === DS_PDS_CONTEXT + FAV_SUFFIX || parent.contextValue === DS_DS_CONTEXT + FAV_SUFFIX) {
        label = parent.label.trim().substring(parent.label.trim().indexOf(":") + 2);
    }

    log.debug(localize("showDSAttributes.debug", "showing attributes of data set ") + label);
    let attributes: any;
    try {
        attributes = await ZoweExplorerApiRegister.getMvsApi(parent.profile).dataSet(label, { attributes: true });
        attributes = attributes.apiResponse.items;
        attributes = attributes.filter((dataSet) => {
            return dataSet.dsname.toUpperCase() === label.toUpperCase();
        });
        if (attributes.length === 0) {
            throw new Error(localize("showDSAttributes.lengthError", "No matching data set names found for query: ") + label);
        }
    } catch (err) {
        log.error(localize("showDSAttributes.log.error", "Error encountered when listing attributes! ") + JSON.stringify(err));
        vscode.window.showErrorMessage(localize("showDSAttributes.error", "Unable to list attributes: ") + err.message);
        throw (err);
    }

    // shouldn't be possible for there to be two cataloged data sets with the same name,
    // but just in case we'll display all of the results
    // if there's only one result (which there should be), we will just pass in attributes[0]
    // so that prettyJson doesn't display the attributes as an array with a hyphen character
    const attributesText = TextUtils.prettyJson(attributes.length > 1 ? attributes : attributes[0], undefined, false);
    // const attributesFilePath = path.join(BRIGHTTEMPFOLDER, label + ".yaml");
    // fs.writeFileSync(attributesFilePath, attributesText);
    // const document = await vscode.workspace.openTextDocument(attributesFilePath);
    // await vscode.window.showTextDocument(document);
    const attributesMessage = localize("attributes.title","Attributes");
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
            label + " " + localize("attributes.title","Attributes"),
            column || 1,
            {

            }
        );
    panel.webview.html = webviewHTML;

}

/**
 * Rename data sets
 *
 * @export
 * @param {ZoweNode} node - The node
 * @param {DatasetTree} datasetProvider - the tree which contains the nodes
 */
export async function renameDataSet(node: ZoweNode, datasetProvider: DatasetTree) {
    let beforeDataSetName = node.label.trim();
    let favPrefix;
    let isFavourite;

    if (node.contextValue.includes(FAV_SUFFIX)) {
        isFavourite = true;
        favPrefix = node.label.substring(0, node.label.indexOf(":") + 2);
        beforeDataSetName = node.label.substring(node.label.indexOf(":") + 2);
    }
    const afterDataSetName = await vscode.window.showInputBox({ value: beforeDataSetName });

    log.debug(localize("renameDataSet.log.debug", "Renaming data set ") + afterDataSetName);
    if (afterDataSetName) {
        try {
            await ZoweExplorerApiRegister.getMvsApi(node.profile).renameDataSet(beforeDataSetName, afterDataSetName);
            node.label = `${favPrefix}${afterDataSetName}`;
        } catch (err) {
            log.error(localize("renameDataSet.log.error", "Error encountered when renaming data set! ") + JSON.stringify(err));
            vscode.window.showErrorMessage(localize("renameDataSet.error", "Unable to rename data set: ") + err.message);
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
        datasetProvider.refreshElement(node.mParent);
        datasetProvider.updateFavorites();
    }
}

function getProfileAndDataSetName(node: ZoweNode) {
    let profileName;
    let dataSetName;
    if (node.contextValue.includes(FAV_SUFFIX)) {
        profileName = node.label.substring(1, node.label.indexOf("]"));
        dataSetName = node.label.substring(node.label.indexOf(":") + 2);
    } else {
        profileName = node.mParent.label.trim();
        dataSetName = node.label.trim();
    }

    return { profileName, dataSetName };
}

function getNodeLabels(node: ZoweNode) {
    if (node.contextValue.includes(DS_MEMBER_CONTEXT)) {
        return { ...getProfileAndDataSetName(node.mParent), memberName: node.label.trim() };
    } else {
        return getProfileAndDataSetName(node);
    }
}

/**
 * Copy data sets
 *
 * @export
 * @param {ZoweNode} node - The node to copy
 */
export async function copyDataSet(node: ZoweNode) {
    return vscode.env.clipboard.writeText(JSON.stringify(getNodeLabels(node)));
}

/**
 * Paste data sets
 *
 * @export
 * @param {ZoweNode} node - The node to paste to
 * @param {DatasetTree} datasetProvider - the tree which contains the nodes
 */
export async function pasteDataSet(node: ZoweNode, datasetProvider: DatasetTree) {
    const { profileName, dataSetName } = getNodeLabels(node);
    let memberName;
    let beforeDataSetName;
    let beforeProfileName;
    let beforeMemberName;

    if (node.contextValue.includes(DS_PDS_CONTEXT)) {
        memberName = await vscode.window.showInputBox({ placeHolder: localize("renameDataSet.name", "Name of Data Set Member") });
        if(!memberName) {
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

    if(beforeProfileName === profileName) {
        if(memberName) {
            try {
                await ZoweExplorerApiRegister.getMvsApi(node.profile).getContents(`${dataSetName}(${memberName})`);
                throw Error(`${dataSetName}(${memberName}) already exists. You cannot replace a member`);
            } catch(err) {
                if (!err.message.includes("Member not found")) {
                    throw err;
                }
            }
        }
        await ZoweExplorerApiRegister.getMvsApi(node.profile).copyDataSetMember(
            { dataSetName: beforeDataSetName, memberName: beforeMemberName },
            { dataSetName, memberName },
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
 * @param {ZoweNode} node - The node
 * @param {DatasetTree} datasetProvider - the tree which contains the nodes
 */
export async function renameDataSetMember(node: ZoweNode, datasetProvider: DatasetTree) {
    const beforeMemberName = node.label.trim();
    let dataSetName;
    let profileLabel;

    if (node.mParent.contextValue.includes(FAV_SUFFIX)) {
        profileLabel = node.mParent.label.substring(0, node.mParent.label.indexOf(":") + 2);
        dataSetName = node.mParent.label.substring(node.mParent.label.indexOf(":") + 2);
    } else {
        dataSetName = node.mParent.label.trim();
    }
    const afterMemberName = await vscode.window.showInputBox({ value: beforeMemberName });

    log.debug(localize("renameDataSet.log.debug", "Renaming data set ") + afterMemberName);
    if (afterMemberName) {
        try {
            await ZoweExplorerApiRegister.getMvsApi(node.profile).renameDataSetMember(dataSetName, beforeMemberName, afterMemberName);
            node.label = `${profileLabel}${afterMemberName}`;
        } catch (err) {
            log.error(localize("renameDataSet.log.error", "Error encountered when renaming data set! ") + JSON.stringify(err));
            vscode.window.showErrorMessage(localize("renameDataSet.error", "Unable to rename data set: ") + err.message);
            throw err;
        }
        if (node.mParent.contextValue.includes(FAV_SUFFIX)) {
            const nonFavoritedParent = datasetProvider.findNonFavoritedNode(node.mParent);
            if (nonFavoritedParent) {
                const nonFavoritedMember = nonFavoritedParent.children.find((child) => child.label === beforeMemberName);
                if (nonFavoritedMember) {
                    nonFavoritedMember.label = afterMemberName;
                    datasetProvider.refreshElement(nonFavoritedParent);
                }
            }
        } else {
            const favoritedParent = datasetProvider.findFavoritedNode(node.mParent);
            if (favoritedParent) {
                const favoritedMember = favoritedParent.children.find((child) => child.label === beforeMemberName);
                if (favoritedMember) {
                    favoritedMember.label = afterMemberName;
                    datasetProvider.refreshElement(favoritedParent);
                }
            }
        }
        datasetProvider.refreshElement(node.mParent);
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
    if (!fs.existsSync(BRIGHTTEMPFOLDER)) {
        return;
    }
    try {
        cleanDir(BRIGHTTEMPFOLDER);
    } catch (err) {
        vscode.window.showErrorMessage(localize("deactivate.error", "Unable to delete temporary folder. ") + err);  // TODO MISSED TESTING
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
 * @param {ZoweNode} node - The node to be deleted
 * @param {DatasetTree} datasetProvider - the tree which contains the nodes
 */
export async function deleteDataset(node: ZoweNode, datasetProvider: DatasetTree) {
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
        switch (node.mParent.contextValue) {
            case (FAVORITE_CONTEXT):
                label = node.label.substring(node.label.indexOf(":") + 1).trim();
                fav = true;
                break;
            case (DS_PDS_CONTEXT + FAV_SUFFIX):
                label = node.mParent.label.substring(node.mParent.label.indexOf(":") + 1).trim() + "(" + node.label.trim()+ ")";
                fav = true;
                break;
            case (DS_SESSION_CONTEXT):
                label = node.label.trim();
                break;
            case (DS_PDS_CONTEXT):
                label = node.mParent.label.trim()+ "(" + node.label.trim()+ ")";
                break;
            default:
                throw Error(localize("deleteDataSet.invalidNode.error", "deleteDataSet() called from invalid node."));
        }
        await ZoweExplorerApiRegister.getMvsApi(node.profile).deleteDataSet(label);
    } catch (err) {
        log.error(localize("deleteDataSet.delete.log.error", "Error encountered when deleting data set! ") + JSON.stringify(err));
        if (err.message.includes(localize("deleteDataSet.error.notFound", "not found"))) {
            vscode.window.showInformationMessage(localize("deleteDataSet.notFound.error1", "Unable to find file: ") + label +
            localize("deleteDataSet.notFound.error2", " was probably already deleted."));
        } else {
            vscode.window.showErrorMessage(err);
        }
        throw err;
    }

    // remove node from tree
    if (fav) {
        datasetProvider.mSessionNodes.forEach((ses) => {
            if (node.label.substring(node.label.indexOf("[") + 1, node.label.indexOf("]")) === ses.label.trim()||
                node.mParent.label.substring(node.mParent.label.indexOf("["), node.mParent.label.indexOf("]")) === ses.label) {
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
    datasetProvider.refresh();

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
 * @param {ZoweNode} node - The session node
 * @param {DatasetTree} datasetProvider - Current DatasetTree used to populate the TreeView
 * @returns {Promise<void>}
 */
export async function enterPattern(node: ZoweNode, datasetProvider: DatasetTree) {
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
    node.label = node.label.trim()+ " ";
    node.label.trim();
    node.tooltip = node.pattern = pattern.toUpperCase();
    node.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    node.dirty = true;
    node.iconPath = utils.applyIcons(node, ICON_STATE_OPEN);
    datasetProvider.addHistory(node.pattern);
}

/**
 * Returns the profile for the specified node
 *
 * @export
 * @param {ZoweNode} node
 */
export function getProfile(node: ZoweNode) {
    let profile = node.getSessionNode().label.trim();
    // if this is a favorite node, further extraction is necessary
    if (profile.includes("[")) {
        profile = profile.substring(profile.indexOf("[") + 1, profile.indexOf("]"));  // TODO MISSED TESTING
    }
    return profile;
}

/**
 * Returns the profile for the specified node
 *
 * @export
 * @param {ZoweUSSNode} node
 */
export function getUSSProfile(node: ZoweUSSNode) {
    const profile = node.getSessionNode().mProfileName;
    return profile;
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
    const limit= 5;
    const bracket = label.indexOf("(");
    const split = (bracket > -1) ? label.substr(0, bracket).split(".", limit) : label.split(".", limit);
    for (let i = split.length - 1 ; i > 0; i--) {
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
        if (split[i] === "XML" ) {
            return label.concat(".xml");
        }
        if (split[i] === "ASM" || split[i].indexOf("ASSEMBL") > -1 ) {
            return label.concat(".asm");
        }
        if (split[i] === "LOG" || split[i].indexOf("SPFLOG") > -1 ) {
            return label.concat(".log");
        }
    }
    return label;
}

/**
 * Returns the file path for the ZoweNode
 *
 * @export
 * @param {string} label - If node is a member, label includes the name of the PDS
 * @param {ZoweNode} node
 */
export function getDocumentFilePath(label: string, node: ZoweNode) {
    return path.join(DS_DIR, "/" + getProfile(node) + "/" + appendSuffix(label) );
}

/**
 * Returns the local file path for the ZoweUSSNode
 *
 * @export
 * @param {ZoweUSSNode} node
 */
export function getUSSDocumentFilePath(node: ZoweUSSNode) {
    return path.join(USS_DIR, "/" + getUSSProfile(node) + "/", node.fullPath);
}

/**
 * Downloads and displays a PS in a text editor view
 *
 * @param {ZoweNode} node
 */
export async function openPS(node: ZoweNode, previewMember: boolean, datasetProvider?: DatasetTree) {
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
                usrNme = values [0];
                passWrd = values [1];
                baseEncd = values [2];
            }
        } catch (error) {
            vscode.window.showErrorMessage(error.message);
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
            switch (node.mParent.contextValue) {
                case (FAVORITE_CONTEXT):
                    label = node.label.substring(node.label.indexOf(":") + 1).trim();
                    break;
                case (DS_PDS_CONTEXT + FAV_SUFFIX):
                    label = node.mParent.label.substring(node.mParent.label.indexOf(":") + 1).trim() + "(" + node.label.trim()+ ")";
                    break;
                case (DS_SESSION_CONTEXT):
                    label = node.label.trim();
                    break;
                case (DS_PDS_CONTEXT):
                    label = node.mParent.label.trim() + "(" + node.label.trim()+ ")";
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
                    return ZoweExplorerApiRegister.getMvsApi(node.profile).getContents(label, { // TODO MISSED TESTING
                        file: documentFilePath,
                        returnEtag: true
                    });
                });
                node.setEtag(response.apiResponse.etag);
            }
            const document = await vscode.workspace.openTextDocument(getDocumentFilePath(label, node));
            if (previewMember === true) {
                await vscode.window.showTextDocument(document);
                }
                else {
                    await vscode.window.showTextDocument(document, {preview: false});
                }
        } catch (err) {
            log.error(localize("openPS.log.error.openDataSet", "Error encountered when opening data set! ") + JSON.stringify(err));
            vscode.window.showErrorMessage(err.message);
            throw (err);
        }
    }
}

/**
 * Refreshes treeView
 *
 * @param {DataSetTree} datasetProvider
 */
export async function refreshAll(datasetProvider: DatasetTree) {
    log.debug(localize("refreshAll.log.debug.refreshDataSet", "Refreshing data set tree view"));
    datasetProvider.mSessionNodes.forEach((sessNode) => {
        if (sessNode.contextValue === DS_SESSION_CONTEXT) {
            utils.labelHack(sessNode);
            sessNode.children = [];
            sessNode.dirty = true;
        }
    });
    datasetProvider.refresh();
    Profiles.getInstance().refresh();
}

/**
 * Refreshes the passed node with current mainframe data
 *
 * @param {ZoweNode} node - The node which represents the dataset
 */
export async function refreshPS(node: ZoweNode) {
    let label;
    try {
        switch (node.mParent.contextValue) {
            case (FAVORITE_CONTEXT):
                label = node.label.substring(node.label.indexOf(":") + 1).trim();
                break;
            case (DS_PDS_CONTEXT + FAV_SUFFIX):
                label = node.mParent.label.substring(node.mParent.label.indexOf(":") + 1).trim() + "(" + node.label.trim()+ ")";
                break;
            case (DS_SESSION_CONTEXT):
                label = node.label.trim();
                break;
            case (DS_PDS_CONTEXT):
                label = node.mParent.label.trim() + "(" + node.label.trim() + ")";
                break;
            default:
                throw Error(localize("refreshPS.error.invalidNode", "refreshPS() called from invalid node."));
        }
        const documentFilePath = getDocumentFilePath(label, node);
        const response = await ZoweExplorerApiRegister.getMvsApi(node.profile).getContents(label, {
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
            vscode.window.showErrorMessage(err.message);
        }
    }
}

/**
 * Refreshes the passed node with current mainframe data
 *
 * @param {ZoweUSSNode} node - The node which represents the file
 */
export async function refreshUSS(node: ZoweUSSNode) {
    let label;
    switch (node.mParent.contextValue) {
        case (USS_DIR_CONTEXT + FAV_SUFFIX):
            label = node.fullPath;
            break;
        case (USS_DIR_CONTEXT):
            label = node.fullPath;
            break;
        case (USS_SESSION_CONTEXT):
            label = node.label;
            break;
        default:
            vscode.window.showErrorMessage(localize("refreshUSS.error.invalidNode", "refreshUSS() called from invalid node."));
            throw Error(localize("refreshUSS.error.invalidNode", "refreshPS() called from invalid node."));
    }
    try {
        const ussDocumentFilePath = getUSSDocumentFilePath(node);
        const response = await ZoweExplorerApiRegister.getUssApi(node.profile).getContents(node.fullPath, {
            file: ussDocumentFilePath,
            returnEtag: true
        });
        node.setEtag(response.apiResponse.etag);

        const document = await vscode.workspace.openTextDocument(ussDocumentFilePath);
        vscode.window.showTextDocument(document);
        // if there are unsaved changes, vscode won't automatically display the updates, so close and reopen
        if (document.isDirty) {
            await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
            vscode.window.showTextDocument(document);
        }
    } catch (err) {
        if (err.message.includes(localize("refreshUSS.error.notFound", "not found"))) {
            vscode.window.showInformationMessage(localize("refreshUSS.file1", "Unable to find file: ") + label +
            localize("refreshUSS.file2", " was probably deleted."));
        } else {
            vscode.window.showErrorMessage(err);
        }
    }
}

function checkForAddedSuffix(filename: string): boolean {
    // identify how close to the end of the string the last . is
    const dotPos = filename.length - ( 1 + filename.lastIndexOf(".") );
    // tslint:disable-next-line: no-magic-numbers
    return ((dotPos >= 2 && dotPos <= 4 ) && // if the last characters are 2 to 4 long and lower case it has been added
        ((filename.substring(filename.length - dotPos) ===  filename.substring(filename.length - dotPos).toLowerCase())));

}

/**
 * Uploads the file to the mainframe
 *
 * @export
 * @param {vscode.TextDocument} doc - TextDocument that is being saved
 */
export async function saveFile(doc: vscode.TextDocument, datasetProvider: DatasetTree) {
    // Check if file is a data set, instead of some other file
    log.debug(localize("saveFile.log.debug.request", "requested to save data set: ") + doc.fileName);
    const docPath = path.join(doc.fileName, "..");
    log.debug("requested to save data set: " + doc.fileName);
    if (docPath.toUpperCase().indexOf(DS_DIR.toUpperCase()) === -1 ) {
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
    let node: ZoweNode;
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
            return vscode.window.showErrorMessage(err.message + "\n" + err.stack);
        }
    }
    // Get specific node based on label and parent tree (session / favorites)
    let nodes: ZoweNode[];
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
    let uploadOptions: IUploadOptions;
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
            return ZoweExplorerApiRegister.getMvsApi(node.profile).putContents(doc.fileName, label, uploadOptions); // TODO MISSED TESTING
        });
        if (uploadResponse.success) {
            vscode.window.showInformationMessage(uploadResponse.commandResponse);  // TODO MISSED TESTING
            // set local etag with the new etag from the updated file on mainframe
            node.setEtag(uploadResponse.apiResponse[0].etag);
        } else if (!uploadResponse.success && uploadResponse.commandResponse.includes(localize("saveFile.error.ZosmfEtagMismatchError", "Rest API failure with HTTP(S) status 412"))) {
            const downloadResponse = await ZoweExplorerApiRegister.getMvsApi(node.profile).getContents(label, {
                file: doc.fileName,
                returnEtag: true});
            // re-assign etag, so that it can be used with subsequent requests
            const downloadEtag = downloadResponse.apiResponse.etag;
            if (downloadEtag !== node.getEtag()) {
                node.setEtag(downloadEtag);
            }
            vscode.window.showWarningMessage(localize("saveFile.error.etagMismatch","Remote file has been modified in the meantime.\nSelect 'Compare' to resolve the conflict."));
            // Store document in a separate variable, to be used on merge conflict
            const oldDoc = doc;
            const oldDocText = oldDoc.getText();
            const startPosition = new vscode.Position(0,0);
            const endPosition = new vscode.Position(oldDoc.lineCount,0);
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
        vscode.window.showErrorMessage(err.message);  // TODO MISSED TESTING
    }
}

/**
 * Uploads the file to the mainframe
 *
 * @export
 * @param {Session} session - Desired session
 * @param {vscode.TextDocument} doc - TextDocument that is being saved
 */
export async function saveUSSFile(doc: vscode.TextDocument, ussFileProvider: USSTree) {
    log.debug(localize("saveUSSFile.log.debug.saveRequest", "save requested for USS file ") + doc.fileName);
    const start = path.join(USS_DIR + path.sep).length;
    const ending = doc.fileName.substring(start);
    const sesName = ending.substring(0, ending.indexOf(path.sep));
    const remote = ending.substring(sesName.length).replace(/\\/g, "/");

    // get session from session name
    let documentSession: Session;
    let binary;
    let node: ZoweUSSNode;
    const sesNode = (await ussFileProvider.mSessionNodes.find((child) => child.mProfileName && child.mProfileName.trim()=== sesName.trim()));
    if (sesNode) {
        documentSession = sesNode.getSession();
        binary = Object.keys(sesNode.binaryFiles).find((child) => child === remote) !== undefined;
    }
    // Get specific node based on label and parent tree (session / favorites)
    let nodes: ZoweUSSNode[];
    if (!sesNode || sesNode.children.length === 0) {
        // saving from favorites
        nodes = utils.concatUSSChildNodes(ussFileProvider.mFavorites);
    } else {
        // saving from session
        nodes = utils.concatUSSChildNodes([sesNode]);
    }
    node = await nodes.find((zNode) => {
        if (zNode.contextValue === DS_FAV_TEXT_FILE_CONTEXT || zNode.contextValue === DS_TEXT_FILE_CONTEXT) {
            return (zNode.fullPath.trim() === remote);
        } else {
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
        const uploadResponse = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: localize("saveUSSFile.response.title", "Saving file...")
        }, () => {
            return ZoweExplorerApiRegister.getUssApi(sesNode.profile).putContents(
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
            const downloadResponse = await ZoweExplorerApiRegister.getUssApi(node.profile).getContents(
                node.fullPath, {
                file: getUSSDocumentFilePath(node),
                binary,
                returnEtag: true
            });
            // re-assign etag, so that it can be used with subsequent requests
            const downloadEtag = downloadResponse.apiResponse.etag;
            if (downloadEtag !== etagToUpload) {
                node.setEtag(downloadEtag);
            }
            vscode.window.showWarningMessage(localize("saveFile.error.etagMismatch","Remote file has been modified in the meantime.\nSelect 'Compare' to resolve the conflict."));
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
            vscode.window.showErrorMessage(err.message);
        }
    }
}

/**
 * Downloads and displays a file in a text editor view
 *
 * @param {ZoweUSSNode} node
 */
export async function openUSS(node: ZoweUSSNode, download = false, previewFile: boolean, ussFileProvider?: USSTree) {
    if ((!node.getSession().ISession.user) || (!node.getSession().ISession.password)) {
        try {
            const values = await Profiles.getInstance().promptCredentials(node.mProfileName);
            if (values !== undefined) {
                usrNme = values [0];
                passWrd = values [1];
                baseEncd = values [2];
            }
        } catch (error) {
            vscode.window.showErrorMessage(error.message);
        }
        if (usrNme !== undefined && passWrd !== undefined && baseEncd !== undefined) {
            node.getSession().ISession.user = usrNme;
            node.getSession().ISession.password = passWrd;
            node.getSession().ISession.base64EncodedAuth = baseEncd;
            validProfile = 0;
        } else {
            return;
        }
        await ussFileProvider.refreshElement(node);
        await ussFileProvider.refresh();
    } else {
        validProfile = 0;
    }
    if (validProfile === 0) {
        try {
            let label: string;
            switch (node.mParent.contextValue) {
                case (FAVORITE_CONTEXT):
                    label = node.label.substring(node.label.indexOf(":") + 1).trim();
                    break;
                // Handle file path for files in directories and favorited directories
                case (USS_DIR_CONTEXT):
                case (USS_DIR_CONTEXT + FAV_SUFFIX):
                    label = node.fullPath;
                    break;
                case (USS_SESSION_CONTEXT):
                    label = node.label;
                    break;
                default:
                    vscode.window.showErrorMessage(localize("openUSS.error.invalidNode", "open() called from invalid node."));
                    throw Error(localize("openUSS.error.invalidNode", "open() called from invalid node."));
            }
            log.debug(localize("openUSS.log.debug.request", "requesting to open a uss file ") + label);
            // if local copy exists, open that instead of pulling from mainframe
            const documentFilePath = getUSSDocumentFilePath(node);
            if (download || !fs.existsSync(documentFilePath)) {
                const chooseBinary = node.binary ||
                    await ZoweExplorerApiRegister.getUssApi(node.profile).isFileTagBinOrAscii(node.fullPath);
                const response = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Opening USS file..."},
                    function downloadUSSFile() {
                        return ZoweExplorerApiRegister.getUssApi(node.profile).getContents(
                            node.fullPath, { // TODO MISSED TESTING
                            file: documentFilePath,
                            binary: chooseBinary,
                            returnEtag: true});
                    }
                );
                node.setEtag(response.apiResponse.etag);
            }
            const document = await vscode.workspace.openTextDocument(documentFilePath);
            if (previewFile === true) {
                await vscode.window.showTextDocument(document);
                }
                else {
                    await vscode.window.showTextDocument(document, {preview: false});
                }
        } catch (err) {
            log.error(localize("openUSS.log.error.openFile", "Error encountered when opening USS file: ") + JSON.stringify(err));
            vscode.window.showErrorMessage(err.message);
            throw (err);
        }
    }
}

export async function modifyCommand(job: Job) {
    try {
        const command = await vscode.window.showInputBox({ prompt: localize("modifyCommand.command.prompt", "Modify Command") });
        if (command !== undefined) {
            const response = await zowe.IssueCommand.issueSimple(job.session, `f ${job.job.jobname},${command}`);
            vscode.window.showInformationMessage(localize("modifyCommand.response", "Command response: ") + response.commandResponse);
        }
    } catch (error) {
        vscode.window.showErrorMessage(error.message);
    }
}

export async function stopCommand(job: Job) {
    try {
        const response = await zowe.IssueCommand.issueSimple(job.session, `p ${job.job.jobname}`);
        vscode.window.showInformationMessage(localize("stopCommand.response", "Command response: ") + response.commandResponse);
    } catch (error) {
        vscode.window.showErrorMessage(error.message);
    }
}

export async function getSpoolContent(session: string, spool: IJobFile) {
    const zosmfProfile = Profiles.getInstance().loadNamedProfile(session);
    const spoolSess = zowe.ZosmfSession.createBasicZosmfSession(zosmfProfile.profile);
    if ((!spoolSess.ISession.user) || (!spoolSess.ISession.password)) {
        try {
            const values = await Profiles.getInstance().promptCredentials(session);
            if (values !== undefined) {
                usrNme = values [0];
                passWrd = values [1];
                baseEncd = values [2];
            }
        } catch (error) {
            vscode.window.showErrorMessage(error.message);
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
            vscode.window.showErrorMessage(error.message);
        }
    }
}

export async function setOwner(job: Job, jobsProvider: ZosJobsProvider) {
    const newOwner = await vscode.window.showInputBox({ prompt: localize("setOwner.newOwner.prompt.owner", "Owner") });
    job.owner = newOwner;
    jobsProvider.refreshElement(job);
}

export async function setPrefix(job: Job, jobsProvider: ZosJobsProvider) {
    const newPrefix = await vscode.window.showInputBox({ prompt: localize("setOwner.newOwner.prompt.prefix", "Prefix") });
    job.prefix = newPrefix;
    jobsProvider.refreshElement(job);
}

export async function refreshJobsServer(node: Job, jobsProvider: ZosJobsProvider) {
    let sesNamePrompt: string;
    if (node.contextValue.endsWith(FAV_SUFFIX)) {
        sesNamePrompt = node.label.substring(1, node.label.indexOf("]"));
    } else {
        sesNamePrompt = node.label;
    }
    if ((!node.session.ISession.user ) || (!node.session.ISession.password)) {
        try {
            const values = await Profiles.getInstance().promptCredentials(sesNamePrompt);
            if (values !== undefined) {
                usrNme = values [0];
                passWrd = values [1];
                baseEncd = values [2];
            }
        } catch (error) {
            vscode.window.showErrorMessage(error.message);
        }
        if (usrNme !== undefined && passWrd !== undefined && baseEncd !== undefined) {
            node.session.ISession.user = usrNme;
            node.session.ISession.password = passWrd;
            node.session.ISession.base64EncodedAuth = baseEncd;
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
