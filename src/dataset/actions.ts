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

import * as dsUtils from "../dataset/utils";
import * as vscode from "vscode";
import * as fs from "fs";
import * as zowe from "@zowe/cli";
import * as globals from "../globals";
import * as path from "path";
import { errorHandling, FilterItem, resolveQuickPickHelper } from "../utils";
import { labelRefresh, getDocumentFilePath, concatChildNodes, checkForAddedSuffix, willForceUpload, refreshTree } from "../shared/utils";
import { Profiles, ValidProfileEnum } from "../Profiles";
import { ZoweExplorerApiRegister } from "../api/ZoweExplorerApiRegister";
import { IZoweTree } from "../api/IZoweTree";
import { TextUtils, IProfileLoaded, Session } from "@zowe/imperative";
import { getIconByNode } from "../generators/icons";
import { IZoweDatasetTreeNode, IZoweTreeNode, IZoweNodeType } from "../api/IZoweTreeNode";
import { ZoweDatasetNode } from "./ZoweDatasetNode";
import { DatasetTree } from "./DatasetTree";
import * as contextually from "../shared/context";
import * as shared from "../shared/actions";
import { setFileSaved } from "../utils/workspace";

import * as nls from "vscode-nls";
import { PersistentFilters } from "../PersistentFilters";
// Set up localization
nls.config({ messageFormat: nls.MessageFormat.bundle, bundleFormat: nls.BundleFormat.standalone })();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

/**
 * Refreshes treeView
 *
 * @param {DataSetTree} datasetProvider
 */
export async function refreshAll(datasetProvider: IZoweTree<IZoweDatasetTreeNode>) {
    await Profiles.getInstance().refresh();
    const setting = await PersistentFilters.getDirectValue("Zowe-Automatic-Validation") as boolean;
    datasetProvider.mSessionNodes.forEach(async (sessNode) => {
        if (contextually.isSessionNotFav(sessNode)) {
            labelRefresh(sessNode);
            sessNode.children = [];
            sessNode.dirty = true;
            refreshTree(sessNode);
            shared.resetValidationSettings(sessNode, setting);
            shared.returnIconState(sessNode);
        }
    });
    datasetProvider.refresh();
}

/**
 * Allocates a copy of a data set or member
 *
 */
export async function allocateLike(datasetProvider: IZoweTree<IZoweDatasetTreeNode>, node?: IZoweDatasetTreeNode) {
    let profile: IProfileLoaded;
    let likeDSName: string;
    let currSession: IZoweDatasetTreeNode;

    // User called allocateLike from the command palette
    if (!node) {
        // The user must choose a session
        const qpItems = [];
        const quickpick = vscode.window.createQuickPick();
        quickpick.placeholder = localize("allocateLike.options.prompt", "Select the profile to which the original data set belongs");
        quickpick.ignoreFocusOut = true;

        for (const thisSession of datasetProvider.mSessionNodes) { qpItems.push(new FilterItem(thisSession.label.trim())); }
        quickpick.items = [...qpItems];

        quickpick.show();
        const selection = await resolveQuickPickHelper(quickpick);
        if (!selection) {
            vscode.window.showInformationMessage(localize("allocateLike.noSelection", "You must select a profile."));
            return;
        } else {
            currSession = datasetProvider.mSessionNodes.find((thisSession) => thisSession.label === selection.label);
            profile = currSession.getProfile();
        }
        quickpick.dispose();

        // The user must enter the name of a data set to copy
        likeDSName = await vscode.window.showInputBox({ ignoreFocusOut: true,
                                                        placeHolder: localize("allocateLike.enterLikePattern", "Enter the name of the data set to copy attributes from") });
    } else {
        // User called allocateLike by right-clicking a node
        profile = node.getProfile();
        likeDSName = node.label.replace(/\[.*\]: /g, "");
    }

    // Get new data set name
    const newDSName = await vscode.window.showInputBox({ ignoreFocusOut: true,
                                                         placeHolder: localize("allocateLike.enterPattern", "Enter a name for the new data set")
    });
    if (!newDSName) {
        vscode.window.showInformationMessage(localize("allocateLike.noNewName", "You must enter a new data set name."));
        return;
    } else {
        // Allocate the data set, or throw an error
        try {
            await (ZoweExplorerApiRegister.getMvsApi(profile).allocateLikeDataSet(newDSName.toUpperCase(), likeDSName));
        } catch (err) {
            globals.LOG.error(localize("createDataSet.log.error", "Error encountered when creating data set! ") + JSON.stringify(err));
            errorHandling(err, newDSName, localize("createDataSet.error", "Unable to create data set: ") + err.message);
            throw (err);
        }
    }

    // Refresh tree and open new node, if applicable
    if (!currSession) { currSession = datasetProvider.mSessionNodes.find((thisSession) => thisSession.label.trim() === profile.name); }
    const theFilter = await datasetProvider.createFilterString(newDSName, currSession);
    currSession.tooltip = currSession.pattern = theFilter.toUpperCase();
    datasetProvider.addSearchHistory(theFilter);
    datasetProvider.refresh();
    currSession.dirty = true;
    datasetProvider.refreshElement(currSession);
    const newNode = (await currSession.getChildren()).find((child) => child.label.trim() === newDSName.toUpperCase());
    await datasetProvider.getTreeView().reveal(currSession, { select: true, focus: true });
    datasetProvider.getTreeView().reveal(newNode, { select: true, focus: true });
}

