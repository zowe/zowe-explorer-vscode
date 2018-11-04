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
import { CliProfileManager, Logger } from "@brightside/imperative";
import { DatasetTree } from "./DatasetTree";

// Globals
export const BRIGHTTEMPFOLDER = path.join(__dirname, "..", "..", "resources", "temp");

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

    let datasetProvider: DatasetTree;
    try {
        // Initialize Imperative Logger
        const loggerConfig = require(path.join(context.extensionPath, "log4jsconfig.json"));
        loggerConfig.log4jsConfig.appenders.default.filename = path.join(context.extensionPath, "logs", "imperative.log");
        loggerConfig.log4jsConfig.appenders.imperative.filename = path.join(context.extensionPath, "logs", "imperative.log");
        loggerConfig.log4jsConfig.appenders.app.filename = path.join(context.extensionPath, "logs", "zowe.log");
        Logger.initLogger(loggerConfig);

        // Initialize dataset provider with the created session and the selected pattern
        datasetProvider = new DatasetTree();
        await datasetProvider.addSession();
    } catch (err) {
        vscode.window.showErrorMessage(err.message);
    }

    await initializeFavorites(datasetProvider);

    // Attaches the TreeView as a subscriber to the refresh event of datasetProvider
    const disposable = vscode.window.createTreeView("zowe.explorer", {treeDataProvider: datasetProvider});
    context.subscriptions.push(disposable);

    vscode.commands.registerCommand("zowe.addSession", async () => addSession(datasetProvider));
    vscode.commands.registerCommand("zowe.addFavorite", async (node) => datasetProvider.addFavorite(node));
    vscode.commands.registerCommand("zowe.refreshAll", () => refreshAll(datasetProvider));
    vscode.commands.registerCommand("zowe.refreshNode", (node) => refreshPS(node));
    vscode.commands.registerCommand("zowe.pattern", (node) => enterPattern(node, datasetProvider));
    vscode.commands.registerCommand("zowe.ZoweNode.openPS", (node) => openPS(node));
    vscode.workspace.onDidSaveTextDocument(async (savedFile) => {
        await saveFile(savedFile, datasetProvider);
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
    vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration("Zowe-Persistent-Favorites")) {
            const setting: any = { ...vscode.workspace.getConfiguration().get("Zowe-Persistent-Favorites") };
            if (!setting.persistence) {
                setting.favorites = [];
                await vscode.workspace.getConfiguration().update("Zowe-Persistent-Favorites", setting, vscode.ConfigurationTarget.Global);
            }
        }
    });
}

/**
 * Submit the contents of the editor as JCL. 
 * 
 * @export
 * @param {DatasetTree} datasetProvider - our DatasetTree object
 */
export async function submitJcl(datasetProvider: DatasetTree) {
    let doc = vscode.window.activeTextEditor.document;
    // get session name
    let sesName = doc.fileName.substring(doc.fileName.indexOf("[") + 1, doc.fileName.lastIndexOf("]"));
    if (sesName.includes("[")) {
        // if saving from favorites, sesName might be the favorite node, so extract further
        sesName = sesName.substring(sesName.indexOf("[") + 1, sesName.indexOf("]"));
    }

    // get session from session name
    let documentSession;
    const sesNode = (await datasetProvider.getChildren()).find((child) => child.mLabel === sesName);
    if (sesNode) {
        documentSession = sesNode.getSession();
    } else {
        // if saving from favorites, a session might not exist for this node
        const zosmfProfile = await new CliProfileManager({
            profileRootDirectory: path.join(os.homedir(), ".brightside", "profiles"),
            type: "zosmf"
        }).load({name: sesName});
        documentSession = zowe.ZosmfSession.createBasicZosmfSession(zosmfProfile.profile);
    }
    try {
        let job = await zowe.SubmitJobs.submitJcl(documentSession, doc.getText());
        vscode.window.showInformationMessage("Job submitted " + job.jobid);
    } catch (error) {
        vscode.window.showErrorMessage("Job submission failed\n" + error.message);
    }
}

