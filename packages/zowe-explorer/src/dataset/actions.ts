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
import * as api from "@zowe/zowe-explorer-api";
import { FilterItem, errorHandling, resolveQuickPickHelper } from "../utils/ProfilesUtils";
import { getDocumentFilePath, concatChildNodes, checkForAddedSuffix, willForceUpload } from "../shared/utils";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { Profiles } from "../Profiles";
import { TextUtils, IProfileLoaded, Session } from "@zowe/imperative";
import { getIconByNode } from "../generators/icons";
import { ZoweDatasetNode } from "./ZoweDatasetNode";
import { DatasetTree } from "./DatasetTree";
import * as contextually from "../shared/context";
import { setFileSaved } from "../utils/workspace";
import { UIViews } from "../shared/ui-views";
import { IUploadOptions } from "@zowe/zos-files-for-zowe-sdk";

// Set up localization
import * as nls from "vscode-nls";
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

/**
 * Allocates a copy of a data set or member
 *
 */
export async function allocateLike(
    datasetProvider: api.IZoweTree<api.IZoweDatasetTreeNode>,
    node?: api.IZoweDatasetTreeNode
) {
    let profile: IProfileLoaded;
    let likeDSName: string;
    let currSession: api.IZoweDatasetTreeNode;

    // User called allocateLike from the command palette
    if (!node) {
        // The user must choose a session
        const qpItems = [];
        const quickpick = vscode.window.createQuickPick();
        quickpick.placeholder = localize(
            "allocateLike.options.prompt",
            "Select the profile to which the original data set belongs"
        );
        quickpick.ignoreFocusOut = true;

        for (const thisSession of datasetProvider.mSessionNodes) {
            if (!thisSession.label.toString().includes("Favorites")) {
                qpItems.push(new FilterItem({ text: thisSession.label as string }));
            }
        }
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
        const currSelection =
            datasetProvider.getTreeView().selection.length > 0
                ? datasetProvider.getTreeView().selection[0].label
                : null;
        const inputBoxOptions: vscode.InputBoxOptions = {
            ignoreFocusOut: true,
            placeHolder: localize(
                "allocateLike.inputBox.placeHolder",
                "Enter the name of the data set to copy attributes from"
            ),
            value: currSelection as string,
        };
        likeDSName = await UIViews.inputBox(inputBoxOptions);
        if (!likeDSName) {
            vscode.window.showInformationMessage(
                localize("allocateLike.noNewName", "You must enter a new data set name.")
            );
            return;
        }
    } else {
        // User called allocateLike by right-clicking a node
        profile = node.getProfile();
        likeDSName = node.label.toString().replace(/\[.*\]: /g, "");
    }

    // Get new data set name
    const options: vscode.InputBoxOptions = {
        ignoreFocusOut: true,
        placeHolder: localize("allocateLike.inputBox.placeHolder", "Enter a name for the new data set"),
    };
    const newDSName = await UIViews.inputBox(options);
    if (!newDSName) {
        vscode.window.showInformationMessage(localize("allocateLike.noNewName", "You must enter a new data set name."));
        return;
    } else {
        // Allocate the data set, or throw an error
        try {
            await ZoweExplorerApiRegister.getMvsApi(profile).allocateLikeDataSet(newDSName.toUpperCase(), likeDSName);
        } catch (err) {
            globals.LOG.error(
                localize("createDataSet.log.error", "Error encountered when creating data set! ") + JSON.stringify(err)
            );
            await errorHandling(
                err,
                newDSName,
                localize("createDataSet.error", "Unable to create data set: ") + err.message
            );
            throw err;
        }
    }

    // Refresh tree and open new node, if applicable
    if (!currSession) {
        currSession = datasetProvider.mSessionNodes.find(
            (thisSession) => thisSession.label.toString() === profile.name
        );
    }
    const theFilter = await datasetProvider.createFilterString(newDSName, currSession);
    currSession.tooltip = currSession.pattern = theFilter.toUpperCase();
    datasetProvider.addSearchHistory(theFilter);
    datasetProvider.refresh();
    currSession.dirty = true;
    datasetProvider.refreshElement(currSession);
    const newNode = (await currSession.getChildren()).find(
        (child) => child.label.toString() === newDSName.toUpperCase()
    );
    await datasetProvider.getTreeView().reveal(currSession, { select: true, focus: true });
    datasetProvider.getTreeView().reveal(newNode, { select: true, focus: true });
}

export async function uploadDialog(node: ZoweDatasetNode, datasetProvider: api.IZoweTree<api.IZoweDatasetTreeNode>) {
    const fileOpenOptions = {
        canSelectFiles: true,
        openLabel: "Upload File",
        canSelectMany: true,
    };

    const value = await vscode.window.showOpenDialog(fileOpenOptions);

    if (value && value.length) {
        await Promise.all(
            value.map(async (item) => {
                // Convert to vscode.TextDocument
                const doc = await vscode.workspace.openTextDocument(item);
                await uploadFile(node, doc);
            })
        );

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
        vscode.window.showInformationMessage(
            localize("enterPattern.pattern", "No selection made. Operation cancelled.")
        );
    }
}

export async function uploadFile(node: ZoweDatasetNode, doc: vscode.TextDocument) {
    try {
        const datasetName = node.label as string;
        const prof = node.getProfile();
        await ZoweExplorerApiRegister.getMvsApi(prof).putContents(doc.fileName, datasetName, {
            encoding: prof.profile.encoding,
        });
    } catch (e) {
        await errorHandling(e, node.getProfileName(), e.message);
    }
}

/**
 * Deletes nodes from the data set tree & delegates deletion of data sets, members, and profiles
 *
 * @export
 * @param {IZoweDatasetTreeNode} node - The node selected for deletion
 * @param {DatasetTree} datasetProvider - the tree which contains the nodes
 */
