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
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { ZoweNode } from "./ZoweNode";
import { Logger, AbstractSession, TextUtils } from "@brightside/imperative";
import { DatasetTree } from "./DatasetTree";
import { USSTree } from "./USSTree";
import { ZoweUSSNode } from "./ZoweUSSNode";
import * as ussActions from "./uss/ussNodeActions";
import { ZosJobsProvider, Job } from "./zosjobs";
import { ZosSpoolProvider } from "./zosspool";
import { IJobFile } from "@brightside/core";
import { loadNamedProfile, loadAllProfiles } from "./ProfileLoader";

// Globals
export const BRIGHTTEMPFOLDER = path.join(__dirname, "..", "..", "resources", "temp");
export const USS_DIR = path.join(BRIGHTTEMPFOLDER, "_U_");
export const DS_DIR = path.join(BRIGHTTEMPFOLDER, "_D_");

let log: Logger;
/**
 * The function that runs when the extension is loaded
 *
 * @export
 * @param {vscode.ExtensionContext} context - Context of vscode at the time that the function is called
 */
export async function activate(context: vscode.ExtensionContext) {
    // Call deactivate before continuing
    // this is to handle if the application crashed on a previous execution and
    // VSC didn't get a chance to call our deactivate to cleanup.
    await deactivate();

    fs.mkdirSync(BRIGHTTEMPFOLDER);
    fs.mkdirSync(USS_DIR);
    fs.mkdirSync(DS_DIR);

    let datasetProvider: DatasetTree;
    let ussFileProvider: USSTree;
    let jobsProvider: ZosJobsProvider;

    try {
        // Initialize Imperative Logger
        const loggerConfig = require(path.join(context.extensionPath, "log4jsconfig.json"));
        loggerConfig.log4jsConfig.appenders.default.filename = path.join(context.extensionPath, "logs", "imperative.log");
        loggerConfig.log4jsConfig.appenders.imperative.filename = path.join(context.extensionPath, "logs", "imperative.log");
        loggerConfig.log4jsConfig.appenders.app.filename = path.join(context.extensionPath, "logs", "zowe.log");
        Logger.initLogger(loggerConfig);

        log = Logger.getAppLogger();
        log.debug("Initialized logger from VSCode extension");

        // Initialize dataset provider with the created session and the selected pattern
        datasetProvider = new DatasetTree();
        await datasetProvider.addSession();
        // Initialize file provider with the created session and the selected fullPath
        ussFileProvider = new USSTree();
        await ussFileProvider.addSession();
    } catch (err) {
        log.error("Error encountered while activating and initializing logger! " + JSON.stringify(err));
        vscode.window.showErrorMessage(err.message); // TODO MISSED TESTING
    }

    await initializeFavorites(datasetProvider);
    await ussActions.initializeUSSFavorites(ussFileProvider);

    // Attaches the TreeView as a subscriber to the refresh event of datasetProvider
    const disposable1 = vscode.window.createTreeView("zowe.explorer", { treeDataProvider: datasetProvider });
    context.subscriptions.push(disposable1);
    const disposable2 = vscode.window.createTreeView("zowe.uss.explorer", { treeDataProvider: ussFileProvider });
    context.subscriptions.push(disposable2);

    vscode.commands.registerCommand("zowe.addSession", async () => addSession(datasetProvider));
    vscode.commands.registerCommand("zowe.addFavorite", async (node) => datasetProvider.addFavorite(node));
    vscode.commands.registerCommand("zowe.refreshAll", () => refreshAll(datasetProvider));
    vscode.commands.registerCommand("zowe.refreshNode", (node) => refreshPS(node));
    vscode.commands.registerCommand("zowe.pattern", (node) => enterPattern(node, datasetProvider));
    vscode.commands.registerCommand("zowe.ZoweNode.openPS", (node) => openPS(node));
    vscode.workspace.onDidSaveTextDocument(async (savedFile) => {
        log.debug("File was saved -- determining whether the file is a USS file or Data set.\n Comparing (case insensitive) "+
        "%s against directory %s and %s",
            savedFile.fileName, DS_DIR, USS_DIR);
        if (savedFile.fileName.toUpperCase().indexOf(DS_DIR.toUpperCase()) >= 0) {
            log.debug("File is a data set-- saving ");
            await saveFile(savedFile, datasetProvider); // TODO MISSED TESTING
        } else if (savedFile.fileName.toUpperCase().indexOf(USS_DIR.toUpperCase()) >= 0) {
            log.debug("File is a USS file -- saving");
            await saveUSSFile(savedFile, ussFileProvider); // TODO MISSED TESTING
        } else {
            log.debug("File %s is not a data set or USS file ", savedFile.fileName);
        }
    });
    vscode.commands.registerCommand("zowe.createDataset", (node) => createFile(node, datasetProvider));
    vscode.commands.registerCommand("zowe.createMember", (node) => createMember(node, datasetProvider));
    vscode.commands.registerCommand("zowe.deleteDataset", (node) => deleteDataset(node, datasetProvider));
    vscode.commands.registerCommand("zowe.deletePDS", (node) => deleteDataset(node, datasetProvider));
    vscode.commands.registerCommand("zowe.deleteMember", (node) => deleteDataset(node, datasetProvider));
    vscode.commands.registerCommand("zowe.removeSession", async (node) => datasetProvider.deleteSession(node));
    vscode.commands.registerCommand("zowe.removeFavorite", async (node) => datasetProvider.removeFavorite(node));
    vscode.commands.registerCommand("zowe.safeSave", async (node) => safeSave(node));
    vscode.commands.registerCommand("zowe.saveSearch", async (node) => datasetProvider.addFavorite(node));
    vscode.commands.registerCommand("zowe.removeSavedSearch", async (node) => datasetProvider.removeFavorite(node));
    vscode.commands.registerCommand("zowe.submitJcl", async () => submitJcl(datasetProvider));
    vscode.commands.registerCommand("zowe.submitMember", async (node) => submitMember(node));
    vscode.commands.registerCommand("zowe.showDSAttributes", (node) => showDSAttributes(node, datasetProvider));
    vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration("Zowe-Persistent-Favorites")) {
            const setting: any = { ...vscode.workspace.getConfiguration().get("Zowe-Persistent-Favorites") };
            if (!setting.persistence) {
                setting.favorites = [];
                await vscode.workspace.getConfiguration().update("Zowe-Persistent-Favorites", setting, vscode.ConfigurationTarget.Global); // MISSED
            }
        }
    });

    vscode.commands.registerCommand("zowe.uss.addFavorite", async (node) => ussFileProvider.addUSSFavorite(node));
    vscode.commands.registerCommand("zowe.uss.removeFavorite", async (node) => ussFileProvider.removeUSSFavorite(node));
    vscode.commands.registerCommand("zowe.uss.addSession", async () => addUSSSession(ussFileProvider));
    vscode.commands.registerCommand("zowe.uss.refreshAll", () => refreshAllUSS(ussFileProvider));
    vscode.commands.registerCommand("zowe.uss.refreshUSS", (node) => refreshUSS(node));
    vscode.commands.registerCommand("zowe.uss.fullPath", (node) => enterUSSPattern(node, ussFileProvider));
    vscode.commands.registerCommand("zowe.uss.ZoweUSSNode.open", (node) => openUSS(node));
    vscode.commands.registerCommand("zowe.uss.removeSession", async (node) => ussFileProvider.deleteSession(node));
    vscode.commands.registerCommand("zowe.uss.createFile", async (node) => ussActions.createUSSNode(node, ussFileProvider, "file"));
    vscode.commands.registerCommand("zowe.uss.createFolder", async (node) => ussActions.createUSSNode(node, ussFileProvider, "directory"));
    vscode.commands.registerCommand("zowe.uss.deleteNode", async (node) => ussActions.deleteUSSNode(node, ussFileProvider, getUSSDocumentFilePath(node)));
    vscode.commands.registerCommand("zowe.uss.binary", async (node) => changeFileType(node, true, ussFileProvider));
    vscode.commands.registerCommand("zowe.uss.text", async (node) => changeFileType(node, false, ussFileProvider));
    vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration("Zowe-USS-Persistent-Favorites")) {
            const ussSetting: any = { ...vscode.workspace.getConfiguration().get("Zowe-USS-Persistent-Favorites") };
            if (!ussSetting.persistence) {
                ussSetting.favorites = [];
                await vscode.workspace.getConfiguration().update("Zowe-USS-Persistent-Favorites", ussSetting, vscode.ConfigurationTarget.Global);
            }
        }
    });

    // JES
    try {
        // Initialize dataset provider with the created session and the selected pattern
        jobsProvider = new ZosJobsProvider();
        await jobsProvider.addSession();
    } catch (err) {
        vscode.window.showErrorMessage(err.message);
    }

    let spoolProvider: ZosSpoolProvider = new ZosSpoolProvider();

    context.subscriptions.push(vscode.window.createTreeView("zowe.jobs", { treeDataProvider: jobsProvider }));
    context.subscriptions.push(vscode.window.createTreeView("zowe.spool", { treeDataProvider: spoolProvider }));
    vscode.commands.registerCommand("zowe.zosJobsSelectjob", (job) => {
        spoolProvider.setJob(job);
    });
    vscode.commands.registerCommand("zowe.zosJobsOpenspool", (session, spool) => {
        getSpoolContent(session, spool);
    });
    vscode.commands.registerCommand("zowe.deleteJob", (job) => {
        deleteJob(job);
    });
    vscode.commands.registerCommand("zowe.runModifyCommand", (job) => {
        modifyCommand(job);
    });
    vscode.commands.registerCommand("zowe.runStopCommand", (job) => {
        stopCommand(job);
    });
    vscode.commands.registerCommand("zowe.refreshServer", (node) => {
        node.dirty = true;
        jobsProvider.refresh();
    });
    vscode.commands.registerCommand("zowe.refreshAllJobs", () => {
        jobsProvider.mSessionNodes.forEach((node) => node.dirty = true);
        jobsProvider.refresh();
    });
    vscode.commands.registerCommand("zowe.addJobsSession", () => addJobsSession(jobsProvider));
    vscode.commands.registerCommand("zowe.setOwner", (node) => {
        setOwner(node, jobsProvider);
    });
    vscode.commands.registerCommand("zowe.setPrefix", (node) => {
        setPrefix(node, jobsProvider);
    });
    vscode.commands.registerCommand("zowe.removeJobsSession", (node) => jobsProvider.deleteSession(node));
    vscode.commands.registerCommand("zowe.downloadSpool", (job) => downloadSpool(job));
}