export async function submitMember(node: ZoweNode) {
    let label;
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
    let profileManager;
    try {
        profileManager = await new CliProfileManager({
            profileRootDirectory: path.join(os.homedir(), ".zowe", "profiles"),
            type: "zosmf"
        });
    } catch (err) {
        vscode.window.showErrorMessage(`Unable to load profile manager: ${err.message}`);
        throw (err);
    }

    let profileNamesList = profileManager.getAllProfileNames();
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
    const name = await vscode.window.showInputBox({placeHolder: "Name of Data Set"});

    try {
        await zowe.Create.dataSet(node.getSession(), typeEnum, name, createOptions);
        node.dirty = true;
        datasetProvider.refresh();
    } catch (err) {
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
    const name = await vscode.window.showInputBox({placeHolder: "Name of Member"});
    if (name) {
        let label = parent.mLabel;
        if (parent.contextValue === "pdsf") {
            label = parent.mLabel.substring(parent.mLabel.indexOf(":") + 2);
        }

        try {
            await zowe.Upload.bufferToDataSet(parent.getSession(), Buffer.from(""), label + "(" + name + ")");
        } catch (err) {
            vscode.window.showErrorMessage(`Unable to create member: ${err.message}`);
            throw (err);
        }
        parent.getSessionNode().dirty = true;
        datasetProvider.refresh();
        openPS(new ZoweNode(name, vscode.TreeItemCollapsibleState.None, parent, null));
    }
}

/**
 * Cleans up the default local storage directory
 *
 * @export
 */
export async function deactivate() {
    if (!fs.existsSync(BRIGHTTEMPFOLDER)) {
        return;
    }
    try {
        fs.readdirSync(BRIGHTTEMPFOLDER).forEach((file) => {
            fs.unlinkSync(path.join(BRIGHTTEMPFOLDER, file));
        });
        try {
            fs.rmdirSync(BRIGHTTEMPFOLDER);
        } catch (err) {
            // if something else is accessing folder, wait a second and try again
            // tslint:disable-next-line:no-magic-numbers
            await new Promise((resolve) => setTimeout(resolve, 1000));
            fs.rmdirSync(BRIGHTTEMPFOLDER);
        }
    } catch (err) {
        vscode.window.showErrorMessage("Unable to delete temporary folder.");
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
    const quickPickOptions: vscode.QuickPickOptions = {
        placeHolder: `Are you sure you want to delete ${node.label}`,
        ignoreFocusOut: true,
        canPickMany: false
    };
    // confirm that the user really wants to delete
    if (await vscode.window.showQuickPick(["Yes", "No"], quickPickOptions) === "No") {
        return;
    }

    let label = "";
    let fav = false;
    switch (node.mParent.contextValue) {
        case ("favorite"):
            label = node.mLabel.substring(node.mLabel.indexOf(":") + 1).trim();
            fav = true;
            break;
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
            vscode.window.showErrorMessage("deleteDataSet() called from invalid node.");
            throw Error("deleteDataSet() called from invalid node.");
    }

    try {
        await zowe.Delete.dataSet(node.getSession(), label);
    } catch (err) {
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
                ses.dirty = true;
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
        pattern = node.mLabel.substring(node.mLabel.indexOf(":") + 2);
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
 * Returns the profile for the specified node
 *
 * @export
 * @param {ZoweNode} node
 */
export function getProfile(node: ZoweNode) {
    let profile = node.getSessionNode().mLabel;
    // if this is a favorite node, further extraction is necessary
    if (profile.includes("[")) {
        profile = profile.substring(profile.indexOf("[") + 1, profile.indexOf("]"));
    }
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
    return path.join(BRIGHTTEMPFOLDER, label + "[" + getProfile(node) + "]");
}

/**
 * Initializes the favorites section by reading from a file
 *
 * @export
 * @param {DatasetTree} datasetProvider
 */
export async function initializeFavorites(datasetProvider: DatasetTree) {
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
            const zosmfProfile = await new CliProfileManager({
                profileRootDirectory: path.join(os.homedir(), ".zowe", "profiles"),
                type: "zosmf"
            }).load({name: sesName});

            const session = zowe.ZosmfSession.createBasicZosmfSession(zosmfProfile.profile);

            let node: ZoweNode;
            if (line.substring(line.indexOf("{") + 1, line.lastIndexOf("}")) === "pds") {
                node = new ZoweNode(line.substring(0, line.indexOf("{")), vscode.TreeItemCollapsibleState.Collapsed,
                    datasetProvider.mFavoriteSession, session);
            } else {
                node = new ZoweNode(line.substring(0, line.indexOf("{")), vscode.TreeItemCollapsibleState.None,
                    datasetProvider.mFavoriteSession, session);
                node.command = {command: "zowe.ZoweNode.openPS", title: "", arguments: [node]};
            }
            node.contextValue += "f";
            datasetProvider.mFavorites.push(node);
        } else if (favoriteSearchPattern.test(line)) {
            const node = new ZoweNode(line.substring(0, line.lastIndexOf("{")),
                vscode.TreeItemCollapsibleState.None, datasetProvider.mFavoriteSession, null);
            node.command = {command: "zowe.pattern", title: "", arguments: [node]};
            const light = path.join(__dirname, "..", "..", "resources", "light", "pattern.svg");
            const dark = path.join(__dirname, "..", "..", "resources", "dark", "pattern.svg");
            node.iconPath = {light, dark};
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
        // if local copy exists, open that instead of pulling from mainframe
        if (!fs.existsSync(getDocumentFilePath(label, node))) {
            await zowe.Download.dataSet(node.getSession(), label, {
                file: getDocumentFilePath(label, node)
            });
        }
        const document = await vscode.workspace.openTextDocument(getDocumentFilePath(label, node));
        await vscode.window.showTextDocument(document);
    } catch (err) {
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
    datasetProvider.mSessionNodes.forEach((node) => {
        node.dirty = true;
    });
    datasetProvider.refresh();
}

/**
 * Refreshes the passed node with current mainframe data
 *
 * @param {ZoweNode} node - The node which represents the dataset
 */
export async function refreshPS(node: ZoweNode) {
    let label;
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
            vscode.window.showErrorMessage("refreshPS() called from invalid node.");
            throw Error("refreshPS() called from invalid node.");
    }
    try {
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
    let label;
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
            vscode.window.showErrorMessage("safeSave() called from invalid node.");
            throw Error("safeSave() called from invalid node.");
    }
    try {
        await zowe.Download.dataSet(node.getSession(), label, {
            file: getDocumentFilePath(label, node)
        });
        const document = await vscode.workspace.openTextDocument(getDocumentFilePath(label, node));
        vscode.window.showTextDocument(document);
        vscode.window.activeTextEditor.document.save();
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
 * @param {Session} session - Desired Brightside session
 * @param {vscode.TextDocument} doc - TextDocument that is being saved
 */
export async function saveFile(doc: vscode.TextDocument, datasetProvider: DatasetTree) {
    // Check if file is a data set, instead of some other file
    const docPath = path.join(doc.fileName, "..");
    if (path.relative(docPath, BRIGHTTEMPFOLDER)) {
        return;
    }

    // get session name
    let sesName = doc.fileName.substring(doc.fileName.indexOf("[") + 1, doc.fileName.lastIndexOf("]"));
    if (sesName.includes("[")) {
        // if saving from favorites, sesName might be the favorite node, so extract further
        sesName = sesName.substring(sesName.indexOf("[") + 1, sesName.indexOf("]"));
    }

    // get session from session name
    let documentSession;
    const sesNode = (await datasetProvider.getChildren()).find((child) => child.mLabel === sesName);
    if (sesNode) {
        documentSession = sesNode.getSession();
    } else {
        // if saving from favorites, a session might not exist for this node
        const zosmfProfile = await new CliProfileManager({
            profileRootDirectory: path.join(os.homedir(), ".zowe", "profiles"),
            type: "zosmf"
        }).load({name: sesName});
        documentSession = zowe.ZosmfSession.createBasicZosmfSession(zosmfProfile.profile);
    }

    // If not a member
    const label = doc.fileName.substring(doc.fileName.lastIndexOf(path.sep) + 1, doc.fileName.indexOf("["));
    if (!label.includes("(")) {
        try {
            // Checks if file still exists on server
            const response = await zowe.List.dataSet(documentSession, label);
            if (!response.apiResponse.items.length) {
                return vscode.window.showErrorMessage("Data set failed to save. Data set may have been deleted on mainframe.");
            }
        } catch (err) {
            vscode.window.showErrorMessage(err.message);
        }
    }
    try {
        const response = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Saving data set..."
        }, () => {
            return zowe.Upload.pathToDataSet(documentSession, doc.fileName, label);
        });
        if (response.success) {
            vscode.window.showInformationMessage(response.commandResponse);
        } else {
            vscode.window.showErrorMessage(response.commandResponse);
        }
    } catch (err) {
        vscode.window.showErrorMessage(err.message);
    }
}