export async function deleteDatasetPrompt(
    datasetProvider: api.IZoweTree<api.IZoweDatasetTreeNode>,
    node?: api.IZoweDatasetTreeNode
) {
    let nodes: api.IZoweDatasetTreeNode[];
    const treeView = datasetProvider.getTreeView();
    let selectedNodes = treeView.selection;
    let includedSelection = false;
    if (node) {
        for (const item of selectedNodes) {
            if (node.getLabel().toString() === item.getLabel().toString()) {
                includedSelection = true;
            }
        }
    }

    // Check that child and parent aren't both in array, removing children whose parents are in
    // array to avoid errors from host when deleting none=existent children.
    const childArray: api.IZoweDatasetTreeNode[] = [];
    for (const item of selectedNodes) {
        if (contextually.isDsMember(item)) {
            for (const parent of selectedNodes) {
                if (parent.getLabel() === item.getParent().getLabel()) {
                    childArray.push(item);
                }
            }
        }
    }
    selectedNodes = selectedNodes.filter((val) => !childArray.includes(val));

    if (includedSelection || !node) {
        // Filter out sessions, favorite nodes, or information messages
        nodes = selectedNodes.filter(
            (selectedNode) =>
                selectedNode.getParent() &&
                !contextually.isFavorite(selectedNode) &&
                !contextually.isFavorite(selectedNode.getParent()) &&
                !contextually.isSession(selectedNode) &&
                !contextually.isInformation(selectedNode)
        );
    } else {
        if (
            node.getParent() &&
            !contextually.isFavorite(node) &&
            !contextually.isFavorite(node.getParent()) &&
            !contextually.isSession(node) &&
            !contextually.isInformation(node)
        ) {
            nodes = [];
            nodes.push(node);
        }
    }

    // Check that there are items to be deleted, this can be caused by trying to delete favorites right now
    if (!nodes || nodes.length === 0) {
        vscode.window.showInformationMessage(
            localize(
                "deleteDatasetPrompt.nodesToDelete.empty",
                "Deleting data sets and members from the Favorites section is currently not supported."
            )
        );
        return;
    }

    // The names of the nodes that should be deleted
    const nodesToDelete: string[] = nodes.map((deletedNode) => {
        return contextually.isDsMember(deletedNode)
            ? ` ${deletedNode.getParent().getLabel().toString()}(${deletedNode.getLabel().toString()})`
            : ` ${deletedNode.getLabel().toString()}`;
    });
    nodesToDelete.sort();

    const nodesDeleted: string[] = [];

    // The member parent nodes that should be refreshed individually
    const memberParents: api.IZoweDatasetTreeNode[] = [];
    for (const deletedNode of nodes) {
        if (contextually.isDsMember(deletedNode)) {
            const parent = deletedNode.getParent();
            if (
                memberParents.filter(
                    (alreadyAddedParent) => alreadyAddedParent.label.toString() === parent.label.toString()
                ).length === 0
            ) {
                memberParents.push(parent);
            }
        }
    }

    nodes.map((deletedNode) => {
        return contextually.isDsMember(deletedNode) ? deletedNode.getParent() : ` ${deletedNode.getLabel().toString()}`;
    });

    // Confirm that the user really wants to delete
    globals.LOG.debug(localize("deleteDatasetPrompt.log.debug", "Deleting data set(s): ") + nodesToDelete.join(","));
    const deleteButton = localize("deleteDatasetPrompt.confirmation.delete", "Delete");
    const message = localize(
        "deleteDatasetPrompt.confirmation.message",
        "Are you sure you want to delete the following {0} item(s)?\nThis will permanently remove these data sets and/or members from your system.\n\n{1}",
        nodesToDelete.length,
        nodesToDelete.toString().replace(/(,)/g, "\n")
    );
    await vscode.window.showWarningMessage(message, { modal: true }, ...[deleteButton]).then((selection) => {
        if (!selection || selection === "Cancel") {
            globals.LOG.debug(localize("deleteDatasetPrompt.deleteCancelled", "Delete action was cancelled."));
            nodes = [];
            return;
        }
    });

    if (nodes.length === 0) {
        return;
    }
    if (nodes.length === 1) {
        // no multi-select available in Theia
        await deleteDataset(nodes[0], datasetProvider);
        const deleteItemName = contextually.isDsMember(nodes[0])
            ? ` ${nodes[0].getParent().getLabel().toString()}(${nodes[0].getLabel().toString()})`
            : ` ${nodes[0].getLabel().toString()}`;
        nodesDeleted.push(deleteItemName);
    }
    if (nodes.length > 1) {
        // Delete multiple selected nodes
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: localize("deleteDatasetPrompt.deleteCounter", "Deleting nodes"),
                cancellable: true,
            },
            async (progress, token) => {
                const total = 100;
                for (const [index, currNode] of nodes.entries()) {
                    if (token.isCancellationRequested) {
                        vscode.window.showInformationMessage(
                            localize("deleteDatasetPrompt.deleteCancelled", "Delete action was cancelled.")
                        );
                        return;
                    }
                    progress.report({
                        message: `Deleting ${index + 1} of ${nodes.length}`,
                        increment: total / nodes.length,
                    });
                    try {
                        await deleteDataset(currNode, datasetProvider);
                        const deleteItemName = contextually.isDsMember(currNode)
                            ? ` ${currNode.getParent().getLabel().toString()}(${currNode.getLabel().toString()})`
                            : ` ${currNode.getLabel().toString()}`;
                        nodesDeleted.push(deleteItemName);
                    } catch (err) {
                        globals.LOG.error(err);
                    }
                }
            }
        );
    }
    if (nodesDeleted.length > 0) {
        nodesDeleted.sort();
        vscode.window.showInformationMessage(
            localize(
                "deleteMulti.datasetNode",
                "The following {0} item(s) were deleted:{1}",
                nodesDeleted.length,
                nodesDeleted.toString()
            )
        );
    }

    // refresh Tree View & favorites
    datasetProvider.refresh();
    for (const member of memberParents) {
        datasetProvider.refreshElement(member);
    }
}