/**
 * Download all the spool content for the specified job.
 * 
 * @param job The job to download the spool content from
 */
export async function downloadSpool(job: Job){
    try {
        let dirUri = await vscode.window.showOpenDialog({
            openLabel: "Select",
            canSelectFolders:true,
            canSelectFiles: false,
            canSelectMany: false
        });
        if (dirUri !== undefined) {
            zowe.DownloadJobs.downloadAllSpoolContentCommon(job.session, {
                jobid: job.job.jobid,
                jobname: job.job.jobname,
                outDir: dirUri[0].fsPath
            });
        }
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
    await openUSS(node, true);
    ussFileProvider.refresh();
}

/**
 * Submit the contents of the editor as JCL. 
 * 
 * @export
 * @param {DatasetTree} datasetProvider - our DatasetTree object
 */
export async function submitJcl(datasetProvider: DatasetTree) { // TODO MISSED TESTING

    let doc = vscode.window.activeTextEditor.document;
    log.debug("Submitting JCL in document " + doc.fileName);
    // get session name
    const sessionregex = /\[(.*)(\])(?!.*\])/g
    let sesName = sessionregex.exec(doc.fileName)[1];
    if (sesName.includes("[")) {
        // if submitting from favorites, sesName might be the favorite node, so extract further
        sesName = sessionregex.exec(sesName)[1];
    }

    // get session from session name
    let documentSession;
    const sesNode = (await datasetProvider.getChildren()).find((child) => child.mLabel === sesName);
    if (sesNode) {
        documentSession = sesNode.getSession();
    } else {
        // if submitting from favorites, a session might not exist for this node
        const zosmfProfile = loadNamedProfile(sesName);
        documentSession = zowe.ZosmfSession.createBasicZosmfSession(zosmfProfile.profile);
    }
    if (documentSession == null) {
        log.error("Session for submitting JCL was null or undefined!");
    }
    try {
        let job = await zowe.SubmitJobs.submitJcl(documentSession, doc.getText());
        vscode.window.showInformationMessage("Job submitted " + job.jobid);
    } catch (error) {
        vscode.window.showErrorMessage("Job submission failed\n" + error.message);
    }
}