export async function uploadDialog(node: ZoweDatasetNode, datasetProvider: IZoweTree<IZoweDatasetTreeNode>) {
    const fileOpenOptions = {
       canSelectFiles: true,
       openLabel: "Upload File",
       canSelectMany: true
    };

    const value = await vscode.window.showOpenDialog(fileOpenOptions);

    if (value && value.length) {
        await Promise.all(
            value.map(async (item) => {
                    // Convert to vscode.TextDocument
                    const doc = await vscode.workspace.openTextDocument(item);
                    await uploadFile(node, doc);
                }
            ));

        // refresh Tree View & favorites
        datasetProvider.refreshElement(node);
        if (contextually.isFavorite(node) || contextually.isFavoriteContext(node.getParent())) {
            const nonFavNode = datasetProvider.findNonFavoritedNode(node);
            if (nonFavNode) {
                datasetProvider.refreshElement(nonFavNode);
            }
        } else {
            const favNode = datasetProvider.findFavoritedNode(node);
            if (favNode) {
                datasetProvider.refreshElement(favNode);
            }
        }
    } else {
        vscode.window.showInformationMessage(localize("enterPattern.pattern", "No selection made."));
    }
}

export async function uploadFile(node: ZoweDatasetNode, doc: vscode.TextDocument) {
    try {
        const datasetName = node.label;
        const prof = node.getProfile();
        await ZoweExplorerApiRegister.getMvsApi(prof).putContents(doc.fileName, datasetName, {
            encoding: prof.profile.encoding
        });
    } catch (e) {
        errorHandling(e, node.getProfileName(), e.message);
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
    globals.LOG.debug(localize("createMember.log.debug.createNewDataSet", "creating new data set member of name ") + name);
    if (name) {
        const label = parent.label.trim();
        try {
            await ZoweExplorerApiRegister.getMvsApi(parent.getProfile()).createDataSetMember(label + "(" + name + ")");
        } catch (err) {
            globals.LOG.error(localize("createMember.log.error", "Error encountered when creating member! ") + JSON.stringify(err));
            errorHandling(err, label, localize("createMember.error", "Unable to create member: ") + err.message);
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
 * Downloads and displays a PS or data set member in a text editor view
 *
 * @param {IZoweDatasetTreeNode} node
 */
export async function openPS(node: IZoweDatasetTreeNode, previewMember: boolean, datasetProvider?: IZoweTree<IZoweDatasetTreeNode>) {
    if (datasetProvider) { await datasetProvider.checkCurrentProfile(node); }
    if ((Profiles.getInstance().validProfile === ValidProfileEnum.VALID) ||
    (Profiles.getInstance().validProfile === ValidProfileEnum.UNVERIFIED)) {
        try {
            let label: string;
            switch (true) {
                // For favorited or non-favorited sequential DS:
                case contextually.isFavorite(node):
                case contextually.isSessionNotFav(node.getParent()):
                    label = node.label.trim();
                    break;
                // For favorited or non-favorited data set members:
                case contextually.isFavoritePds(node.getParent()):
                case contextually.isPdsNotFav(node.getParent()):
                    label = node.getParent().getLabel().trim() + "(" + node.getLabel()+ ")";
                    break;
                default:
                    vscode.window.showErrorMessage(localize("openPS.invalidNode", "openPS() called from invalid node."));
                    throw Error(localize("openPS.error.invalidNode", "openPS() called from invalid node. "));
            }
            globals.LOG.debug(localize("openPS.log.debug.openDataSet", "opening physical sequential data set from label ") + label);
            // if local copy exists, open that instead of pulling from mainframe
            const documentFilePath = getDocumentFilePath(label, node);
            if (!fs.existsSync(documentFilePath)) {
                const response = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Opening data set..."
                }, function downloadDataset() {
                    const prof = node.getProfile();
                    return ZoweExplorerApiRegister.getMvsApi(prof).getContents(label, {
                        file: documentFilePath,
                        returnEtag: true,
                        encoding: prof.profile.encoding
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
            if (datasetProvider) { datasetProvider.addFileHistory(`[${node.getProfileName()}]: ${label}`); }
        } catch (err) {
            globals.LOG.error(localize("openPS.log.error.openDataSet", "Error encountered when opening data set! ") + JSON.stringify(err));
            errorHandling(err, node.getProfileName());
            throw (err);
        }
    }
}

export function getDataSetTypeAndOptions(type: string) {
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
    return {
        typeEnum,
        createOptions
    };
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

    datasetProvider.checkCurrentProfile(node);
    if ((Profiles.getInstance().validProfile === ValidProfileEnum.VALID) ||
    (Profiles.getInstance().validProfile === ValidProfileEnum.UNVERIFIED)) {
        // get data set type
        const type = await vscode.window.showQuickPick(types, quickPickOptions);
        if (type == null) {
            globals.LOG.debug(localize("createFile.log.debug.noValidTypeSelected", "No valid data type selected"));
            return;
        } else {
            globals.LOG.debug(localize("createFile.log.debug.creatingNewDataSet", "Creating new data set"));
        }

        const typeEnumAndOptions = this.getDataSetTypeAndOptions(type);

        // get name of data set
        let name = await vscode.window.showInputBox({placeHolder: localize("dataset.name", "Name of Data Set")});
        if (name) {
            name = name.trim().toUpperCase();

            try {
                await ZoweExplorerApiRegister.getMvsApi(node.getProfile()).createDataSet(typeEnumAndOptions.typeEnum,
                                                                                         name,
                                                                                         typeEnumAndOptions.createOptions);
                node.dirty = true;

                const theFilter = await datasetProvider.createFilterString(name, node);
                datasetProvider.addSearchHistory(theFilter);
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
                    datasetProvider.getTreeView().reveal(newNode, { select: true });
                }
            } catch (err) {
                globals.LOG.error(localize("createDataSet.error", "Error encountered when creating data set! ") + JSON.stringify(err));
                errorHandling(err, node.getProfileName(), localize("createDataSet.error", "Error encountered when creating data set! ") +
                    err.message);
                throw (err);
            }
        }
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
    await datasetProvider.checkCurrentProfile(parent);
    if ((Profiles.getInstance().validProfile === ValidProfileEnum.VALID) ||
    (Profiles.getInstance().validProfile === ValidProfileEnum.UNVERIFIED)) {
        const label = parent.label.trim();
        globals.LOG.debug(localize("showDSAttributes.debug", "showing attributes of data set ") + label);
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
            globals.LOG.error(localize("showDSAttributes.log.error", "Error encountered when listing attributes! ") + JSON.stringify(err));
            errorHandling(err, parent.getProfileName(), localize("showDSAttributes.error", "Unable to list attributes: ") + err.message);
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
}

/**
 * Submit the contents of the editor as JCL.
 *
 * @export
 * @param {DatasetTree} datasetProvider - our DatasetTree object
 */
// This function does not appear to currently be made available in the UI
export async function submitJcl(datasetProvider: IZoweTree<IZoweDatasetTreeNode>) {
    if (!vscode.window.activeTextEditor) {
        vscode.window.showErrorMessage(
            localize("submitJcl.noDocumentOpen", "No editor with a document that could be submitted as JCL is currently open."));
        return;
    }
    const doc = vscode.window.activeTextEditor.document;
    globals.LOG.debug(localize("submitJcl.log.debug", "Submitting JCL in document ") + doc.fileName);
    // get session name
    const sessionregex = /\[(.*)(\])(?!.*\])/g;
    const regExp = sessionregex.exec(doc.fileName);
    const profiles = Profiles.getInstance();
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
        globals.LOG.error(localize("submitJcl.log.error.nullSession", "Session for submitting JCL was null or undefined!"));
        return;
    }
    const profileStatus = await Profiles.getInstance().checkCurrentProfile(sessProfile, "dataset", true);

    // Set node to proper active status in tree
    const newIcon = shared.getNewNodeIcon(profileStatus.status, sesNode);
    if (newIcon) { sesNode.iconPath = newIcon.path; }

    if ((Profiles.getInstance().validProfile === ValidProfileEnum.VALID) ||
        (Profiles.getInstance().validProfile === ValidProfileEnum.UNVERIFIED)){
        try {
            const job = await ZoweExplorerApiRegister.getJesApi(sessProfile).submitJcl(doc.getText());
            const args = [sessProfileName, job.jobid];
            const setJobCmd = `command:zowe.setJobSpool?${encodeURIComponent(JSON.stringify(args))}`;
            vscode.window.showInformationMessage(localize("submitJcl.jobSubmitted", "Job submitted ") + `[${job.jobid}](${setJobCmd})`);
        } catch (error) {
            errorHandling(error, sessProfileName, localize("submitJcl.jobSubmissionFailed", "Job submission failed\n") + error.message);
        }
    } else {
        vscode.window.showErrorMessage(localize("submitJcl.checkProfile", "Profile is invalid"));
        return;
    }
}

/**
 * Submit the selected dataset member as a Job.
 *
 * @export
 * @param node The dataset member
 */
export async function submitMember(node: IZoweTreeNode) {
    let label: string;
    let sesName: string;
    let sessProfile: IProfileLoaded;
    const profiles = Profiles.getInstance();
    profiles.checkCurrentProfile(node.getProfile(), "dataset", true);
    if ((Profiles.getInstance().validProfile === ValidProfileEnum.VALID) ||
    (Profiles.getInstance().validProfile === ValidProfileEnum.UNVERIFIED)) {
        switch (true) {
             // For favorited or non-favorited sequential DS:
            case contextually.isFavorite(node):
            case contextually.isSessionNotFav(node.getParent()):
                sesName = node.getParent().getLabel();
                label = node.label;
                sessProfile = node.getProfile();
                break;
            // For favorited or non-favorited data set members:
            case contextually.isFavoritePds(node.getParent()):
            case contextually.isPdsNotFav(node.getParent()):
                sesName = node.getParent().getParent().getLabel();
                label = node.getParent().getLabel() + "(" + node.label.trim()+ ")";
                sessProfile = node.getProfile();
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
            errorHandling(error, sesName, localize("submitMember.jobSubmissionFailed", "Job submission failed\n") + error.message);
        }
    }
}

/**
 * Deletes a dataset/data set member
 *
 * @export
 * @param {IZoweTreeNode} node - The node to be deleted
 * @param {IZoweTree<IZoweDatasetTreeNode>} datasetProvider - the tree which contains the nodes
 */
export async function deleteDataset(node: IZoweTreeNode, datasetProvider: IZoweTree<IZoweDatasetTreeNode>) {
    globals.LOG.debug(localize("deleteDataset.log.debug", "Deleting data set ") + node.label);
    const quickPickOptions: vscode.QuickPickOptions = {
        placeHolder: localize("deleteDataset.quickPickOption", "Delete {0}? This will permanently remove it from your system.", node.label),
        ignoreFocusOut: true,
        canPickMany: false
    };
    // confirm that the user really wants to delete
    if (await vscode.window.showQuickPick([localize("deleteDataset.showQuickPick.delete", "Delete"),
        localize("deleteDataset.showQuickPick.Cancel", "Cancel")], quickPickOptions) !== localize("deleteDataset.showQuickPick.delete", "Delete")) {
        globals.LOG.debug(localize("deleteDataset.showQuickPick.log.debug", "User picked Cancel. Cancelling delete of data set"));
        return;
    }

    let label = "";
    let fav = false;
    try {
        const parentContext = node.getParent().contextValue;
        if (parentContext.includes(globals.FAV_SUFFIX)) {
            label = node.getLabel();
            fav = true;
            if (parentContext.includes(globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX)) {
                label = node.getParent().getLabel() + "(" + node.getLabel() + ")";
            }
        } else if (parentContext.includes(globals.DS_SESSION_CONTEXT)) {
            label = node.getLabel();
        } else if (parentContext.includes(globals.DS_PDS_CONTEXT)) {
            label = node.getParent().getLabel() + "(" + node.getLabel() + ")";
        } else {
            throw Error(localize("deleteDataSet.invalidNode.error", "deleteDataSet() called from invalid node."));
        }
        await datasetProvider.checkCurrentProfile(node);
        if ((Profiles.getInstance().validProfile === ValidProfileEnum.VALID) ||
        (Profiles.getInstance().validProfile === ValidProfileEnum.UNVERIFIED)) {
            await ZoweExplorerApiRegister.getMvsApi(node.getProfile()).deleteDataSet(label);
        } else {
            return;
        }
    } catch (err) {
        globals.LOG.error(localize("deleteDataSet.delete.log.error", "Error encountered when deleting data set! ") + JSON.stringify(err));
        if (err.message.includes(localize("deleteDataSet.error.notFound", "not found"))) {
            vscode.window.showInformationMessage(localize("deleteDataSet.notFound.error1", "Unable to find file: ") + label +
                localize("deleteDataSet.notFound.error2", " was probably already deleted."));
        } else {
            errorHandling(err, node.getProfileName());
        }
        throw err;
    }

    // remove node from tree
    if (fav) {
        datasetProvider.mSessionNodes.forEach((ses) => {
            if (node.getProfileName() === ses.label.trim()) {
                ses.dirty = true;
            }
        });
        datasetProvider.removeFavorite(node);
    } else {
        node.getSessionNode().dirty = true;
        datasetProvider.removeFavorite(node);
    }

    // refresh Tree View & favorites
    if (node.getParent() && node.getParent().contextValue !== globals.DS_SESSION_CONTEXT) {
        datasetProvider.refreshElement(node.getParent());
        if (contextually.isFavorite(node) || contextually.isFavorite(node.getParent())) {
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
 * Refreshes the passed node with current mainframe data
 *
 * @param {IZoweDatasetTreeNode} node - The node which represents the dataset
 */
export async function refreshPS(node: IZoweDatasetTreeNode) {
    let label: string;
    try {
        switch (true) {
            // For favorited or non-favorited sequential DS:
            case contextually.isFavorite(node):
            case contextually.isSessionNotFav(node.getParent()):
                label = node.label.trim();
                break;
            // For favorited or non-favorited data set members:
            case contextually.isFavoritePds(node.getParent()):
            case contextually.isPdsNotFav(node.getParent()):
                label = node.getParent().getLabel() + "(" + node.getLabel() + ")";
                break;
            default:
                throw Error(localize("refreshPS.error.invalidNode", "refreshPS() called from invalid node."));
        }
        const documentFilePath = getDocumentFilePath(label, node);
        const prof = node.getProfile();
        const response = await ZoweExplorerApiRegister.getMvsApi(prof).getContents(label, {
            file: documentFilePath,
            returnEtag: true,
            encoding: prof.profile.encoding
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
        globals.LOG.error(localize("refreshPS.log.error.refresh", "Error encountered when refreshing data set view: ") + JSON.stringify(err));
        if (err.message.includes(localize("refreshPS.error.notFound", "not found"))) {
            vscode.window.showInformationMessage(localize("refreshPS.file1", "Unable to find file: ") + label +
                localize("refreshPS.file2", " was probably deleted."));
        } else {
            errorHandling(err, node.getProfileName());
        }
    }
}

/**
 * Prompts the user for a pattern, and populates the [TreeView]{@link vscode.TreeView} based on the pattern
 *
 * @param {IZoweDatasetTreeNode} node - The session node
 * @param {DatasetTree} datasetProvider - Current DatasetTree used to populate the TreeView
 * @returns {Promise<void>}
 */
// This function does not appear to be called by anything except unit and integration tests.
export async function enterPattern(node: IZoweDatasetTreeNode, datasetProvider: DatasetTree) {
    if (globals.LOG) {
        globals.LOG.debug(localize("enterPattern.log.debug.prompt", "Prompting the user for a data set pattern"));
    }
    let pattern: string;
    if (contextually.isSessionNotFav(node)) {
        // manually entering a search
        const options: vscode.InputBoxOptions = {
            prompt: localize("enterPattern.options.prompt",
                                     "Search data sets by entering patterns: use a comma to separate multiple patterns"),
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
    node.label = node.label.trim();
    node.tooltip = node.pattern = pattern.toUpperCase();
    node.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    node.dirty = true;
    const icon = getIconByNode(node);
    if (icon) {
        node.iconPath = icon.path;
    }
    datasetProvider.addSearchHistory(node.pattern);
}

/**
 * Copy data sets
 *
 * @export
 * @param {IZoweNodeType} node - The node to copy
 */
export async function copyDataSet(node: IZoweNodeType) {
    return vscode.env.clipboard.writeText(JSON.stringify(dsUtils.getNodeLabels(node)));
}

/**
 * Migrate data sets
 *
 * @export
 * @param {IZoweDatasetTreeNode} node - The node to paste to
 */
export async function hMigrateDataSet(node: ZoweDatasetNode) {
    const profileStatus = await Profiles.getInstance().checkCurrentProfile(node.getProfile(), "dataset", true);

    // Set node to proper active status in tree
    const sessNode = node.getSessionNode();
    const newIcon = shared.getNewNodeIcon(profileStatus.status, sessNode);
    if (newIcon) { sessNode.iconPath = newIcon.path; }

    if ((Profiles.getInstance().validProfile === ValidProfileEnum.VALID) ||
        (Profiles.getInstance().validProfile === ValidProfileEnum.UNVERIFIED)) {
        const { dataSetName } = dsUtils.getNodeLabels(node);
        vscode.window.showInformationMessage(localize("hMigrate.requestSent1", "Migration of dataset: ") + dataSetName +
        localize("hMigrate.requestSent2", " requested."));
        return ZoweExplorerApiRegister.getMvsApi(node.getProfile()).hMigrateDataSet(dataSetName);
    } else {
        vscode.window.showErrorMessage(localize("hMigrateDataSet.checkProfile", "Profile is invalid"));
        return;
    }
}

/**
 * Recall data sets
 *
 * @export
 * @param {IZoweDatasetTreeNode} node - The node to paste to
 */
export async function hRecallDataSet(node: ZoweDatasetNode) {
    const profileStatus = await Profiles.getInstance().checkCurrentProfile(node.getProfile(), "dataset", true);

    // Set node to proper active status in tree
    const sessNode = node.getSessionNode();
    const newIcon = shared.getNewNodeIcon(profileStatus.status, sessNode);
    if (newIcon) { sessNode.iconPath = newIcon.path; }

    if ((Profiles.getInstance().validProfile === ValidProfileEnum.VALID) ||
        (Profiles.getInstance().validProfile === ValidProfileEnum.UNVERIFIED)) {
        const { dataSetName } = dsUtils.getNodeLabels(node);
        vscode.window.showInformationMessage(localize("hRecall.requestSent1", "Recall of dataset: ") + dataSetName +
        localize("hRecall.requestSent2", " requested."));
        return ZoweExplorerApiRegister.getMvsApi(node.getProfile()).hRecallDataSet(dataSetName);
    } else {
        vscode.window.showErrorMessage(localize("hMigrateDataSet.checkProfile", "Profile is invalid"));
        return;
    }
}

/**
 * Paste data sets
 *
 * @export
 * @param {ZoweNode} node - The node to paste to
 * @param {DatasetTree} datasetProvider - the tree which contains the nodes
 */
export async function pasteDataSet(node: IZoweDatasetTreeNode, datasetProvider: IZoweTree<IZoweDatasetTreeNode>) {
    const { profileName, dataSetName } = dsUtils.getNodeLabels(node);
    let memberName;
    let beforeDataSetName;
    let beforeProfileName;
    let beforeMemberName;

    const profileStatus = await Profiles.getInstance().checkCurrentProfile(node.getProfile(), "dataset", true);

    // Set node to proper active status in tree
    const sessNode = node.getSessionNode();
    const newIcon = shared.getNewNodeIcon(profileStatus.status, sessNode);
    if (newIcon) { sessNode.iconPath = newIcon.path; }

    if ((Profiles.getInstance().validProfile === ValidProfileEnum.VALID) ||
    (Profiles.getInstance().validProfile === ValidProfileEnum.UNVERIFIED)) {
        if (node.contextValue.includes(globals.DS_PDS_CONTEXT)) {
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
                const responseItem: zowe.IZosFilesResponse = await ZoweExplorerApiRegister.getMvsApi(node.getProfile()).allMembers(`${dataSetName}`);
                if (responseItem.apiResponse.items.some( (singleItem) => singleItem.member === memberName.toUpperCase())) {
                    throw Error(`${dataSetName}(${memberName}) already exists. You cannot replace a member`);
                }
            }
            await ZoweExplorerApiRegister.getMvsApi(node.getProfile()).copyDataSetMember(
                { dataSetName: beforeDataSetName, memberName: beforeMemberName },
                { dataSetName, memberName }
            );

            if (memberName) {
                datasetProvider.refreshElement(node);
                let node2;
                if (node.contextValue.includes(globals.FAV_SUFFIX)) {
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
}

/**
 * Uploads the file to the mainframe
 *
 * @export
 * @param {vscode.TextDocument} doc - TextDocument that is being saved
 */
export async function saveFile(doc: vscode.TextDocument, datasetProvider: IZoweTree<IZoweDatasetTreeNode>) {
    // Check if file is a data set, instead of some other file
    globals.LOG.debug(localize("saveFile.log.debug.request", "requested to save data set: ") + doc.fileName);
    const docPath = path.join(doc.fileName, "..");
    globals.LOG.debug("requested to save data set: " + doc.fileName);
    if (docPath.toUpperCase().indexOf(globals.DS_DIR.toUpperCase()) === -1) {
        globals.LOG.debug(localize("saveFile.log.debug.path", "path.relative returned a non-blank directory.") +
            localize("saveFile.log.debug.directory",
                "Assuming we are not in the DS_DIR directory: ") + path.relative(docPath, globals.DS_DIR));
        return;
    }
    const start = path.join(globals.DS_DIR + path.sep).length;
    const ending = doc.fileName.substring(start);
    const sesName = ending.substring(0, ending.indexOf(path.sep));
    const profile = Profiles.getInstance().loadNamedProfile(sesName);
    if (!profile) {
        globals.LOG.error(localize("saveFile.log.error.session", "Couldn't locate session when saving data set!"));
        return vscode.window.showErrorMessage(localize("saveFile.log.error.session", "Couldn't locate session when saving data set!"));
    }

    // get session from session name
    let documentSession: Session;
    let node: IZoweDatasetTreeNode;
    const sesNode = (await datasetProvider.getChildren()).find((child) =>
        child.label.trim() === sesName);
    if (sesNode) {
        globals.LOG.debug(localize("saveFile.log.debug.load", "Loading session from session node in saveFile()"));
        documentSession = sesNode.getSession();
    } else {
        // if saving from favorites, a session might not exist for this node
        globals.LOG.debug(localize("saveFile.log.debug.sessionNode", "couldn't find session node, loading profile with CLI profile manager"));
        documentSession = await ZoweExplorerApiRegister.getMvsApi(profile).getSession();
    }

    // If not a member
    let label = doc.fileName.substring(doc.fileName.lastIndexOf(path.sep) + 1,
        checkForAddedSuffix(doc.fileName) ? doc.fileName.lastIndexOf(".") : doc.fileName.length);
    label = label.toUpperCase();
    globals.LOG.debug(localize("saveFile.log.debug.saving", "Saving file ") + label);
    if (!label.includes("(")) {
        try {
            // Checks if file still exists on server
            const response = await ZoweExplorerApiRegister.getMvsApi(profile).dataSet(label);
            if (!response.apiResponse.items.length) {
                return vscode.window.showErrorMessage(
                    localize("saveFile.error.saveFailed", "Data set failed to save. Data set may have been deleted on mainframe."));
            }
        } catch (err) {
            errorHandling(err, sesName, err.message);
        }
    }
    // Get specific node based on label and parent tree (session / favorites)
    let nodes: IZoweNodeType[];
    if (!sesNode || sesNode.children.length === 0) {
        // saving from favorites
        nodes = concatChildNodes(datasetProvider.mFavorites);
    } else {
        // saving from session
        nodes = concatChildNodes([sesNode]);
    }
    node = nodes.find((zNode) => {
        if (contextually.isDsMember(zNode)) {
            const zNodeDetails = dsUtils.getProfileAndDataSetName(zNode);
            return (`${zNodeDetails.profileName}(${zNodeDetails.dataSetName})` === `${label}`);
        } else if (contextually.isDs(zNode)) {
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
            const prof = (node) ? node.getProfile() : profile;
            if (prof.profile.encoding) {
                uploadOptions.encoding = prof.profile.encoding;
            }
            return ZoweExplorerApiRegister.getMvsApi(prof).putContents(doc.fileName, label, uploadOptions);
        });
        if (uploadResponse.success) {
            vscode.window.showInformationMessage(uploadResponse.commandResponse);
            // set local etag with the new etag from the updated file on mainframe
            if (node) {
                node.setEtag(uploadResponse.apiResponse[0].etag);
                setFileSaved(true);
            }
        } else if (!uploadResponse.success && uploadResponse.commandResponse.includes(
            localize("saveFile.error.ZosmfEtagMismatchError", "Rest API failure with HTTP(S) status 412"))) {
            if (globals.ISTHEIA) {
                await willForceUpload(node, doc, label, node ? node.getProfile(): profile);
            } else {
                const oldDoc = doc;
                const oldDocText = oldDoc.getText();
                const prof = (node) ? node.getProfile() : profile;
                if (prof.profile.encoding) {
                    uploadOptions.encoding = prof.profile.encoding;
                }
                const downloadResponse = await ZoweExplorerApiRegister.getMvsApi(prof).getContents(label, {
                    file: doc.fileName,
                    returnEtag: true,
                    encoding: prof.profile.encoding
                });
                // re-assign etag, so that it can be used with subsequent requests
                const downloadEtag = downloadResponse.apiResponse.etag;
                if (node && downloadEtag !== node.getEtag()) {
                    node.setEtag(downloadEtag);
                }
                vscode.window.showWarningMessage(localize("saveFile.error.etagMismatch",
                "Remote file has been modified in the meantime.\nSelect 'Compare' to resolve the conflict."));
                if (vscode.window.activeTextEditor) {
                    // Store document in a separate variable, to be used on merge conflict
                    const startPosition = new vscode.Position(0, 0);
                    const endPosition = new vscode.Position(oldDoc.lineCount, 0);
                    const deleteRange = new vscode.Range(startPosition, endPosition);
                    await vscode.window.activeTextEditor.edit((editBuilder) => {
                        // re-write the old content in the editor view
                        editBuilder.delete(deleteRange);
                        editBuilder.insert(startPosition, oldDocText);
                    });
                    await vscode.window.activeTextEditor.document.save();
                }
            }
        } else {
            vscode.window.showErrorMessage(uploadResponse.commandResponse);
        }
    } catch (err) {
        vscode.window.showErrorMessage(err.message);
    }
}