/**
 * Creates a PDS member
 *
 * @export
 * @param {IZoweDatasetTreeNode} parent - The parent Node
 * @param {DatasetTree} datasetProvider - the tree which contains the nodes
 */
export async function createMember(
    parent: api.IZoweDatasetTreeNode,
    datasetProvider: api.IZoweTree<api.IZoweDatasetTreeNode>
) {
    const options: vscode.InputBoxOptions = {
        placeHolder: localize("createMember.inputBox.placeholder", "Name of Member"),
    };
    const name = await UIViews.inputBox(options);
    globals.LOG.debug(
        localize("createMember.log.debug.createNewDataSet", "creating new data set member of name ") + name
    );
    if (name) {
        const label = parent.label as string;
        try {
            await ZoweExplorerApiRegister.getMvsApi(parent.getProfile()).createDataSetMember(label + "(" + name + ")");
        } catch (err) {
            globals.LOG.error(
                localize("createMember.log.error", "Error encountered when creating member! ") + JSON.stringify(err)
            );
            await errorHandling(err, label, localize("createMember.error", "Unable to create member: ") + err.message);
            throw err;
        }
        parent.dirty = true;
        datasetProvider.refreshElement(parent);
        openPS(
            new ZoweDatasetNode(
                name,
                vscode.TreeItemCollapsibleState.None,
                parent,
                null,
                undefined,
                undefined,
                parent.getProfile()
            ),
            true,
            datasetProvider
        );
        datasetProvider.refresh();
    }
}

/**
 * Downloads and displays a PS or data set member in a text editor view
 *
 * @param {IZoweDatasetTreeNode} node
 */
export async function openPS(
    node: api.IZoweDatasetTreeNode,
    previewMember: boolean,
    datasetProvider?: api.IZoweTree<api.IZoweDatasetTreeNode>
) {
    if (datasetProvider) {
        await datasetProvider.checkCurrentProfile(node);
    }
    if (Profiles.getInstance().validProfile !== api.ValidProfileEnum.INVALID) {
        try {
            let label: string;
            switch (true) {
                // For favorited or non-favorited sequential DS:
                case contextually.isFavorite(node):
                case contextually.isSessionNotFav(node.getParent()):
                    label = node.label as string;
                    break;
                // For favorited or non-favorited data set members:
                case contextually.isFavoritePds(node.getParent()):
                case contextually.isPdsNotFav(node.getParent()):
                    label = node.getParent().getLabel().toString() + "(" + node.getLabel().toString() + ")";
                    break;
                default:
                    vscode.window.showErrorMessage(
                        localize("openPS.invalidNode", "openPS() called from invalid node.")
                    );
                    throw Error(localize("openPS.error.invalidNode", "openPS() called from invalid node. "));
            }
            globals.LOG.debug(
                localize("openPS.log.debug.openDataSet", "opening physical sequential data set from label ") + label
            );
            // if local copy exists, open that instead of pulling from mainframe
            const documentFilePath = getDocumentFilePath(label, node);
            if (!fs.existsSync(documentFilePath)) {
                const response = await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: "Opening data set...",
                    },
                    function downloadDataset() {
                        const prof = node.getProfile();
                        return ZoweExplorerApiRegister.getMvsApi(prof).getContents(label, {
                            file: documentFilePath,
                            returnEtag: true,
                            encoding: prof.profile.encoding,
                        });
                    }
                );
                node.setEtag(response.apiResponse.etag);
            }
            const document = await vscode.workspace.openTextDocument(getDocumentFilePath(label, node));
            if (previewMember === true) {
                await vscode.window.showTextDocument(document);
            } else {
                await vscode.window.showTextDocument(document, { preview: false });
            }
            if (datasetProvider) {
                datasetProvider.addFileHistory(`[${node.getProfileName()}]: ${label}`);
            }
        } catch (err) {
            globals.LOG.error(
                localize("openPS.log.error.openDataSet", "Error encountered when opening data set! ") +
                    JSON.stringify(err)
            );
            await errorHandling(err, node.getProfileName(), err.message);
            throw err;
        }
    }
}