/**
 * Submit the selected dataset member as a Job.
 * 
 * @export
 * @param node The dataset member
 */
export async function submitMember(node: ZoweNode) {
    const labelregex = /\: (.+)/g;  // TODO MISSED TESTING
    let label;
    switch (node.mParent.contextValue) {
        case ("favorite"):
            label = labelregex.exec(node.mLabel)[1];
            break;
        case ("pdsf"):
            label = labelregex.exec(node.mParent.mLabel)[1] + "(" + node.mLabel + ")";
            break;
        case ("session"):
            label = node.mLabel;
            break;
        case ("pds"):
            label = node.mParent.mLabel + "(" + node.mLabel + ")";
            break;
        default:
            vscode.window.showErrorMessage("submitMember() called from invalid node.");
            throw Error("submitMember() called from invalid node.");
    }
    try {
        let job = await zowe.SubmitJobs.submitJob(node.getSession(), label);
        vscode.window.showInformationMessage("Job submitted " + job.jobid);
    } catch (error) {
        vscode.window.showErrorMessage("Job submission failed\n" + error.message);
    }
}

/**
 * Adds a new Profile to the Dataset treeview by clicking the 'Plus' button and
 * selecting which profile you would like to add from the drop-down that appears.
 * The profiles that are in the tree view already will not appear in the
 * drop-down
 *
 * @export
 * @param {DatasetTree} datasetProvider - our datasetTree object
 */
export async function addSession(datasetProvider: DatasetTree) {
    let allProfiles;
    try {
        allProfiles = loadAllProfiles();
    } catch (err) {
        log.error("Error encountered when adding session! " + JSON.stringify(err));
        vscode.window.showErrorMessage(`Unable to load all profiles: ${err.message}`);
        throw (err);
    }

    let profileNamesList = allProfiles.map((profile) => {
        return profile.name;
    });
    if (profileNamesList.length > 0) {
        profileNamesList = profileNamesList.filter((profileName) =>
            // Find all cases where a profile is not already displayed
            !datasetProvider.mSessionNodes.find((sessionNode) =>
                sessionNode.mLabel === profileName
            )
        );
    } else {
        vscode.window.showInformationMessage("No profiles detected");
        return;
    }
    if (profileNamesList.length > 0) {
        const quickPickOptions: vscode.QuickPickOptions = {
            placeHolder: "Select a Profile to Add to the Data Set Explorer",
            ignoreFocusOut: true,
            canPickMany: false
        };
        const chosenProfile = await vscode.window.showQuickPick(profileNamesList, quickPickOptions);
        await datasetProvider.addSession(chosenProfile);
    } else {
        vscode.window.showInformationMessage("No more profiles to add");
    }
}

/**
 * Adds a new Profile to the USS treeview by clicking the 'Plus' button and
 * selecting which profile you would like to add from the drop-down that appears.
 * The profiles that are in the tree view already will not appear in the
 * drop-down
 *
 * @export
 * @param {USSTree} ussFileProvider - our ussTree object
 */