export function getDataSetTypeAndOptions(type: string) {
    let typeEnum;
    let createOptions;
    switch (type) {
        case localize("createFile.dataSetBinary", "Data Set Binary"):
            typeEnum = zowe.CreateDataSetTypeEnum.DATA_SET_BINARY;
            createOptions = vscode.workspace.getConfiguration(globals.SETTINGS_DS_DEFAULT_BINARY);
            break;
        case localize("createFile.dataSetC", "Data Set C"):
            typeEnum = zowe.CreateDataSetTypeEnum.DATA_SET_C;
            createOptions = vscode.workspace.getConfiguration(globals.SETTINGS_DS_DEFAULT_C);
            break;
        case localize("createFile.dataSetClassic", "Data Set Classic"):
            typeEnum = zowe.CreateDataSetTypeEnum.DATA_SET_CLASSIC;
            createOptions = vscode.workspace.getConfiguration(globals.SETTINGS_DS_DEFAULT_CLASSIC);
            break;
        case localize("createFile.dataSetPartitioned", "Data Set Partitioned"):
            typeEnum = zowe.CreateDataSetTypeEnum.DATA_SET_PARTITIONED;
            createOptions = vscode.workspace.getConfiguration(globals.SETTINGS_DS_DEFAULT_PDS);
            break;
        case localize("createFile.dataSetSequential", "Data Set Sequential"):
            typeEnum = zowe.CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL;
            createOptions = vscode.workspace.getConfiguration(globals.SETTINGS_DS_DEFAULT_PS);
            break;
    }
    return {
        typeEnum,
        createOptions,
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
export async function createFile(
    node: api.IZoweDatasetTreeNode,
    datasetProvider: api.IZoweTree<api.IZoweDatasetTreeNode>
) {
    let dsName: string;
    let typeEnum: number;
    let propertiesFromDsType: any;
    const stepTwoOptions = {
        placeHolder: localize("createFile.quickPickOption.dataSetType", "Type of Data Set to be Created"),
        ignoreFocusOut: true,
        canPickMany: false,
    };
    const stepThreeOptions: vscode.QuickPickOptions = {
        ignoreFocusOut: true,
        canPickMany: false,
    };
    const stepTwoChoices = [
        localize("createFile.dataSetBinary", "Data Set Binary"),
        localize("createFile.dataSetC", "Data Set C"),
        localize("createFile.dataSetClassic", "Data Set Classic"),
        localize("createFile.dataSetPartitioned", "Data Set Partitioned"),
        localize("createFile.dataSetSequential", "Data Set Sequential"),
    ];
    const stepThreeChoices = [
        localize("createFile.allocate", " + Allocate Data Set"),
        localize("createFile.editAttributes", "Edit Attributes"),
    ];
    // Make a nice new mutable array for the DS properties
    // tslint:disable-next-line: prefer-const
    let newDSProperties = JSON.parse(JSON.stringify(globals.DATA_SET_PROPERTIES));

    datasetProvider.checkCurrentProfile(node);
    if (Profiles.getInstance().validProfile !== api.ValidProfileEnum.INVALID) {
        // 1st step: Get data set name
        const options: vscode.InputBoxOptions = {
            placeHolder: localize("createFile.inputBox.placeHolder", "Name of Data Set"),
            ignoreFocusOut: true,
        };
        dsName = await UIViews.inputBox(options);
        if (dsName) {
            dsName = dsName.trim().toUpperCase();
            newDSProperties.forEach((property) => {
                if (property.key === `dsName`) {
                    property.value = dsName;
                    property.placeHolder = dsName;
                }
            });
        } else {
            globals.LOG.debug(
                localize("createFile.noValidNameEntered", "No valid data set name entered. Operation cancelled")
            );
            vscode.window.showInformationMessage(localize("createFile.operationCancelled", "Operation cancelled."));
            return;
        }

        // 2nd step: Get data set type
        const type = await vscode.window.showQuickPick(stepTwoChoices, stepTwoOptions);
        if (type == null) {
            globals.LOG.debug(
                localize("createFile.noValidTypeSelected", "No valid data set type selected. Operation cancelled.")
            );
            vscode.window.showInformationMessage(localize("createFile.operationCancelled", "Operation cancelled."));
            return;
        } else {
            // Add the default property values to the list of items
            // that will be shown in DS attributes for editing
            typeEnum = getDataSetTypeAndOptions(type).typeEnum;
            const cliDefaultsKey = globals.CreateDataSetTypeWithKeysEnum[typeEnum].replace("DATA_SET_", "");

            propertiesFromDsType = zowe.CreateDefaults.DATA_SET[cliDefaultsKey];
            newDSProperties.forEach((property) => {
                Object.keys(propertiesFromDsType).forEach((typeProperty) => {
                    if (typeProperty === property.key) {
                        property.value = propertiesFromDsType[typeProperty].toString();
                        property.placeHolder = propertiesFromDsType[typeProperty];
                    }
                });
            });
        }

        // 3rd step: Ask if we allocate, or show DS attributes
        const choice = await vscode.window.showQuickPick(stepThreeChoices, stepThreeOptions);
        if (choice == null) {
            globals.LOG.debug(localize("createFile.noOptionSelected", "No option selected. Operation cancelled."));
            vscode.window.showInformationMessage(localize("createFile.operationCancelled", "Operation cancelled."));
            return;
        } else {
            if (choice === " + Allocate Data Set") {
                // User wants to allocate straightaway - skip Step 4
                globals.LOG.debug(localize("createFile.allocatingNewDataSet", "Allocating new data set"));
                vscode.window.showInformationMessage(
                    localize("createFile.allocatingNewDataSet", "Allocating new data set")
                );
            } else {
                // 4th step (optional): Show data set attributes
                const choice2 = await handleUserSelection(newDSProperties, type);
                if (choice2 == null) {
                    globals.LOG.debug(
                        localize("createFile.noOptionSelected", "No option selected. Operation cancelled.")
                    );
                    vscode.window.showInformationMessage(
                        localize("createFile.operationCancelled", "Operation cancelled.")
                    );
                    return;
                } else {
                    globals.LOG.debug(
                        localize("createFile.allocatingNewDataSet", "Attempting to allocate new data set")
                    );
                }
            }
        }

        // Format properties for use by API
        const dsPropsForAPI = {};
        newDSProperties.forEach((property) => {
            if (property.value) {
                if (property.key === `dsName`) {
                    dsName = property.value;
                } else {
                    if (typeof propertiesFromDsType[property.key] === "number") {
                        dsPropsForAPI[property.key] = Number(property.value);
                    } else {
                        dsPropsForAPI[property.key] = property.value;
                    }
                }
            }
        });

        try {
            // Allocate the data set
            await ZoweExplorerApiRegister.getMvsApi(node.getProfile()).createDataSet(typeEnum, dsName, dsPropsForAPI);
            node.dirty = true;

            const theFilter = await datasetProvider.createFilterString(dsName, node);
            datasetProvider.addSearchHistory(theFilter);
            datasetProvider.refresh();

            // Show newly-created data set in expanded tree view
            if (dsName) {
                node.tooltip = node.pattern = theFilter.toUpperCase();
                node.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
                const icon = getIconByNode(node);
                if (icon) {
                    node.iconPath = icon.path;
                }
                node.dirty = true;

                const newNode = await node
                    .getChildren()
                    .then((children) => children.find((child) => child.label === dsName));
                datasetProvider
                    .getTreeView()
                    .reveal(node, { select: true, focus: true })
                    .then(() => datasetProvider.getTreeView().reveal(newNode, { select: true, focus: true }));
            }
        } catch (err) {
            globals.LOG.error(
                localize("createDataSet.error", "Error encountered when creating data set! ") + JSON.stringify(err)
            );
            await errorHandling(
                err,
                node.getProfileName(),
                localize("createDataSet.error", "Error encountered when creating data set! ") + err.message
            );
            throw err as Error;
        }
    }
}

async function handleUserSelection(newDSProperties, dsType): Promise<string> {
    // Create the array of items in the quickpick list
    const qpItems = [];
    qpItems.push(new FilterItem({ text: ` + Allocate Data Set`, show: true }));
    newDSProperties.forEach((prop) => {
        qpItems.push(new FilterItem({ text: prop.label, description: prop.value, show: true }));
    });

    // Provide the settings for the quickpick's appearance & behavior
    const quickpick = vscode.window.createQuickPick();
    quickpick.placeholder = localize("createFileNoWebview.options.prompt", "Click on parameters to change them");
    quickpick.ignoreFocusOut = true;
    quickpick.items = [...qpItems];
    quickpick.matchOnDescription = false;
    quickpick.onDidHide(() => {
        if (quickpick.selectedItems.length === 0) {
            globals.LOG.debug(localize("createFile.noOptionSelected", "No option selected. Operation cancelled."));
            vscode.window.showInformationMessage(localize("createFile.operationCancelled", "Operation cancelled."));
            return;
        }
    });

    // Show quickpick and store the user's input
    quickpick.show();
    let pattern: string;
    const choice2 = await resolveQuickPickHelper(quickpick);
    pattern = choice2.label;
    quickpick.dispose();

    if (pattern) {
        // Parse pattern for selected attribute
        switch (pattern) {
            case " + Allocate Data Set":
                return new Promise((resolve) => resolve(` + Allocate Data Set`));
            default:
                const options: vscode.InputBoxOptions = {
                    value: newDSProperties.find((prop) => prop.label === pattern).value,
                    placeHolder: newDSProperties.find((prop) => prop.label === pattern).placeHolder,
                };
                newDSProperties.find((prop) => prop.label === pattern).value = await UIViews.inputBox(options);
                break;
        }
        return Promise.resolve(handleUserSelection(newDSProperties, dsType));
    }
}

/**
 * Shows data set attributes in a new text editor
 *
 * @export
 * @param {IZoweDatasetTreeNode} parent - The parent Node
 * @param {DatasetTree} datasetProvider - the tree which contains the nodes
 */
export async function showDSAttributes(
    parent: api.IZoweDatasetTreeNode,
    datasetProvider: api.IZoweTree<api.IZoweDatasetTreeNode>
) {
    await datasetProvider.checkCurrentProfile(parent);
    if (Profiles.getInstance().validProfile !== api.ValidProfileEnum.INVALID) {
        const label = parent.label as string;
        globals.LOG.debug(localize("showDSAttributes.debug", "showing attributes of data set ") + label);
        let attributes: any;
        try {
            attributes = await ZoweExplorerApiRegister.getMvsApi(parent.getProfile()).dataSet(label, {
                attributes: true,
            });
            attributes = attributes.apiResponse.items;
            attributes = attributes.filter((dataSet) => {
                return dataSet.dsname.toUpperCase() === label.toUpperCase();
            });
            if (attributes.length === 0) {
                throw new Error(
                    localize("showDSAttributes.lengthError", "No matching data set names found for query: ") + label
                );
            }
        } catch (err) {
            globals.LOG.error(
                localize("showDSAttributes.log.error", "Error encountered when listing attributes! ") +
                    JSON.stringify(err)
            );
            await errorHandling(
                err,
                parent.getProfileName(),
                localize("showDSAttributes.error", "Unable to list attributes: ") + err.message
            );
            throw err;
        }

        // shouldn't be possible for there to be two cataloged data sets with the same name,
        // but just in case we'll display all of the results
        // if there's only one result (which there should be), we will just pass in attributes[0]
        // so that prettyJson doesn't display the attributes as an array with a hyphen character
        const attributesText = TextUtils.prettyJson(
            attributes.length > 1 ? attributes : attributes[0],
            undefined,
            false
        );
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
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;
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
export async function submitJcl(datasetProvider: api.IZoweTree<api.IZoweDatasetTreeNode>) {
    if (!vscode.window.activeTextEditor) {
        vscode.window.showErrorMessage(
            localize(
                "submitJcl.noDocumentOpen",
                "No editor with a document that could be submitted as JCL is currently open."
            )
        );
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
                canPickMany: false,
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
    const sesNode = (await datasetProvider.getChildren()).find((child) => child.label.toString() === sessProfileName);
    if (sesNode) {
        sessProfile = sesNode.getProfile();
    } else {
        // if submitting from favorites, a session might not exist for this node
        sessProfile = profiles.loadNamedProfile(sessProfileName);
    }
    if (sessProfile == null) {
        globals.LOG.error(
            localize("submitJcl.log.error.nullSession", "Session for submitting JCL was null or undefined!")
        );
        return;
    }
    await Profiles.getInstance().checkCurrentProfile(sessProfile);
    if (Profiles.getInstance().validProfile !== api.ValidProfileEnum.INVALID) {
        try {
            const job = await ZoweExplorerApiRegister.getJesApi(sessProfile).submitJcl(doc.getText());
            const args = [sessProfileName, job.jobid];
            const setJobCmd = `command:zowe.jobs.setJobSpool?${encodeURIComponent(JSON.stringify(args))}`;
            vscode.window.showInformationMessage(
                localize("submitJcl.jobSubmitted", "Job submitted ") + `[${job.jobid}](${setJobCmd})`
            );
        } catch (error) {
            await errorHandling(
                error,
                sessProfileName,
                localize("submitJcl.jobSubmissionFailed", "Job submission failed\n") + error.message
            );
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
export async function submitMember(node: api.IZoweTreeNode) {
    let label: string;
    let sesName: string;
    let sessProfile: IProfileLoaded;
    const profiles = Profiles.getInstance();
    await profiles.checkCurrentProfile(node.getProfile());
    if (Profiles.getInstance().validProfile !== api.ValidProfileEnum.INVALID) {
        switch (true) {
            // For favorited or non-favorited sequential DS:
            case contextually.isFavorite(node):
            case contextually.isSessionNotFav(node.getParent()):
                sesName = node.getParent().getLabel() as string;
                label = node.label as string;
                sessProfile = node.getProfile();
                break;
            // For favorited or non-favorited data set members:
            case contextually.isFavoritePds(node.getParent()):
            case contextually.isPdsNotFav(node.getParent()):
                sesName = node.getParent().getParent().getLabel() as string;
                label = node.getParent().getLabel().toString() + "(" + node.label.toString() + ")";
                sessProfile = node.getProfile();
                break;
            default:
                vscode.window.showErrorMessage(
                    localize("submitMember.invalidNode", "submitMember() called from invalid node.")
                );
                throw Error(localize("submitMember.error.invalidNode", "submitMember() called from invalid node."));
        }
        try {
            const job = await ZoweExplorerApiRegister.getJesApi(sessProfile).submitJob(label);
            const args = [sesName, job.jobid];
            const setJobCmd = `command:zowe.jobs.setJobSpool?${encodeURIComponent(JSON.stringify(args))}`;
            vscode.window.showInformationMessage(
                localize("submitMember.jobSubmitted", "Job submitted ") + `[${job.jobid}](${setJobCmd})`
            );
        } catch (error) {
            await errorHandling(
                error,
                sesName,
                localize("submitMember.jobSubmissionFailed", "Job submission failed\n") + error.message
            );
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
export async function deleteDataset(node: api.IZoweTreeNode, datasetProvider: api.IZoweTree<api.IZoweDatasetTreeNode>) {
    let label = "";
    let fav = false;
    try {
        const parentContext = node.getParent().contextValue;
        if (parentContext.includes(globals.FAV_SUFFIX)) {
            label = node.getLabel() as string;
            fav = true;
            if (parentContext.includes(globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX)) {
                label = node.getParent().getLabel().toString() + "(" + node.getLabel().toString() + ")";
            }
        } else if (parentContext.includes(globals.DS_SESSION_CONTEXT)) {
            label = node.getLabel() as string;
        } else if (parentContext.includes(globals.DS_PDS_CONTEXT)) {
            label = node.getParent().getLabel().toString() + "(" + node.getLabel().toString() + ")";
        } else {
            throw Error(localize("deleteDataSet.invalidNode.error", "deleteDataSet() called from invalid node."));
        }
        await datasetProvider.checkCurrentProfile(node);
        if (Profiles.getInstance().validProfile !== api.ValidProfileEnum.INVALID) {
            await ZoweExplorerApiRegister.getMvsApi(node.getProfile()).deleteDataSet(label);
        } else {
            return;
        }
    } catch (err) {
        globals.LOG.error(
            localize("deleteDataSet.delete.log.error", "Error encountered when deleting data set! ") +
                JSON.stringify(err)
        );
        if (err.message.includes(localize("deleteDataSet.error.notFound", "not found"))) {
            vscode.window.showInformationMessage(
                localize("deleteDataSet.notFound.error1", "Unable to find file: ") +
                    label +
                    localize("deleteDataSet.notFound.error2", " was probably already deleted.")
            );
        } else {
            await errorHandling(err, node.getProfileName(), err.message);
        }
        throw err;
    }

    // remove node from tree
    if (fav) {
        datasetProvider.mSessionNodes.forEach((ses) => {
            if (node.getProfileName() === ses.label.toString()) {
                ses.dirty = true;
            }
        });
        datasetProvider.removeFavorite(node);
    } else {
        node.getSessionNode().dirty = true;
        datasetProvider.removeFavorite(node);
    }
    datasetProvider.refreshElement(node.getSessionNode());

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
// This is not a UI refresh.
export async function refreshPS(node: api.IZoweDatasetTreeNode) {
    let label: string;
    try {
        switch (true) {
            // For favorited or non-favorited sequential DS:
            case contextually.isFavorite(node):
            case contextually.isSessionNotFav(node.getParent()):
                label = node.label as string;
                break;
            // For favorited or non-favorited data set members:
            case contextually.isFavoritePds(node.getParent()):
            case contextually.isPdsNotFav(node.getParent()):
                label = node.getParent().getLabel().toString() + "(" + node.getLabel().toString() + ")";
                break;
            default:
                throw Error(localize("refreshPS.error.invalidNode", "refreshPS() called from invalid node."));
        }
        const documentFilePath = getDocumentFilePath(label, node);
        const prof = node.getProfile();
        const response = await ZoweExplorerApiRegister.getMvsApi(prof).getContents(label, {
            file: documentFilePath,
            returnEtag: true,
            encoding: prof.profile.encoding,
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
        globals.LOG.error(
            localize("refreshPS.log.error.refresh", "Error encountered when refreshing data set view: ") +
                JSON.stringify(err)
        );
        if (err.message.includes(localize("refreshPS.error.notFound", "not found"))) {
            vscode.window.showInformationMessage(
                localize("refreshPS.file1", "Unable to find file: ") +
                    label +
                    localize("refreshPS.file2", " was probably deleted.")
            );
        } else {
            await errorHandling(err, node.getProfileName(), err.message);
        }
    }
}

/**
 * Refreshes the names of each member within a PDS
 *
 * @param {IZoweDatasetTreeNode} node - The node which represents the parent PDS of members
 * @param datasetProvider
 */
export async function refreshDataset(
    node: api.IZoweDatasetTreeNode,
    datasetProvider: api.IZoweTree<api.IZoweDatasetTreeNode>
) {
    try {
        await node.getChildren();
        datasetProvider.refreshElement(node);
    } catch (err) {
        await errorHandling(err, node.getProfileName(), err.message);
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
export async function enterPattern(node: api.IZoweDatasetTreeNode, datasetProvider: DatasetTree) {
    if (globals.LOG) {
        globals.LOG.debug(localize("enterPattern.log.debug.prompt", "Prompting the user for a data set pattern"));
    }
    let pattern: string;
    if (contextually.isSessionNotFav(node)) {
        // manually entering a search
        const options: vscode.InputBoxOptions = {
            prompt: localize(
                "enterPattern.inputBox.prompt",
                "Search Data Sets: use a comma to separate multiple patterns"
            ),
            value: node.pattern,
        };
        // get user input
        pattern = await UIViews.inputBox(options);
        if (!pattern) {
            vscode.window.showInformationMessage(localize("enterPattern.pattern", "You must enter a pattern."));
            return;
        }
    } else {
        // executing search from saved search in favorites
        pattern = node.label.toString().substring(node.label.toString().indexOf(":") + 2);
        const session = node.label
            .toString()
            .substring(node.label.toString().indexOf("[") + 1, node.label.toString().indexOf("]"));
        await datasetProvider.addSession(session);
        node = datasetProvider.mSessionNodes.find((tempNode) => tempNode.label.toString() === session);
    }

    // update the treeview with the new pattern
    // TODO figure out why a label change is needed to refresh the treeview,
    // instead of changing the collapsible state
    // change label so the treeview updates
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
 * Copy data set info
 *
 * @export
 * @param {IZoweNodeType} node - The node to copy
 */
export async function copyDataSet(node: api.IZoweNodeType) {
    return vscode.env.clipboard.writeText(JSON.stringify(dsUtils.getNodeLabels(node)));
}

/**
 * Migrate data sets
 *
 * @export
 * @param {IZoweDatasetTreeNode} node - The node to paste to
 */
export async function hMigrateDataSet(node: ZoweDatasetNode) {
    await Profiles.getInstance().checkCurrentProfile(node.getProfile());
    if (Profiles.getInstance().validProfile !== api.ValidProfileEnum.INVALID) {
        const { dataSetName } = dsUtils.getNodeLabels(node);
        vscode.window.showInformationMessage(
            localize("hMigrate.requestSent1", "Migration of dataset: ") +
                dataSetName +
                localize("hMigrate.requestSent2", " requested.")
        );
        try {
            return ZoweExplorerApiRegister.getMvsApi(node.getProfile()).hMigrateDataSet(dataSetName);
        } catch (err) {
            vscode.window.showErrorMessage(err.message);
            return;
        }
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
    await Profiles.getInstance().checkCurrentProfile(node.getProfile());
    if (Profiles.getInstance().validProfile !== api.ValidProfileEnum.INVALID) {
        const { dataSetName } = dsUtils.getNodeLabels(node);
        vscode.window.showInformationMessage(
            localize("hRecall.requestSent1", "Recall of dataset: ") +
                dataSetName +
                localize("hRecall.requestSent2", " requested.")
        );
        try {
            return ZoweExplorerApiRegister.getMvsApi(node.getProfile()).hRecallDataSet(dataSetName);
        } catch (err) {
            vscode.window.showErrorMessage(err.message);
            return;
        }
    } else {
        vscode.window.showErrorMessage(localize("hMigrateDataSet.checkProfile", "Profile is invalid"));
        return;
    }
}

/**
 * Paste member
 *
 * @export
 * @param {ZoweNode} node - The node to paste to
 * @param {DatasetTree} datasetProvider - the tree which contains the nodes
 */
export async function pasteMember(
    node: api.IZoweDatasetTreeNode,
    datasetProvider: api.IZoweTree<api.IZoweDatasetTreeNode>
) {
    const { profileName, dataSetName } = dsUtils.getNodeLabels(node);
    let memberName;
    let beforeDataSetName;
    let beforeProfileName;
    let beforeMemberName;

    await Profiles.getInstance().checkCurrentProfile(node.getProfile());
    if (Profiles.getInstance().validProfile !== api.ValidProfileEnum.INVALID) {
        try {
            ({
                dataSetName: beforeDataSetName,
                memberName: beforeMemberName,
                profileName: beforeProfileName,
            } = JSON.parse(await vscode.env.clipboard.readText()));
        } catch (err) {
            throw Error("Invalid clipboard. Copy from data set first");
        }
        if (node.contextValue.includes(globals.DS_PDS_CONTEXT)) {
            const inputBoxOptions: vscode.InputBoxOptions = {
                value: beforeMemberName,
                placeHolder: localize("pasteMember.inputBox.placeHolder", "Name of Data Set Member"),
            };
            memberName = await UIViews.inputBox(inputBoxOptions);
            if (!memberName) {
                return;
            }
        }

        if (beforeProfileName === profileName) {
            if (memberName) {
                const responseItem: zowe.IZosFilesResponse = await ZoweExplorerApiRegister.getMvsApi(
                    node.getProfile()
                ).allMembers(`${dataSetName}`);
                if (
                    responseItem.apiResponse.items.some((singleItem) => singleItem.member === memberName.toUpperCase())
                ) {
                    throw Error(`${dataSetName}(${memberName}) already exists. You cannot replace a member`);
                }
            }
            try {
                await ZoweExplorerApiRegister.getMvsApi(node.getProfile()).copyDataSetMember(
                    { dsn: beforeDataSetName, member: beforeMemberName },
                    { dsn: dataSetName, member: memberName }
                );
            } catch (err) {
                vscode.window.showErrorMessage(err.message);
                return;
            }
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
export async function saveFile(doc: vscode.TextDocument, datasetProvider: api.IZoweTree<api.IZoweDatasetTreeNode>) {
    // Check if file is a data set, instead of some other file
    globals.LOG.debug(localize("saveFile.log.debug.request", "requested to save data set: ") + doc.fileName);
    const docPath = path.join(doc.fileName, "..");
    globals.LOG.debug("requested to save data set: " + doc.fileName);
    if (docPath.toUpperCase().indexOf(globals.DS_DIR.toUpperCase()) === -1) {
        globals.LOG.debug(
            localize("saveFile.log.debug.path", "path.relative returned a non-blank directory.") +
                localize("saveFile.log.debug.directory", "Assuming we are not in the DS_DIR directory: ") +
                path.relative(docPath, globals.DS_DIR)
        );
        return;
    }
    const start = path.join(globals.DS_DIR + path.sep).length;
    const ending = doc.fileName.substring(start);
    const sesName = ending.substring(0, ending.indexOf(path.sep));
    const profile = Profiles.getInstance().loadNamedProfile(sesName);
    if (!profile) {
        globals.LOG.error(localize("saveFile.log.error.session", "Couldn't locate session when saving data set!"));
        return vscode.window.showErrorMessage(
            localize("saveFile.log.error.session", "Couldn't locate session when saving data set!")
        );
    }

    // get session from session name
    let documentSession: Session;
    let node: api.IZoweDatasetTreeNode;
    const sesNode = (await datasetProvider.getChildren()).find((child) => child.label.toString() === sesName);
    if (sesNode) {
        globals.LOG.debug(localize("saveFile.log.debug.load", "Loading session from session node in saveFile()"));
        documentSession = sesNode.getSession();
    } else {
        // if saving from favorites, a session might not exist for this node
        globals.LOG.debug(
            localize(
                "saveFile.log.debug.sessionNode",
                "couldn't find session node, loading profile with CLI profile manager"
            )
        );
        documentSession = ZoweExplorerApiRegister.getMvsApi(profile).getSession();
    }

    // If not a member
    let label = doc.fileName.substring(
        doc.fileName.lastIndexOf(path.sep) + 1,
        checkForAddedSuffix(doc.fileName) ? doc.fileName.lastIndexOf(".") : doc.fileName.length
    );
    label = label.toUpperCase();
    globals.LOG.debug(localize("saveFile.log.debug.saving", "Saving file ") + label);
    if (!label.includes("(")) {
        try {
            // Checks if file still exists on server
            const response = await ZoweExplorerApiRegister.getMvsApi(profile).dataSet(label);
            if (!response.apiResponse.items.length) {
                return vscode.window.showErrorMessage(
                    localize(
                        "saveFile.error.saveFailed",
                        "Data set failed to save. Data set may have been deleted on mainframe."
                    )
                );
            }
        } catch (err) {
            await errorHandling(err, sesName, err.message);
        }
    }
    // Get specific node based on label and parent tree (session / favorites)
    let nodes: api.IZoweNodeType[];
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
            return `${zNodeDetails.profileName}(${zNodeDetails.dataSetName})` === `${label}`;
        } else if (contextually.isDs(zNode)) {
            return zNode.label.toString() === label;
        } else {
            return false;
        }
    });

    // define upload options
    let uploadOptions: IUploadOptions;
    if (node) {
        uploadOptions = {
            etag: node.getEtag(),
            returnEtag: true,
        };
    }

    try {
        const uploadResponse = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Window,
                title: localize("saveFile.response.save.title", "Saving data set..."),
            },
            () => {
                const prof = node ? node.getProfile() : profile;
                if (prof.profile.encoding) {
                    uploadOptions.encoding = prof.profile.encoding;
                }
                return ZoweExplorerApiRegister.getMvsApi(prof).putContents(doc.fileName, label, uploadOptions);
            }
        );
        if (uploadResponse.success) {
            vscode.window.setStatusBarMessage(uploadResponse.commandResponse, globals.STATUS_BAR_TIMEOUT_MS);
            // set local etag with the new etag from the updated file on mainframe
            if (node) {
                node.setEtag(uploadResponse.apiResponse[0].etag);
                setFileSaved(true);
            }
        } else if (
            !uploadResponse.success &&
            uploadResponse.commandResponse.includes(
                localize("saveFile.error.ZosmfEtagMismatchError", "Rest API failure with HTTP(S) status 412")
            )
        ) {
            if (globals.ISTHEIA) {
                await willForceUpload(node, doc, label, node ? node.getProfile() : profile);
            } else {
                const oldDoc = doc;
                const oldDocText = oldDoc.getText();
                const prof = node ? node.getProfile() : profile;
                if (prof.profile.encoding) {
                    uploadOptions.encoding = prof.profile.encoding;
                }
                const downloadResponse = await ZoweExplorerApiRegister.getMvsApi(prof).getContents(label, {
                    file: doc.fileName,
                    returnEtag: true,
                    encoding: prof.profile.encoding,
                });
                // re-assign etag, so that it can be used with subsequent requests
                const downloadEtag = downloadResponse.apiResponse.etag;
                if (node && downloadEtag !== node.getEtag()) {
                    node.setEtag(downloadEtag);
                }
                vscode.window.showWarningMessage(
                    localize(
                        "saveFile.error.etagMismatch",
                        "Remote file has been modified in the meantime.\nSelect 'Compare' to resolve the conflict."
                    )
                );
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