export async function addUSSSession(ussFileProvider: USSTree) {
    let allProfiles;
    try {
        allProfiles = loadAllProfiles();
    } catch (err) {
        log.error("Error encountered when adding USS session: " + JSON.stringify(err));
        vscode.window.showErrorMessage(`Unable to load all profiles: ${err.message}`);  // TODO MISSED TESTING
        throw (err);
    }

    let profileNamesList = allProfiles.map((profile) => {
        return profile.name;
    });
    if (profileNamesList) {
        profileNamesList = profileNamesList.filter((profileName) =>
            // Find all cases where a profile is not already displayed
            !ussFileProvider.mSessionNodes.find((sessionNode) =>
                sessionNode.mLabel === profileName
            )
        );
    } else {
        vscode.window.showInformationMessage("No profiles detected");  // TODO MISSED TESTING
        return;
    }
    if (profileNamesList.length) {
        const quickPickOptions: vscode.QuickPickOptions = {
            placeHolder: "Select a Profile to Add to the USS Explorer",
            ignoreFocusOut: true,
            canPickMany: false
        };
        const chosenProfile = await vscode.window.showQuickPick(profileNamesList, quickPickOptions);
        await ussFileProvider.addSession(chosenProfile);
    } else {
        vscode.window.showInformationMessage("No more profiles to add");  // TODO MISSED TESTING
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
        placeHolder: "Type of Data Set to be Created",
        ignoreFocusOut: true,
        canPickMany: false
    };
    const types = [
        "Data Set Binary",
        "Data Set C",
        "Data Set Classic",
        "Data Set Partitioned",
        "Data Set Sequential"
    ];
    log.debug("Creating new data set");
    // get data set type
    const type = await vscode.window.showQuickPick(types, quickPickOptions);
    if (types.indexOf(type) < 0) {
        vscode.window.showErrorMessage("Invalid data set type.");
        return;
    }

    let typeEnum;
    let createOptions;
    switch (type) {
        case "Data Set Binary":
            typeEnum = zowe.CreateDataSetTypeEnum.DATA_SET_BINARY;
            createOptions = vscode.workspace.getConfiguration("Zowe-Default-Datasets-Binary");
            break;
        case "Data Set C":
            typeEnum = zowe.CreateDataSetTypeEnum.DATA_SET_C;
            createOptions = vscode.workspace.getConfiguration("Zowe-Default-Datasets-C");
            break;
        case "Data Set Classic":
            typeEnum = zowe.CreateDataSetTypeEnum.DATA_SET_CLASSIC;
            createOptions = vscode.workspace.getConfiguration("Zowe-Default-Datasets-Classic");
            break;
        case "Data Set Partitioned":
            typeEnum = zowe.CreateDataSetTypeEnum.DATA_SET_PARTITIONED;
            createOptions = vscode.workspace.getConfiguration("Zowe-Default-Datasets-PDS");
            break;
        case "Data Set Sequential":
            typeEnum = zowe.CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL;
            createOptions = vscode.workspace.getConfiguration("Zowe-Default-Datasets-PS");
            break;
    }

    // get name of data set
    const name = await vscode.window.showInputBox({ placeHolder: "Name of Data Set" });

    try {
        await zowe.Create.dataSet(node.getSession(), typeEnum, name, createOptions);
        node.dirty = true;
        datasetProvider.refresh();
    } catch (err) {
        log.error("Error encountered when creating data set! " + JSON.stringify(err));
        vscode.window.showErrorMessage(err.message);
        throw (err);
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
    const name = await vscode.window.showInputBox({ placeHolder: "Name of Member" });
    log.debug("creating new data set member of name " + name);
    if (name) {
        let label = parent.mLabel;
        if (parent.contextValue === "pdsf") {
            label = parent.mLabel.substring(parent.mLabel.indexOf(":") + 2); // TODO MISSED TESTING
        }

        try {
            await zowe.Upload.bufferToDataSet(parent.getSession(), Buffer.from(""), label + "(" + name + ")");
        } catch (err) {
            log.error("Error encountered when creating member! " + JSON.stringify(err));
            vscode.window.showErrorMessage(`Unable to create member: ${err.message}`);
            throw (err);
        }
        parent.getSessionNode().dirty = true;
        datasetProvider.refresh();
        openPS(new ZoweNode(name, vscode.TreeItemCollapsibleState.None, parent, null));
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

    let label = parent.mLabel;
    if (parent.contextValue === "pdsf" || parent.contextValue === "dsf") {
        label = parent.mLabel.substring(parent.mLabel.indexOf(":") + 2); // TODO MISSED TESTING
    }

    log.debug("showing attributes of data set " + label);
    let attributes: any;
    try {
        attributes = await zowe.List.dataSet(parent.getSession(), label, { attributes: true });
        attributes = attributes.apiResponse.items;
        attributes = attributes.filter((dataSet) => {
            return dataSet.dsname.toUpperCase() === label.toUpperCase();
        });
        if (attributes.length === 0) {
            throw new Error("No matching data set names found for query: " + label);
        }
    } catch (err) {
        log.error("Error encountered when listing attributes! " + JSON.stringify(err));
        vscode.window.showErrorMessage(`Unable to list attributes: ${err.message}`);
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
    const webviewHTML = `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>${label} Attributes</title>
    </head>
    <body>
    <font size="+1">
     ${attributesText.replace(/\n/g, "</br>")}
     </font>
    </body>
    </html>`;
    const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;
    const panel: vscode.WebviewPanel = vscode.window.createWebviewPanel(
			"zowe",
			label + ' Attributes',
			column || vscode.ViewColumn.One,
			{
				
			}
        );;
        panel.webview.html = webviewHTML;

}


function cleanDir(directory) {
    if (!fs.existsSync(directory)) {
        return;
    }
    fs.readdirSync(directory).forEach((file) => {
        const fullpath = path.join(directory, file)
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
 * Cleans up the default local storage directory
 *
 * @export
 */
export async function deactivate() {
    // logger hasn't necessarily been initialized yet, don't use the `log` in this function
    if (!fs.existsSync(BRIGHTTEMPFOLDER)) {
        return;
    }
    try {
        cleanDir(BRIGHTTEMPFOLDER)
    } catch (err) {
        vscode.window.showErrorMessage("Unable to delete temporary folder. " + err);  // TODO MISSED TESTING
    }
}

/**
 * Deletes a dataset
 *
 * @export
 * @param {ZoweNode} node - The node to be deleted
 * @param {DatasetTree} datasetProvider - the tree which contains the nodes
 */
export async function deleteDataset(node: ZoweNode, datasetProvider: DatasetTree) {
    log.debug("Deleting data set " + node.label);
    const quickPickOptions: vscode.QuickPickOptions = {
        placeHolder: `Are you sure you want to delete ${node.label}`,
        ignoreFocusOut: true,
        canPickMany: false
    };
    // confirm that the user really wants to delete
    if (await vscode.window.showQuickPick(["Yes", "No"], quickPickOptions) === "No") {
        log.debug("User picked no. Cancelling delete of data set");
        return;
    }

    let label = "";
    let fav = false;
    switch (node.mParent.contextValue) {
        case ("favorite"):
            label = node.mLabel.substring(node.mLabel.indexOf(":") + 1).trim();  // TODO MISSED TESTING
            fav = true; // MISSED
            break; // MISSED
        case ("pdsf"):
            label = node.mParent.mLabel.substring(node.mParent.mLabel.indexOf(":") + 1).trim() + "(" + node.mLabel + ")";
            fav = true;
            break;
        case ("session"):
            label = node.mLabel;
            break;
        case ("pds"):
            label = node.mParent.mLabel + "(" + node.mLabel + ")";
            break;
        default:
            vscode.window.showErrorMessage("deleteDataSet() called from invalid node.");  // TODO MISSED TESTING
            throw Error("deleteDataSet() called from invalid node.");
    }

    try {
        await zowe.Delete.dataSet(node.getSession(), label);
    } catch (err) {
        log.error("Error encountered when deleting data set! " + JSON.stringify(err));
        if (err.message.includes("not found")) {
            vscode.window.showInformationMessage(`Unable to find file: ${label} was probably already deleted.`);
        } else {
            vscode.window.showErrorMessage(err);
        }
    }

    // remove node from tree
    if (fav) {
        datasetProvider.mSessionNodes.forEach((ses) => {
            if (node.mLabel.substring(node.mLabel.indexOf("[") + 1, node.mLabel.indexOf("]")) === ses.mLabel ||
                node.mParent.mLabel.substring(node.mParent.mLabel.indexOf("["), node.mParent.mLabel.indexOf("]")) === ses.mLabel) {
                ses.dirty = true;  // TODO MISSED TESTING
            }
        });
    } else {
        node.getSessionNode().dirty = true;
    }

    const temp = node.mLabel;
    node.mLabel = "[" + node.getSessionNode().mLabel + "]: " + node.mLabel;
    datasetProvider.removeFavorite(node);
    node.mLabel = temp;
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
    log.debug("Prompting the user for a data set pattern");
    let pattern: string;
    if (node.contextValue === "session") {
        // manually entering a search
        const options: vscode.InputBoxOptions = {
            prompt: "Search data sets by entering patterns: use a comma to separate multiple patterns",
            value: node.pattern
        };
        // get user input
        pattern = await vscode.window.showInputBox(options);
        if (!pattern) {
            vscode.window.showInformationMessage("You must enter a pattern.");
            return;
        }
    } else {
        // executing search from saved search in favorites
        pattern = node.mLabel.substring(node.mLabel.indexOf(":") + 2);  // TODO MISSED TESTING
        const session = node.mLabel.substring(node.mLabel.indexOf("[") + 1, node.mLabel.indexOf("]"));
        await datasetProvider.addSession(session);
        node = datasetProvider.mSessionNodes.find((tempNode) => tempNode.mLabel === session);
    }

    // update the treeview with the new pattern
    // TODO figure out why a label change is needed to refresh the treeview,
    // instead of changing the collapsible state
    // change label so the treeview updates
    node.label = node.label + " ";
    node.label.trim();
    node.tooltip = node.pattern = pattern.toUpperCase();
    node.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    node.dirty = true;
    datasetProvider.refresh();
}

/**
 * Prompts the user for a path, and populates the [TreeView]{@link vscode.TreeView} based on the path
 *
 * @param {ZoweUSSNode} node - The session node
 * @param {ussTree} ussFileProvider - Current ussTree used to populate the TreeView
 * @returns {Promise<void>}
 */
export async function enterUSSPattern(node: ZoweUSSNode, ussFileProvider: USSTree) {
    log.debug("Prompting the user for a USS path");
    let remotepath: string;
    // manually entering a search
    const options: vscode.InputBoxOptions = {
        prompt: "Search Unix System Services (USS) by entering a path name starting with a /",
        value: node.fullPath
    };
    // get user input
    remotepath = await vscode.window.showInputBox(options);
    if (!remotepath) {
        vscode.window.showInformationMessage("You must enter a path.");
        return;
    }

    // update the treeview with the new path
    // TODO figure out why a label change is needed to refresh the treeview,
    // instead of changing the collapsible state
    // change label so the treeview updates
    node.label = node.label + " ";
    node.label.trim();
    // Sanitization: Replace multiple preceding forward slashes with just one forward slash
    node.tooltip = node.fullPath = remotepath.replace(/\/\/+/, "/");
    node.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    node.dirty = true;
    ussFileProvider.refresh();
}

/**
 * Returns the profile for the specified node
 *
 * @export
 * @param {ZoweNode} node
 */
export function getProfile(node: ZoweNode) {
    let profile = node.getSessionNode().mLabel;
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
    let profile = node.getSessionNode().mLabel;
    return profile;
}

/**
 * Returns the file path for the ZoweNode
 *
 * @export
 * @param {string} label - If node is a member, label includes the name of the PDS
 * @param {ZoweNode} node
 */
export function getDocumentFilePath(label: string, node: ZoweNode) {
    return path.join(DS_DIR, label + "[" + getProfile(node) + "]");
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
 * Initializes the favorites section by reading from a file
 *
 * @export
 * @param {DatasetTree} datasetProvider
 */
export async function initializeFavorites(datasetProvider: DatasetTree) {
    log.debug("initializing favorites");
    const lines: string[] = vscode.workspace.getConfiguration("Zowe-Persistent-Favorites").get("favorites");
    for (const line of lines) {
        if (line === "") {
            continue;
        }
        // validate line
        const favoriteDataSetPattern = /^\[.+\]\:\s[a-zA-Z#@\$][a-zA-Z0-9#@\$\-]{0,7}(\.[a-zA-Z#@\$][a-zA-Z0-9#@\$\-]{0,7})*\{p?ds\}$/;
        const favoriteSearchPattern = /^\[.+\]\:\s.*\{session\}$/;
        if (favoriteDataSetPattern.test(line)) {
            const sesName = line.substring(1, line.lastIndexOf("]"));
            const zosmfProfile = loadNamedProfile(sesName);
            const session = zowe.ZosmfSession.createBasicZosmfSession(zosmfProfile.profile);
            let node: ZoweNode;
            if (line.substring(line.indexOf("{") + 1, line.lastIndexOf("}")) === "pds") {
                node = new ZoweNode(line.substring(0, line.indexOf("{")), vscode.TreeItemCollapsibleState.Collapsed,
                    datasetProvider.mFavoriteSession, session);
            } else {
                node = new ZoweNode(line.substring(0, line.indexOf("{")), vscode.TreeItemCollapsibleState.None,
                    datasetProvider.mFavoriteSession, session);
                node.command = { command: "zowe.ZoweNode.openPS", title: "", arguments: [node] };
            }
            node.contextValue += "f";
            datasetProvider.mFavorites.push(node);
        } else if (favoriteSearchPattern.test(line)) {
            const node = new ZoweNode(line.substring(0, line.lastIndexOf("{")),
                vscode.TreeItemCollapsibleState.None, datasetProvider.mFavoriteSession, null);
            node.command = { command: "zowe.pattern", title: "", arguments: [node] };
            const light = path.join(__dirname, "..", "..", "resources", "light", "pattern.svg");
            const dark = path.join(__dirname, "..", "..", "resources", "dark", "pattern.svg");
            node.iconPath = { light, dark };
            node.contextValue = "sessionf";
            datasetProvider.mFavorites.push(node);
        } else {
            vscode.window.showErrorMessage("Favorites file corrupted: " + line);
        }
    }
}

/**
 * Downloads and displays a PS in a text editor view
 *
 * @param {ZoweNode} node
 */
export async function openPS(node: ZoweNode) {
    try {
        let label: string;
        switch (node.mParent.contextValue) {
            case ("favorite"):
                label = node.mLabel.substring(node.mLabel.indexOf(":") + 1).trim();
                break;
            case ("pdsf"):
                label = node.mParent.mLabel.substring(node.mParent.mLabel.indexOf(":") + 1).trim() + "(" + node.mLabel + ")";
                break;
            case ("session"):
                label = node.mLabel;
                break;
            case ("pds"):
                label = node.mParent.mLabel + "(" + node.mLabel + ")";
                break;
            default:
                vscode.window.showErrorMessage("openPS() called from invalid node.");
                throw Error("openPS() called from invalid node.");
        }
        log.debug("opening physical sequential data set from label " + label);
        // if local copy exists, open that instead of pulling from mainframe
        if (!fs.existsSync(getDocumentFilePath(label, node))) {
            await zowe.Download.dataSet(node.getSession(), label, {
                file: getDocumentFilePath(label, node)
            });
        }
        const document = await vscode.workspace.openTextDocument(getDocumentFilePath(label, node));
        await vscode.window.showTextDocument(document);
    } catch (err) {
        log.error("Error encountered when opening data set! " + JSON.stringify(err));
        vscode.window.showErrorMessage(err.message);
        throw (err);
    }
}

/**
 * Refreshes treeView
 *
 * @param {DataSetTree} datasetProvider
 */
export async function refreshAll(datasetProvider: DatasetTree) {
    log.debug("Refreshing data set tree view");
    datasetProvider.mSessionNodes.forEach((node) => {
        node.dirty = true;
    });
    datasetProvider.refresh();
}

/**
 * Refreshes treeView
 *
 * @param {USSTree} ussFileProvider
 */
export async function refreshAllUSS(ussFileProvider: USSTree) {
    ussFileProvider.mSessionNodes.forEach((node) => {
        node.dirty = true;
    });
    ussFileProvider.refresh();
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
            case ("favorite"):
                label = node.mLabel.substring(node.mLabel.indexOf(":") + 1).trim();
                break;
            case ("pdsf"):
                label = node.mParent.mLabel.substring(node.mParent.mLabel.indexOf(":") + 1).trim() + "(" + node.mLabel + ")";
                break;
            case ("session"):
                label = node.mLabel;
                break;
            case ("pds"):
                label = node.mParent.mLabel + "(" + node.mLabel + ")";
                break;
            default:
                throw Error("refreshPS() called from invalid node.");
        }
        await zowe.Download.dataSet(node.getSession(), label, {
            file: getDocumentFilePath(label, node)
        });
        const document = await vscode.workspace.openTextDocument(getDocumentFilePath(label, node));
        vscode.window.showTextDocument(document);
        // if there are unsaved changes, vscode won't automatically display the updates, so close and reopen
        if (document.isDirty) {
            await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
            vscode.window.showTextDocument(document);
        }
    } catch (err) {
        log.error("Error encountered when refreshing data set view: " + JSON.stringify(err));
        if (err.message.includes("not found")) {
            vscode.window.showInformationMessage(`Unable to find file: ${label} was probably deleted.`);
        } else {
            vscode.window.showErrorMessage(err);
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
        case ("directory"):
            label = node.fullPath;
            break;
        case ("uss_session"):
            label = node.mLabel;
            break;
        default:
            vscode.window.showErrorMessage("refreshUSS() called from invalid node.");
            throw Error("refreshPS() called from invalid node.");
    }
    try {
        await zowe.Download.ussFile(node.getSession(), node.fullPath, {
            file: getUSSDocumentFilePath(node)
        });
        const document = await vscode.workspace.openTextDocument(getUSSDocumentFilePath(node));
        vscode.window.showTextDocument(document);
        // if there are unsaved changes, vscode won't automatically display the updates, so close and reopen
        if (document.isDirty) {
            await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
            vscode.window.showTextDocument(document);
        }
    } catch (err) {
        if (err.message.includes("not found")) {
            vscode.window.showInformationMessage(`Unable to find file: ${label} was probably deleted.`);
        } else {
            vscode.window.showErrorMessage(err);
        }
    }
}

/**
 * Checks if there are changes on the mainframe before pushing changes
 *
 * @export
 * @param {ZoweNode} node
 */
export async function safeSave(node: ZoweNode) {

    log.debug("safe save requested for node: " + node.mLabel);
    let label;
    try {
        switch (node.mParent.contextValue) {
            case ("favorite"):
                label = node.mLabel.substring(node.mLabel.indexOf(":") + 1).trim();
                break;
            case ("pdsf"):
                label = node.mParent.mLabel.substring(node.mParent.mLabel.indexOf(":") + 1).trim() + "(" + node.mLabel + ")";
                break;
            case ("session"):
                label = node.mLabel;
                break;
            case ("pds"):
                label = node.mParent.mLabel + "(" + node.mLabel + ")";
                break;
            default:
                throw Error("safeSave() called from invalid node.");
        }
        log.debug("Invoking safesave for data set " + label);
        await zowe.Download.dataSet(node.getSession(), label, {
            file: getDocumentFilePath(label, node)
        });
        const document = await vscode.workspace.openTextDocument(getDocumentFilePath(label, node));
        await vscode.window.showTextDocument(document);
        await vscode.window.activeTextEditor.document.save();
    } catch (err) {
        if (err.message.includes("not found")) {
            vscode.window.showInformationMessage(`Unable to find file: ${label} was probably deleted.`);
        } else {
            vscode.window.showErrorMessage(err.message);
        }
    }
}

/**
 * Uploads the file to the mainframe
 *
 * @export
 * @param {vscode.TextDocument} doc - TextDocument that is being saved
 */
export async function saveFile(doc: vscode.TextDocument, datasetProvider: DatasetTree) {
    // Check if file is a data set, instead of some other file
    log.debug("requested to save data set: " + doc.fileName);
    const docPath = path.join(doc.fileName, "..");
    if (path.relative(docPath, DS_DIR)) {
        log.debug("path.relative returned a non-blank directory." +
            "Assuming we are not in the DS_DIR directory: " + path.relative(docPath, DS_DIR));
        return;
    }

    // get session name
    let sesName = doc.fileName.substring(doc.fileName.indexOf("[") + 1, doc.fileName.lastIndexOf("]"));
    if (sesName.includes("[")) {
        // if saving from favorites, sesName might be the favorite node, so extract further
        sesName = sesName.substring(sesName.indexOf("[") + 1, sesName.indexOf("]"));  // TODO MISSED TESTING
    }

    // get session from session name
    let documentSession;
    const sesNode = (await datasetProvider.getChildren()).find((child) =>
        child.mLabel === sesName);
    if (sesNode) {
        log.debug("Loading session from session node in saveFile()");
        documentSession = sesNode.getSession();
    } else {
        // if saving from favorites, a session might not exist for this node
        log.debug("couldn't find session node, loading profile with CLI profile manager");
        const zosmfProfile = loadNamedProfile(sesName);
        documentSession = zowe.ZosmfSession.createBasicZosmfSession(zosmfProfile.profile);
    }
    if (documentSession == null) {
        log.error("Couldn't locate session when saving data set!");
    }
    // If not a member
    const label = doc.fileName.substring(doc.fileName.lastIndexOf(path.sep) + 1, doc.fileName.indexOf("["));
    log.debug("Saving file " + label);
    if (!label.includes("(")) {
        try {
            // Checks if file still exists on server
            const response = await zowe.List.dataSet(documentSession, label);
            if (!response.apiResponse.items.length) {
                return vscode.window.showErrorMessage("Data set failed to save. Data set may have been deleted on mainframe.");
            }
        } catch (err) {
            vscode.window.showErrorMessage(err.message + "\n" + err.stack);
        }
    }
    try {
        const response = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Saving data set..."
        }, () => {
            return zowe.Upload.pathToDataSet(documentSession, doc.fileName, label);  // TODO MISSED TESTING
        });
        if (response.success) {
            vscode.window.showInformationMessage(response.commandResponse);  // TODO MISSED TESTING
        } else {
            vscode.window.showErrorMessage(response.commandResponse);
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
    log.debug("save requested for USS file " + doc.fileName);
    const start = path.join(USS_DIR + path.sep).length;
    const ending = doc.fileName.substring(start);
    let sesName = ending.substring(0, ending.indexOf(path.sep));
    let remote = ending.substring(sesName.length).replace(/\\/g, '/');

    // get session from session name
    let documentSession;
    const sesNode = (await ussFileProvider.mSessionNodes.find((child) => child.mLabel === sesName.trim()));
    if (sesNode) {
        documentSession = sesNode.getSession();  // TODO MISSED TESTING
    }

    try {
        const response = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Saving file..."
        }, () => {
            return zowe.Upload.fileToUSSFile(documentSession, doc.fileName, remote, sesNode.binary);  // TODO MISSED TESTING
        });
        if (response.success) {
            vscode.window.showInformationMessage(response.commandResponse);
        } else {
            vscode.window.showErrorMessage(response.commandResponse);
        }
    } catch (err) {
        log.error("Error encountered when saving USS file: " + JSON.stringify(err));
        vscode.window.showErrorMessage(err.message);
    }
}

/**
 * Downloads and displays a file in a text editor view
 *
 * @param {ZoweUSSNode} node
 */
export async function openUSS(node: ZoweUSSNode, download = false) {
    try {
        let label: string;
        switch (node.mParent.contextValue) {
            case ("favorite"):
                label = node.mLabel.substring(node.mLabel.indexOf(":") + 1).trim();
                break;
            // Handle file path for files in directories and favorited directories
            case ("directory"):
            case ("directoryf"):
                label = node.fullPath;
                break;
            case ("uss_session"):
                label = node.mLabel;
                break;
            default:
                vscode.window.showErrorMessage("open() called from invalid node.");
                throw Error("open() called from invalid node.");
        }
        log.debug("requesting to open a uss file " + label);
        // if local copy exists, open that instead of pulling from mainframe
        if (download || !fs.existsSync(getUSSDocumentFilePath(node))) {
            await zowe.Download.ussFile(node.getSession(), node.fullPath, {
                file: getUSSDocumentFilePath(node),
                binary: node.binary
            });
        }
        const document = await vscode.workspace.openTextDocument(getUSSDocumentFilePath(node));
        await vscode.window.showTextDocument(document);
    } catch (err) {
        log.error("Error encountered when opening USS file: " + JSON.stringify(err));
        vscode.window.showErrorMessage(err.message);
        throw (err);
    }
}

export async function modifyCommand(job: Job) {
    try {
        let command = await vscode.window.showInputBox({ prompt: "Modify Command" });
        if (command !== undefined) {
            let response = await zowe.IssueCommand.issueSimple(job.session, `f ${job.job.jobname},${command}`);
            vscode.window.showInformationMessage(`Command response: ${response.commandResponse}`);
        }
    } catch (error) {
        vscode.window.showErrorMessage(error.message);
    }
}

export async function stopCommand(job: Job) {
    try {
        let response = await zowe.IssueCommand.issueSimple(job.session, `p ${job.job.jobname}`);
        vscode.window.showInformationMessage(`Command response: ${response.commandResponse}`);
    } catch (error) {
        vscode.window.showErrorMessage(error.message);
    }
}

export async function deleteJob(job: Job) {
    try {
        await zowe.DeleteJobs.deleteJob(job.session, job.job.jobname, job.job.jobid);
        vscode.window.showInformationMessage(`Job ${job.job.jobname}(${job.job.jobid} deleted)`);
    } catch (error) {
        vscode.window.showErrorMessage(error.message);
    }
}

export async function getSpoolContent(session: AbstractSession, spool: IJobFile) {
    try {
        let spoolContent = await zowe.GetJobs.getSpoolContentById(session, spool.jobname, spool.jobid, spool.id);
        const document = await vscode.workspace.openTextDocument({ content: spoolContent });
        await vscode.window.showTextDocument(document);
    } catch (error) {
        vscode.window.showErrorMessage(error.message);
    }
}

export async function setOwner(job: Job, datasetProvider: ZosJobsProvider) {
    let newOwner = await vscode.window.showInputBox({ prompt: "Owner" });
    job.owner = newOwner;
    job.dirty = true;
    datasetProvider.refresh();
}

export async function setPrefix(job: Job, datasetProvider: ZosJobsProvider) {
    let newPrefix = await vscode.window.showInputBox({ prompt: "Prefix" });
    job.prefix = newPrefix;
    job.dirty = true;
    datasetProvider.refresh();
}

export async function addJobsSession(datasetProvider: ZosJobsProvider) {
    let allProfiles;
    try {
        allProfiles = loadAllProfiles();
    } catch (err) {
        vscode.window.showErrorMessage(`Unable to load all profiles: ${err.message}`);
        throw (err);
    }

    let profileNamesList = allProfiles.map((profile) => {
        return profile.name;
    });
    if (profileNamesList) {
        profileNamesList = profileNamesList.filter((profileName) =>
            // Find all cases where a profile is not already displayed
            !datasetProvider.mSessionNodes.find((sessionNode) =>
                sessionNode.mLabel === profileName
            )
        );
    } else {
        vscode.window.showInformationMessage("No profiles detected");
        return;
    }
    if (profileNamesList.length) {
        const quickPickOptions: vscode.QuickPickOptions = {
            placeHolder: "Select a Profile to Add to the Jobs Explorer",
            ignoreFocusOut: true,
            canPickMany: false
        };
        const chosenProfile = await vscode.window.showQuickPick(profileNamesList, quickPickOptions);
        await datasetProvider.addSession(chosenProfile);
    } else {
        vscode.window.showInformationMessage("No more profiles to add");
    }
}
