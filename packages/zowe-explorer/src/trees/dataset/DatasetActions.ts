/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

import * as vscode from "vscode";
import * as zosfiles from "@zowe/zos-files-for-zowe-sdk";
import * as path from "path";
import {
    Gui,
    imperative,
    IZoweDatasetTreeNode,
    Validation,
    Types,
    FsAbstractUtils,
    ZoweScheme,
    ZoweExplorerApiType,
    PdsEntry,
    type AttributeInfo,
    DataSetAttributesProvider,
    ZosEncoding,
} from "@zowe/zowe-explorer-api";
import { ZoweDatasetNode } from "./ZoweDatasetNode";
import { DatasetUtils } from "./DatasetUtils";
import { DatasetFSProvider } from "./DatasetFSProvider";
import { ZoweLogger } from "../../tools/ZoweLogger";
import { Constants } from "../../configuration/Constants";
import { Profiles } from "../../configuration/Profiles";
import { ZoweExplorerApiRegister } from "../../extending/ZoweExplorerApiRegister";
import { IconGenerator } from "../../icons/IconGenerator";
import { LocalFileManagement } from "../../management/LocalFileManagement";
import { ProfileManagement } from "../../management/ProfileManagement";
import { SharedContext } from "../shared/SharedContext";
import { SharedUtils } from "../shared/SharedUtils";
import { FilterItem } from "../../management/FilterManagement";
import { AuthUtils } from "../../utils/AuthUtils";
import { Definitions } from "../../configuration/Definitions";
import { TreeViewUtils } from "../../utils/TreeViewUtils";
import { SharedTreeProviders } from "../shared/SharedTreeProviders";
import { DatasetTree } from "./DatasetTree";

type ClipboardItem = {
    profileName: string;
    dataSetName: string;
    memberName?: string;
};

export class DatasetActions {
    public static typeEnum: zosfiles.CreateDataSetTypeEnum;
    public static newDSProperties;
    public static localizedStrings = {
        dsBinary: vscode.l10n.t("Partitioned Data Set: Binary"),
        dsC: vscode.l10n.t("Partitioned Data Set: C"),
        dsClassic: vscode.l10n.t("Partitioned Data Set: Classic"),
        dsPartitioned: vscode.l10n.t("Partitioned Data Set: Default"),
        dsExtended: vscode.l10n.t("Partitioned Data Set: Extended"),
        dsSequential: vscode.l10n.t("Sequential Data Set"),
        opCancelled: vscode.l10n.t("Operation cancelled"),
        copyingMembers: vscode.l10n.t("Copying member(s)"),
        copyingDatasets: vscode.l10n.t("Copying data set(s)"),
        profileInvalid: vscode.l10n.t("Profile is invalid, check connection details."),
        allocString: vscode.l10n.t("Allocate Data Set"),
        editString: vscode.l10n.t("Edit Attributes"),
    };

    private static async handleUserSelection(): Promise<string> {
        // Create the array of items in the quickpick list
        const qpItems = [];
        qpItems.push(new FilterItem({ text: `\u002B ${DatasetActions.localizedStrings.allocString}`, show: true }));
        DatasetActions.newDSProperties?.forEach((prop) => {
            const propLabel = `\u270F ${prop.label as string}`;
            qpItems.push(new FilterItem({ text: propLabel, description: prop.value, show: true }));
        });

        // Provide the settings for the quickpick's appearance & behavior
        const quickpick = Gui.createQuickPick();
        quickpick.placeholder = vscode.l10n.t("Click on parameters to change them");
        quickpick.ignoreFocusOut = true;
        quickpick.items = [...qpItems];
        quickpick.matchOnDescription = false;
        quickpick.onDidHide(() => {
            if (quickpick.selectedItems.length === 0) {
                ZoweLogger.debug(DatasetActions.localizedStrings.opCancelled);
                Gui.showMessage(DatasetActions.localizedStrings.opCancelled);
            }
        });

        // Show quickpick and store the user's input
        quickpick.show();
        const choice2 = await Gui.resolveQuickPick(quickpick);
        quickpick.dispose();
        if (!choice2) {
            return;
        }
        const pattern = choice2.label;
        const showPatternOptions = async (): Promise<void> => {
            const options: vscode.InputBoxOptions = {
                value: DatasetActions.newDSProperties?.find((prop) => pattern.includes(prop.label))?.value,
                placeHolder: DatasetActions.newDSProperties?.find((prop) => prop.label === pattern)?.placeHolder,
            };
            DatasetActions.newDSProperties.find((prop) => pattern.includes(prop.label)).value = await Gui.showInputBox(options);
        };

        if (pattern) {
            // Parse pattern for selected attribute
            if (pattern.includes(DatasetActions.localizedStrings.allocString)) {
                return Promise.resolve(DatasetActions.localizedStrings.allocString);
            } else {
                await showPatternOptions();
            }
            return Promise.resolve(DatasetActions.handleUserSelection());
        }
    }

    private static async getDataSetName(): Promise<string> {
        const options: vscode.InputBoxOptions = {
            placeHolder: vscode.l10n.t("Name of Data Set"),
            ignoreFocusOut: true,
            validateInput: (text) => {
                return DatasetUtils.validateDataSetName(text) === true ? null : vscode.l10n.t("Enter valid dataset name");
            },
        };
        let dsName = await Gui.showInputBox(options);
        if (!dsName) {
            return;
        }
        dsName = dsName.trim().toUpperCase();
        return dsName;
    }

    private static async getDsTypeForCreation(datasetProvider: Types.IZoweDatasetTreeType): Promise<string> {
        const stepTwoOptions: vscode.QuickPickOptions = {
            placeHolder: vscode.l10n.t("Template of Data Set to be Created"),
            ignoreFocusOut: true,
            canPickMany: false,
        };
        //get array of template names
        const dsTemplateNames = DatasetActions.getTemplateNames(datasetProvider);
        const stepTwoChoices = [
            ...dsTemplateNames,
            DatasetActions.localizedStrings.dsBinary,
            DatasetActions.localizedStrings.dsC,
            DatasetActions.localizedStrings.dsClassic,
            DatasetActions.localizedStrings.dsPartitioned,
            DatasetActions.localizedStrings.dsExtended,
            DatasetActions.localizedStrings.dsSequential,
        ];
        return Promise.resolve(Gui.showQuickPick(stepTwoChoices, stepTwoOptions));
    }

    private static getTemplateNames(datasetProvider: Types.IZoweDatasetTreeType): string[] {
        const templates = datasetProvider.getDsTemplates();
        const templateNames: string[] = [];
        templates?.forEach((template) => {
            Object.entries(template).forEach(([key, _value]) => {
                templateNames.push(key);
            });
        });
        return templateNames;
    }

    private static compareDsProperties(type: string, datasetProvider: Types.IZoweDatasetTreeType): boolean {
        let isMatch = true;
        const templates: Types.DataSetAllocTemplate[] = datasetProvider.getDsTemplates();
        let propertiesFromDsType: Partial<zosfiles.ICreateDataSetOptions>;
        // Look for template
        templates?.forEach((template) => {
            for (const [key, value] of Object.entries(template)) {
                if (type === key) {
                    propertiesFromDsType = value;
                }
            }
        });
        if (!propertiesFromDsType) {
            propertiesFromDsType = DatasetActions.getDefaultDsTypeProperties(type);
        }
        DatasetActions.newDSProperties?.forEach((property) => {
            Object.keys(propertiesFromDsType).forEach((typeProperty) => {
                if (typeProperty === property.key && propertiesFromDsType[typeProperty] != null) {
                    if (property.value !== propertiesFromDsType[typeProperty].toString()) {
                        isMatch = false;
                        return;
                    }
                }
            });
        });
        return isMatch;
    }

    private static getDsProperties(type: string, datasetProvider: Types.IZoweDatasetTreeType): Partial<zosfiles.ICreateDataSetOptions> {
        const templates: Types.DataSetAllocTemplate[] = datasetProvider.getDsTemplates();
        let propertiesFromDsType: Partial<zosfiles.ICreateDataSetOptions>;
        // Look for template
        templates?.forEach((template) => {
            Object.entries(template).forEach(([key, value]) => {
                if (type === key) {
                    if (template[key].dsorg === "PS") {
                        DatasetActions.typeEnum = 4;
                    } else {
                        DatasetActions.typeEnum = 3;
                    }
                    propertiesFromDsType = value;
                }
            });
        });
        if (!propertiesFromDsType) {
            propertiesFromDsType = DatasetActions.getDefaultDsTypeProperties(type);
        }
        const propertyKeys = Object.keys(propertiesFromDsType);
        DatasetActions.newDSProperties?.forEach((property) => {
            const typeProperty = propertyKeys.find((prop) => prop === property.key);
            if (typeProperty != null && propertiesFromDsType[typeProperty] != null) {
                property.value = propertiesFromDsType[typeProperty].toString();
                property.placeHolder = propertiesFromDsType[typeProperty];
            }
        });
        return propertiesFromDsType;
    }

    private static getDefaultDsTypeProperties(dsType: string): zosfiles.ICreateDataSetOptions {
        DatasetActions.typeEnum = DatasetActions.getDataSetTypeAndOptions(dsType)?.typeEnum;

        if (DatasetActions.typeEnum === zosfiles.CreateDataSetTypeEnum.DATA_SET_BLANK) {
            const options = DatasetActions.getDataSetTypeAndOptions(dsType)?.createOptions;
            return DatasetActions.getDsTypePropertiesFromWorkspaceConfig(options);
        } else {
            const cliDefaultsKey = Definitions.CreateDataSetTypeWithKeysEnum[DatasetActions.typeEnum]?.replace("DATA_SET_", "");
            return zosfiles.CreateDefaults.DATA_SET[cliDefaultsKey] as zosfiles.ICreateDataSetOptions;
        }
    }

    private static async allocateOrEditAttributes(): Promise<string> {
        const stepThreeOptions: vscode.QuickPickOptions = {
            ignoreFocusOut: true,
            canPickMany: false,
        };
        const allocate = `\u002B ${DatasetActions.localizedStrings.allocString}`;
        const editAtts = `\u270F ${DatasetActions.localizedStrings.editString}`;
        const stepThreeChoices = [allocate, editAtts];
        return Promise.resolve(Gui.showQuickPick(stepThreeChoices, stepThreeOptions));
    }

    private static async allocateNewDataSet(
        node: IZoweDatasetTreeNode,
        dsName: string,
        dsPropsForAPI: {},
        datasetProvider: Types.IZoweDatasetTreeType
    ): Promise<void> {
        const profile = node.getProfile();
        try {
            // Allocate the data set
            await ZoweExplorerApiRegister.getMvsApi(profile).createDataSet(DatasetActions.typeEnum, dsName, {
                responseTimeout: profile?.profile?.responseTimeout,
                ...dsPropsForAPI,
            });
            node.dirty = true;
            const theFilter = datasetProvider.createFilterString(dsName, node);
            datasetProvider.refresh();

            // Show newly-created data set in expanded tree view
            await DatasetActions.focusOnNewDs(node, dsName, datasetProvider, theFilter);
        } catch (err) {
            const errorMsg = vscode.l10n.t("Error encountered when creating data set.");
            ZoweLogger.error(errorMsg + JSON.stringify(err));
            if (err instanceof Error) {
                await AuthUtils.errorHandling(err, { apiType: ZoweExplorerApiType.Mvs, profile: node.getProfile(), scenario: errorMsg });
            }
            throw new Error(err);
        }
    }

    private static async focusOnNewDs(
        node: IZoweDatasetTreeNode,
        dsName: string,
        datasetProvider: Types.IZoweDatasetTreeType,
        theFilter: any
    ): Promise<void> {
        node.pattern = theFilter.toUpperCase();
        const toolTipList: string[] = (node.tooltip as string).split("\n");
        const patternIndex = toolTipList.findIndex((key) => key.startsWith(vscode.l10n.t("Pattern: ")));
        if (patternIndex === -1) {
            toolTipList.push(`${vscode.l10n.t("Pattern: ")}${node.pattern}`);
        } else {
            toolTipList[patternIndex] = `${vscode.l10n.t("Pattern: ")}${node.pattern}`;
        }
        node.tooltip = toolTipList.join("\n");
        node.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        const icon = IconGenerator.getIconByNode(node);
        if (icon) {
            node.iconPath = icon.path;
        }
        node.dirty = true;

        const newNode = await node.getChildren().then((children) => children.find((child) => child.label === dsName));
        datasetProvider
            .getTreeView()
            .reveal(node, { select: true, focus: true })
            .then(() => datasetProvider.getTreeView().reveal(newNode, { select: true, focus: true }));
    }

    private static async saveDsTemplate(datasetProvider: Types.IZoweDatasetTreeType, dsPropsForAPI: any): Promise<void> {
        // newDSProperties
        await Gui.infoMessage("Would you like to save these attributes as a template for future data set creation?", {
            items: ["Save"],
            vsCodeOpts: { modal: true },
        }).then(async (selection) => {
            if (selection) {
                const options: vscode.InputBoxOptions = {
                    placeHolder: vscode.l10n.t("Name of Data Set Template"),
                    ignoreFocusOut: true,
                };
                const templateName = await vscode.window.showInputBox(options);
                if (!templateName) {
                    ZoweLogger.debug(DatasetActions.localizedStrings.opCancelled);
                    Gui.showMessage(DatasetActions.localizedStrings.opCancelled);
                    return;
                }
                const newTemplate: Types.DataSetAllocTemplate = {
                    [templateName]: dsPropsForAPI,
                };
                await datasetProvider.addDsTemplate(newTemplate);
            }
        });
    }

    /**
     * Allocates a copy of a data set or member
     *
     */
    public static async allocateLike(datasetProvider: Types.IZoweDatasetTreeType, node?: IZoweDatasetTreeNode): Promise<void> {
        let profile: imperative.IProfileLoaded;
        let likeDSName: string;
        let currSession: IZoweDatasetTreeNode;

        // User called allocateLike from the command palette
        if (!node) {
            // The user must choose a session
            const qpItems = [];
            const quickpick = Gui.createQuickPick();
            quickpick.placeholder = vscode.l10n.t("Select the profile to which the original data set belongs");
            quickpick.ignoreFocusOut = true;

            for (const thisSession of datasetProvider.mSessionNodes) {
                if (!thisSession.label.toString().includes(vscode.l10n.t("Favorites"))) {
                    qpItems.push(new FilterItem({ text: thisSession.label as string }));
                }
            }
            quickpick.items = [...qpItems];

            quickpick.show();
            const selection = await Gui.resolveQuickPick(quickpick);
            if (!selection) {
                Gui.showMessage(vscode.l10n.t("You must select a profile."));
                return;
            } else {
                ZoweLogger.trace(`${selection?.toString()} was profile chosen to allocate a data set.`);
                currSession = datasetProvider.mSessionNodes.find((thisSession) => thisSession.label === selection.label) as IZoweDatasetTreeNode;
                profile = currSession.getProfile();
            }
            quickpick.dispose();

            // The user must enter the name of a data set to copy
            const currSelection = datasetProvider.getTreeView().selection.length > 0 ? datasetProvider.getTreeView().selection[0].label : null;
            const inputBoxOptions: vscode.InputBoxOptions = {
                ignoreFocusOut: true,
                placeHolder: vscode.l10n.t("Enter the name of the data set to copy attributes from"),
                value: currSelection as string,
                validateInput: (text) => {
                    return DatasetUtils.validateDataSetName(text) === true ? null : vscode.l10n.t("Enter a valid data set name.");
                },
            };
            likeDSName = await Gui.showInputBox(inputBoxOptions);
            if (!likeDSName) {
                Gui.showMessage(vscode.l10n.t("You must enter a new data set name."));
                return;
            }
            ZoweLogger.trace(`${likeDSName} was entered to use attributes for new data set.`);
        } else {
            // User called allocateLike by right-clicking a node
            profile = node.getProfile();
            likeDSName = node.label.toString().replace(/\[.*\]: /g, "");
        }
        ZoweLogger.info(
            vscode.l10n.t({
                message: "Allocating data set like {0}.",
                args: [likeDSName],
                comment: ["Like data set name"],
            })
        );

        // Get new data set name
        const options: vscode.InputBoxOptions = {
            ignoreFocusOut: true,
            placeHolder: vscode.l10n.t("Enter a name for the new data set"),
            validateInput: (text) => {
                return DatasetUtils.validateDataSetName(text) === true ? null : vscode.l10n.t("Enter a valid data set name.");
            },
        };
        const newDSName = await Gui.showInputBox(options);
        if (!newDSName) {
            Gui.showMessage(vscode.l10n.t("You must enter a new data set name."));
            return;
        } else {
            ZoweLogger.trace(`${newDSName} was entered for the name of the new data set.`);
            // Allocate the data set, or throw an error
            try {
                await ZoweExplorerApiRegister.getMvsApi(profile).allocateLikeDataSet(newDSName.toUpperCase(), likeDSName);
            } catch (err) {
                if (err instanceof Error) {
                    await AuthUtils.errorHandling(err, {
                        apiType: ZoweExplorerApiType.Mvs,
                        profile,
                        dsName: newDSName,
                        scenario: vscode.l10n.t("Unable to create data set."),
                    });
                }
                throw err;
            }
        }

        // Refresh tree and open new node, if applicable
        if (!currSession) {
            currSession = datasetProvider.mSessionNodes.find(
                (thisSession) => thisSession.label.toString().trim() === profile.name
            ) as IZoweDatasetTreeNode;
        }

        const theFilter = datasetProvider.createFilterString(newDSName, currSession);
        currSession.pattern = theFilter.toUpperCase();
        datasetProvider.refresh();
        currSession.dirty = true;
        datasetProvider.refreshElement(currSession);
        const newNode = (await currSession.getChildren()).find((child) => child.label.toString() === newDSName.toUpperCase());
        await datasetProvider.getTreeView().reveal(currSession, { select: true, focus: true });
        datasetProvider.getTreeView().reveal(newNode, { select: true, focus: true });
        ZoweLogger.info(
            vscode.l10n.t({
                message: "{0} was created like {1}.",
                args: [newDSName, likeDSName],
                comment: ["New Data Set name", "Like Data Set name"],
            })
        );
    }

    public static async uploadDialog(node: ZoweDatasetNode, datasetProvider: Types.IZoweDatasetTreeType): Promise<void> {
        ZoweLogger.trace("dataset.actions.uploadDialog called.");
        const fileOpenOptions = {
            canSelectFiles: true,
            openLabel: "Upload File",
            canSelectMany: true,
            defaultUri: LocalFileManagement.getDefaultUri(),
        };
        const value = await Gui.showOpenDialog(fileOpenOptions);
        if (value?.length > 0) {
            await Gui.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: vscode.l10n.t("Uploading to data set"),
                    cancellable: true,
                },
                async (progress, token) => {
                    let index = 0;
                    for (const item of value) {
                        if (token.isCancellationRequested) {
                            Gui.showMessage(vscode.l10n.t("Upload action was cancelled."));
                            break;
                        }
                        Gui.reportProgress(progress, value.length, index, "Uploading");
                        const response = await DatasetActions.uploadFile(node, item.fsPath);
                        if (!response?.success) {
                            await AuthUtils.errorHandling(response?.commandResponse, {
                                apiType: ZoweExplorerApiType.Mvs,
                                profile: node.getProfile(),
                            });
                            break;
                        }
                        index++;
                    }
                }
            );

            // refresh Tree View & favorites
            datasetProvider.refreshElement(node);
            datasetProvider.getTreeView().reveal(node, { expand: true, focus: true });
            if (SharedContext.isFavorite(node) || SharedContext.isFavoriteContext(node.getParent())) {
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
            Gui.showMessage(DatasetActions.localizedStrings.opCancelled);
        }
    }

    /**
     * Prompts the user to select an encoding and then the files to upload.
     *
     * @param {ZoweDatasetNode} node - The PDS node that serves as the parent
     * @param {datasetTree} datasetProvider - Data set tree provider instance
     */
    public static async uploadDialogWithEncoding(node: ZoweDatasetNode, datasetProvider: Types.IZoweDatasetTreeType): Promise<void> {
        ZoweLogger.trace("dataset.actions.uploadDialogWithEncoding called.");

        if (!SharedContext.isPds(node)) {
            Gui.showMessage(vscode.l10n.t("This action is only supported for partitioned data sets."));
            return;
        }

        const profile = node.getProfile();
        const encoding = await SharedUtils.promptForUploadEncoding(profile, node.label as string);

        if (!encoding) {
            return;
        }

        const fileOpenOptions = {
            canSelectFiles: true,
            openLabel: "Upload File with Encoding",
            canSelectMany: true,
            defaultUri: LocalFileManagement.getDefaultUri(),
        };
        const selectedFiles = await Gui.showOpenDialog(fileOpenOptions);
        if (!selectedFiles || selectedFiles.length === 0) {
            return;
        }

        await Gui.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: vscode.l10n.t("Uploading to data set..."),
                cancellable: true,
            },
            async (progress, token) => {
                let index = 0;
                for (const item of selectedFiles) {
                    if (token.isCancellationRequested) {
                        break;
                    }
                    Gui.reportProgress(progress, selectedFiles.length, index, "Uploading");
                    const response = await DatasetActions.uploadFileWithEncoding(node, item.fsPath, encoding);
                    if (!response?.success) {
                        await AuthUtils.errorHandling(response?.commandResponse, {
                            apiType: ZoweExplorerApiType.Mvs,
                            profile: node.getProfile(),
                        });
                        break;
                    }
                    index++;
                }
            }
        );

        // refresh Tree View & favorites
        datasetProvider.refreshElement(node);
        datasetProvider.getTreeView().reveal(node, { expand: true, focus: true });
        if (SharedContext.isFavorite(node) || SharedContext.isFavoriteContext(node.getParent())) {
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
    }

    public static async uploadFile(node: ZoweDatasetNode, docPath: string): Promise<zosfiles.IZosFilesResponse> {
        ZoweLogger.trace("dataset.actions.uploadFile called.");
        try {
            const datasetName = node.label as string;
            const prof = node.getProfile();

            return await ZoweExplorerApiRegister.getMvsApi(prof).putContents(docPath, datasetName, {
                encoding: prof.profile?.encoding,
                responseTimeout: prof.profile?.responseTimeout,
            });
        } catch (e) {
            await AuthUtils.errorHandling(e, { apiType: ZoweExplorerApiType.Mvs, profile: node.getProfile() });
        }
    }

    public static async uploadFileWithEncoding(node: ZoweDatasetNode, docPath: string, encoding: ZosEncoding): Promise<zosfiles.IZosFilesResponse> {
        ZoweLogger.trace("dataset.actions.uploadFileWithEncoding called.");
        try {
            const datasetName = node.label as string;
            const prof = node.getProfile();

            const options: any = {
                responseTimeout: prof.profile?.responseTimeout,
                binary: encoding.kind === "binary",
            };

            // Set encoding based on the user's selection
            if (encoding.kind === "text") {
                // Use default EBCDIC
                options.encoding = undefined;
            } else if (encoding.kind === "other" && encoding.codepage) {
                options.encoding = encoding.codepage;
            }

            return await ZoweExplorerApiRegister.getMvsApi(prof).putContents(docPath, datasetName, options);
        } catch (e) {
            await AuthUtils.errorHandling(e, { apiType: ZoweExplorerApiType.Mvs, profile: node.getProfile() });
        }
    }

    /**
     * Deletes nodes from the data set tree & delegates deletion of data sets, members, and profiles
     *
     * @export
     * @param {IZoweDatasetTreeNode} node - The node selected for deletion
     * @param datasetProvider - the tree which contains the nodes
     */
    public static async deleteDatasetPrompt(
        datasetProvider: Types.IZoweDatasetTreeType,
        node?: IZoweDatasetTreeNode,
        nodeList?: IZoweDatasetTreeNode[]
    ): Promise<void> {
        ZoweLogger.trace("dataset.actions.deleteDatasetPrompt called.");
        let selectedNodes;
        if (node || nodeList) {
            selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList) as IZoweDatasetTreeNode[];
        } else {
            selectedNodes = datasetProvider.getTreeView().selection;
        }

        // Check that child and parent aren't both in array, removing children whose parents are in
        // array to avoid errors from host when deleting non-existent children.
        const childArray: IZoweDatasetTreeNode[] = [];
        for (const item of selectedNodes) {
            if (SharedContext.isDsMember(item)) {
                for (const parent of selectedNodes) {
                    if (parent.getLabel() === item.getParent().getLabel()) {
                        childArray.push(item as IZoweDatasetTreeNode);
                    }
                }
            }
        }
        selectedNodes = selectedNodes.filter((val) => !childArray.includes(val as IZoweDatasetTreeNode));

        // Filter out sessions and information messages
        const nodes = selectedNodes.filter(
            (selectedNode) => selectedNode.getParent() && !SharedContext.isSession(selectedNode) && !SharedContext.isInformation(selectedNode)
        ) as IZoweDatasetTreeNode[];

        // Check that there are items to be deleted
        if (!nodes || nodes.length === 0) {
            Gui.showMessage(vscode.l10n.t("No data sets selected for deletion, cancelling..."));
            return;
        }

        // The names of the nodes that should be deleted
        const deleteItemName = (node: IZoweDatasetTreeNode) =>
            SharedContext.isDsMember(node)
                ? ` ${node.getParent().getLabel().toString()}(${node.getLabel().toString()})`
                : ` ${node.getLabel().toString()}`;
        const namesToDelete: string[] = nodes.map(deleteItemName).sort((a, b) => a.localeCompare(b));

        // The member parent nodes that should be refreshed individually
        const memberParents: IZoweDatasetTreeNode[] = [];
        for (const deletedNode of nodes) {
            if (SharedContext.isDsMember(deletedNode)) {
                const parent = deletedNode.getParent();
                if (memberParents.filter((alreadyAddedParent) => alreadyAddedParent.label.toString() === parent.label.toString()).length === 0) {
                    memberParents.push(parent as IZoweDatasetTreeNode);
                }
            }
        }

        const displayedDatasetNames = namesToDelete.slice(0, Constants.MAX_DISPLAYED_DELETE_NAMES).join("\n");
        const additionalDatasetsCount = namesToDelete.length - Constants.MAX_DISPLAYED_DELETE_NAMES;

        // Confirm that the user really wants to delete
        ZoweLogger.debug(
            vscode.l10n.t({
                message: "Deleting data set(s): {0}",
                args: [namesToDelete.join(",")],
                comment: ["Data Sets to delete"],
            })
        );
        const deleteButton = vscode.l10n.t("Delete");
        const message = vscode.l10n.t({
            message:
                `Are you sure you want to delete the following {0} item(s)?\n` +
                `This will permanently remove these data sets and/or members from your system.\n\n{1}{2}`,
            args: [namesToDelete.length, displayedDatasetNames, additionalDatasetsCount > 0 ? `\n...and ${additionalDatasetsCount} more` : ""],
            comment: ["Data Sets to delete length", "Data Sets to delete", "Additional datasets count"],
        });
        const selection = await Gui.warningMessage(message, {
            items: [deleteButton],
            vsCodeOpts: { modal: true },
        });
        if (!selection || selection === "Cancel") {
            ZoweLogger.debug(DatasetActions.localizedStrings.opCancelled);
            return;
        }

        const deletedNames: string[] = [];
        if (nodes.length === 1) {
            await DatasetActions.deleteDataset(nodes[0], datasetProvider);
            deletedNames.push(deleteItemName(nodes[0]));
        } else {
            // Delete multiple selected nodes
            await Gui.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: vscode.l10n.t("Deleting items"),
                    cancellable: true,
                },
                async (progress, token) => {
                    for (const [index, currNode] of nodes.entries()) {
                        if (token.isCancellationRequested) {
                            Gui.showMessage(DatasetActions.localizedStrings.opCancelled);
                            return;
                        }
                        Gui.reportProgress(progress, nodes.length, index, "Deleting");
                        try {
                            await DatasetActions.deleteDataset(currNode, datasetProvider);
                            deletedNames.push(deleteItemName(currNode));
                        } catch (err) {
                            ZoweLogger.error(err);
                        }
                    }
                }
            );
        }
        if (deletedNames.length > 0) {
            deletedNames.sort((a, b) => a.localeCompare(b));
            const displayedDeletedNames = deletedNames.slice(0, Constants.MAX_DISPLAYED_DELETE_NAMES).join("\n");
            const additionalDeletedCount = deletedNames.length - Constants.MAX_DISPLAYED_DELETE_NAMES;
            Gui.showMessage(
                vscode.l10n.t({
                    message: "The following {0} item(s) were deleted:\n{1}{2}",
                    args: [deletedNames.length, displayedDeletedNames, additionalDeletedCount > 0 ? `\n...and ${additionalDeletedCount} more` : ""],
                    comment: ["Data Sets deleted length", "Data Sets deleted", "Additional datasets count"],
                })
            );
        }

        // refresh Tree View & favorites
        datasetProvider.refresh();
        for (const member of memberParents) {
            datasetProvider.refreshElement(member);
        }
        await TreeViewUtils.fixVsCodeMultiSelect(datasetProvider, nodes[0].getParent());
    }

    /**
     * Creates a PDS member
     *
     * @export
     * @param {IZoweDatasetTreeNode} parent - The parent Node
     * @param datasetProvider - the tree which contains the nodes
     */
    public static async createMember(parent: IZoweDatasetTreeNode, datasetProvider: Types.IZoweDatasetTreeType): Promise<void> {
        ZoweLogger.trace("dataset.actions.createMember called.");
        const options: vscode.InputBoxOptions = {
            placeHolder: vscode.l10n.t("Name of member"),
            validateInput: (text) => {
                return DatasetUtils.validateMemberName(text) === true ? null : vscode.l10n.t("Enter valid member name");
            },
        };
        const name = (await Gui.showInputBox(options))?.toUpperCase();
        ZoweLogger.debug(
            vscode.l10n.t({
                message: "Creating new data set member {0}",
                args: [name],
                comment: ["Data Set member name"],
            })
        );
        if (name) {
            const label = parent.label as string;
            const profile = parent.getProfile();
            let replace: Definitions.ShouldReplace;
            try {
                replace = await DatasetActions.determineReplacement(profile, `${label}(${name})`, "mem");
                if (replace !== "cancel") {
                    await ZoweExplorerApiRegister.getMvsApi(profile).createDataSetMember(label + "(" + name + ")", {
                        responseTimeout: profile.profile?.responseTimeout,
                    });
                }
            } catch (err) {
                if (err instanceof Error) {
                    await AuthUtils.errorHandling(err, {
                        apiType: ZoweExplorerApiType.Mvs,
                        parentDsName: label,
                        scenario: vscode.l10n.t("Unable to create member."),
                    });
                }
                throw err;
            }

            parent.dirty = true;
            datasetProvider.refreshElement(parent);

            const newNode = await parent.getChildren().then((children) => children.find((ds) => ds.label === name));
            datasetProvider.getTreeView().reveal(newNode, { select: true, focus: true });

            // Refresh corresponding tree parent to reflect addition
            const otherTreeParent = datasetProvider.findEquivalentNode(parent, SharedContext.isFavorite(parent));
            if (otherTreeParent != null) {
                datasetProvider.refreshElement(otherTreeParent);
            }

            if (newNode != null) {
                if (replace === "notFound") {
                    await vscode.workspace.fs.writeFile(newNode.resourceUri, new Uint8Array());
                }

                await vscode.commands.executeCommand("vscode.open", newNode.resourceUri);
            }
            datasetProvider.refresh();
        }
    }

    public static getDataSetTypeAndOptions(type: string): {
        typeEnum: zosfiles.CreateDataSetTypeEnum;
        createOptions: vscode.WorkspaceConfiguration;
    } {
        let createOptions: vscode.WorkspaceConfiguration;
        switch (type) {
            case DatasetActions.localizedStrings.dsBinary:
                DatasetActions.typeEnum = zosfiles.CreateDataSetTypeEnum.DATA_SET_BINARY;
                createOptions = vscode.workspace.getConfiguration(Constants.SETTINGS_DS_DEFAULT_BINARY);
                break;
            case DatasetActions.localizedStrings.dsC:
                DatasetActions.typeEnum = zosfiles.CreateDataSetTypeEnum.DATA_SET_C;
                createOptions = vscode.workspace.getConfiguration(Constants.SETTINGS_DS_DEFAULT_C);
                break;
            case DatasetActions.localizedStrings.dsClassic:
                DatasetActions.typeEnum = zosfiles.CreateDataSetTypeEnum.DATA_SET_CLASSIC;
                createOptions = vscode.workspace.getConfiguration(Constants.SETTINGS_DS_DEFAULT_CLASSIC);
                break;
            case DatasetActions.localizedStrings.dsPartitioned:
                DatasetActions.typeEnum = zosfiles.CreateDataSetTypeEnum.DATA_SET_PARTITIONED;
                createOptions = vscode.workspace.getConfiguration(Constants.SETTINGS_DS_DEFAULT_PDS);
                break;
            case DatasetActions.localizedStrings.dsExtended:
                DatasetActions.typeEnum = zosfiles.CreateDataSetTypeEnum.DATA_SET_BLANK;
                createOptions = vscode.workspace.getConfiguration(Constants.SETTINGS_DS_DEFAULT_EXTENDED);
                break;
            case DatasetActions.localizedStrings.dsSequential:
                DatasetActions.typeEnum = zosfiles.CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL;
                createOptions = vscode.workspace.getConfiguration(Constants.SETTINGS_DS_DEFAULT_PS);
                break;
        }
        return {
            typeEnum: DatasetActions.typeEnum,
            createOptions,
        };
    }

    /**
     * Creates a new file and uploads to the server
     * @export
     * @param {IZoweDatasetTreeNode} node - Desired Zowe session
     * @param datasetProvider - the tree which contains the nodes
     */
    public static async createFile(node: IZoweDatasetTreeNode, datasetProvider: Types.IZoweDatasetTreeType): Promise<void> {
        await datasetProvider.checkCurrentProfile(node);
        if (Profiles.getInstance().validProfile === Validation.ValidationType.INVALID) {
            return;
        }
        DatasetActions.newDSProperties = JSON.parse(JSON.stringify(Constants.DATA_SET_PROPERTIES));
        // 1st step: Get data set name
        let dsName = await DatasetActions.getDataSetName();
        if (!dsName) {
            ZoweLogger.debug(DatasetActions.localizedStrings.opCancelled);
            Gui.showMessage(DatasetActions.localizedStrings.opCancelled);
            return;
        }
        // 2nd step: Get data set type
        const type = await DatasetActions.getDsTypeForCreation(datasetProvider);
        if (!type) {
            ZoweLogger.debug(DatasetActions.localizedStrings.opCancelled);
            Gui.showMessage(DatasetActions.localizedStrings.opCancelled);
            return;
        }
        const propertiesFromDsType = DatasetActions.getDsProperties(type, datasetProvider);
        // 3rd step: Ask if we allocate, or show DS attributes
        const choice = await DatasetActions.allocateOrEditAttributes();
        if (!choice) {
            ZoweLogger.debug(DatasetActions.localizedStrings.opCancelled);
            Gui.showMessage(DatasetActions.localizedStrings.opCancelled);
            return;
        }
        if (choice.includes(DatasetActions.localizedStrings.allocString)) {
            // User wants to allocate straightaway - skip Step 4
            const allocMsg = vscode.l10n.t("Allocating new data set");
            ZoweLogger.debug(allocMsg);
            Gui.showMessage(allocMsg);
        } else {
            // 4th step (optional): Show data set attributes
            const choice2 = await DatasetActions.handleUserSelection();
            if (!choice2) {
                ZoweLogger.debug(DatasetActions.localizedStrings.opCancelled);
                Gui.showMessage(DatasetActions.localizedStrings.opCancelled);
                return;
            }
            ZoweLogger.debug(vscode.l10n.t("Attempting to allocate new data set"));
        }
        const isMatch = DatasetActions.compareDsProperties(type, datasetProvider);
        // Format properties for use by API
        const dsPropsForAPI = {};
        DatasetActions.newDSProperties?.forEach((property) => {
            if (property.value) {
                if (property.key === `dsName`) {
                    dsName = property.value;
                } else {
                    if (typeof propertiesFromDsType[property.key] === "number" || property.type === "number") {
                        dsPropsForAPI[property.key] = Number(property.value);
                    } else {
                        dsPropsForAPI[property.key] = property.value;
                    }
                }
            }
        });
        await DatasetActions.allocateNewDataSet(node, dsName, dsPropsForAPI, datasetProvider);
        if (!isMatch) {
            await DatasetActions.saveDsTemplate(datasetProvider, dsPropsForAPI);
        }
    }

    public static getDsTypePropertiesFromWorkspaceConfig(createOptions: vscode.WorkspaceConfiguration): zosfiles.ICreateDataSetOptions {
        const dsTypeProperties = {} as zosfiles.ICreateDataSetOptions;
        if (createOptions) {
            dsTypeProperties.dsntype = createOptions.get("dsntype");
            dsTypeProperties.dsorg = createOptions.get("dsorg");
            dsTypeProperties.alcunit = createOptions.get("alcunit");
            dsTypeProperties.primary = createOptions.get("primary");
            dsTypeProperties.secondary = createOptions.get("secondary");
            dsTypeProperties.dirblk = createOptions.get("dirblk");
            dsTypeProperties.recfm = createOptions.get("recfm");
            dsTypeProperties.blksize = createOptions.get("blksize");
            dsTypeProperties.lrecl = createOptions.get("lrecl");
        }
        return dsTypeProperties;
    }

    /**
     * Shows data set attributes in a new text editor
     *
     * @export
     * @param {IZoweDatasetTreeNode} node   - The node to show attributes for
     * @param datasetProvider - the tree which contains the nodes
     */
    public static async showAttributes(node: IZoweDatasetTreeNode, datasetProvider: Types.IZoweDatasetTreeType): Promise<void> {
        ZoweLogger.trace("dataset.actions.showAttributes called.");
        await datasetProvider.checkCurrentProfile(node);
        if (Profiles.getInstance().validProfile !== Validation.ValidationType.INVALID) {
            const label = node.label as string;
            ZoweLogger.debug(
                vscode.l10n.t({
                    message: "Showing attributes for {0}.",
                    args: [label],
                    comment: ["Label"],
                })
            );
            let attributes: any;
            let parentDsName: string | undefined;
            const isMemberNode = SharedContext.isDsMember(node);
            try {
                const nodeProfile = node.getProfile();
                if (isMemberNode) {
                    parentDsName = node.getParent().getLabel() as string;
                    attributes = await ZoweExplorerApiRegister.getMvsApi(nodeProfile).allMembers(parentDsName.toUpperCase(), {
                        attributes: true,
                        pattern: label.toUpperCase(),
                        responseTimeout: nodeProfile?.profile?.responseTimeout,
                    });
                } else {
                    attributes = await ZoweExplorerApiRegister.getMvsApi(nodeProfile).dataSet(label, {
                        attributes: true,
                        responseTimeout: nodeProfile?.profile?.responseTimeout,
                    });
                }
                attributes = attributes.apiResponse.items;
                if (SharedContext.isDs(node)) {
                    attributes = attributes.filter((dataSet) => {
                        return dataSet.dsname.toUpperCase() === label.toUpperCase();
                    });
                }
                if (attributes.length === 0) {
                    throw new Error(
                        vscode.l10n.t({
                            message: "No matching names found for query: {0}",
                            args: [label],
                            comment: ["Label"],
                        })
                    );
                }
            } catch (err) {
                if (err instanceof Error) {
                    await AuthUtils.errorHandling(err, {
                        apiType: ZoweExplorerApiType.Mvs,
                        profile: node.getProfile(),
                        scenario: vscode.l10n.t("Unable to list attributes."),
                    });
                }
                throw err;
            }

            const attributeRecord: Record<string, unknown> = attributes[0];
            const datasetAttributeDefinitions: Array<[string, string, string]> = [
                ["dsname", "Data Set Name", "The name of the dataset"],
                ["member", "Member Name", "The name of the member"],
                ["blksz", "Block Size", "The block size of the dataset"],
                ["catnm", "Catalog Name", "The catalog in which the dataset entry is stored"],
                ["cdate", "Create Date", "The dataset creation date"],
                ["dev", "Device Type", "The type of the device the dataset is stored on"],
                ["dsntp", "Data Set Type", "LIBRARY, (LIBRARY,1), (LIBRARY,2), PDS, HFS, EXTREQ, EXTPREF, BASIC or LARGE"],
                ["dsorg", "Data Set Organization", "The organization of the data set as PS, PO, or DA"],
                ["edate", "Expiration Date", "The dataset expiration date"],
                ["extx", "Extensions", "The number of extensions the dataset has"],
                ["lrecl", "Logical Record Length", "The length in bytes of each record"],
                ["migr", "Migration", "Indicates if automatic migration is active"],
                ["mvol", "Multivolume", "Whether the dataset is on multiple volumes"],
                ["ovf", "Open virtualization format", ""],
                ["rdate", "Reference Date", "Last referenced date"],
                ["recfm", "Record Format", "Valid values: A, B, D, F, M, S, T, U, V (combinable)"],
                ["sizex", "Size", "Size of the first extent in tracks"],
                ["spacu", "Space Unit", "Type of space units measurement"],
                ["used", "Used Space", "Used space percentage"],
                ["vol", "Volume", "Volume serial numbers for data set"],
                ["vols", "Volumes", "Multiple volume serial numbers"],
            ];
            const memberAttributeDefinitions: Array<[string, string, string]> = [
                ["vers", "Version", "Member version number"],
                ["mod", "Modification Level", "Member modification level"],
                ["c4date", "Created Date", "Creation date (4-character year format)"],
                ["m4date", "Modified Date", "Last change date (4-character year format)"],
                ["mtime", "Modified Time", "Last change time (in format hh:mm)"],
                ["msec", "Modified Seconds", "Seconds value of the last change time"],
                ["cnorc", "Current Records", "Current number of records"],
                ["inorc", "Initial Records", "Initial number of records"],
                ["mnorc", "Maximum Records", "Maximum number of records"],
                ["user", "User", "User ID of last user to change the given member"],
                ["sclm", "Modified by ISPF/SCLM", "Indicates whether the member was last modified by SCLM or ISPF"],
            ];
            const attributeDefinitions = isMemberNode ? [...datasetAttributeDefinitions, ...memberAttributeDefinitions] : datasetAttributeDefinitions;

            const getAttributeValue = (key: string): string | number | boolean | undefined => {
                if (isMemberNode) {
                    if (key === "dsname") {
                        return (attributeRecord[key] as string | number | boolean | undefined) ?? parentDsName;
                    }
                    if (key === "member") {
                        return (attributeRecord[key] as string | number | boolean | undefined) ?? label;
                    }
                }
                return attributeRecord[key] as string | number | boolean | undefined;
            };

            DatasetActions.attributeInfo = [
                {
                    title: "Zowe Explorer",
                    reference: "https://docs.zowe.org/stable/typedoc/interfaces/_zowe_zos_files_for_zowe_sdk.izosmflistresponse",
                    keys: new Map(
                        attributeDefinitions.map(([key, displayName, description]) => [
                            key,
                            {
                                displayName: vscode.l10n.t(displayName),
                                description: description ? vscode.l10n.t(description) : undefined,
                                value: getAttributeValue(key) as string | number | boolean,
                            },
                        ])
                    ),
                },
            ];

            const extenderAttributes = DataSetAttributesProvider.getInstance();
            const sessionNode = node.getSessionNode();
            const dsNameForExtenders = (attributeRecord["dsname"] as string | undefined) ?? parentDsName;

            if (dsNameForExtenders) {
                DatasetActions.attributeInfo.push(
                    ...(await extenderAttributes.fetchAll({ dsName: dsNameForExtenders, profile: sessionNode.getProfile() }))
                );
            }

            // Check registered DataSetAttributesProvider, send dsname and profile. get results and append to `attributeInfo`
            const attributesMessage = vscode.l10n.t("Attributes");

            const webviewHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${label} "${attributesMessage}"</title>
</head>
<body>
    ${DatasetActions.attributeInfo
        .map(({ title, reference, keys }) => {
            const linkedTitle = reference
                ? `<a href="${reference}" target="_blank" style="text-decoration: none;">
                    <h2 style="color: var(--vscode-textLink-foreground)">${title}</h2>
                </a>`
                : `<h2>${title}</h2>`;
            const tableRows = Array.from(keys.entries())
                .filter(([key], _, all) => !(key === "vol" && all.some(([k]) => k === "vols")))
                .reduce((html, [key, info]) => {
                    if (info.value === undefined || info.value === null) {
                        return html;
                    }
                    return html.concat(`
                        <tr ${
                            info.displayName || info.description
                                ? `title="${info.displayName ? `(${key})` : ""}${
                                      info.description ? (info.displayName ? " " : "") + info.description : ""
                                  }"`
                                : ""
                        }>
                            <td align="left" style="color: var(--vscode-settings-textInputForeground); font-weight: bold">
                                ${info.displayName || key}:
                            </td>
                            <td align="right" style="color: ${
                                isNaN(info.value as any)
                                    ? "var(--vscode-settings-textInputForeground)"
                                    : "var(--vscode-problemsWarningIcon-foreground)"
                            }">
                                ${info.value as string}
                            </td>
                        </tr>
                `);
                }, "");

            return `
            ${linkedTitle}
            <table style="margin-top: 2em; border-spacing: 2em 0">
                ${tableRows}
            </table>
        `;
        })
        .join("")}
</body>
</html>`;

            const panel: vscode.WebviewPanel = Gui.createWebviewPanel({
                viewType: "zowe",
                title: `${label} ${attributesMessage}`,
                showOptions: vscode.window.activeTextEditor?.viewColumn ?? 1,
            });
            panel.webview.html = webviewHTML;
        }
    }

    private static attributeInfo: AttributeInfo;

    /**
     * Submit the contents of the editor or file as JCL.
     *
     * @export
     * @param datasetProvider DatasetTree object
     */
    // This function does not appear to currently be made available in the UI
    public static async submitJcl(datasetProvider: Types.IZoweDatasetTreeType, file?: vscode.Uri): Promise<void> {
        ZoweLogger.trace("dataset.actions.submitJcl called.");
        if (!vscode.window.activeTextEditor && !file) {
            const notActiveEditorMsg = vscode.l10n.t("No editor with a document that could be submitted as JCL is currently open.");
            Gui.errorMessage(notActiveEditorMsg);
            ZoweLogger.error(notActiveEditorMsg);
            return;
        }

        if (file) {
            await vscode.window.showTextDocument(file, { preview: false });
        }
        const doc = vscode.window.activeTextEditor.document;
        ZoweLogger.debug(
            vscode.l10n.t({
                message: "Submitting as JCL in document {0}",
                args: [doc.fileName],
                comment: ["Document file name"],
            })
        );

        // prompts for job submit confirmation when submitting local JCL from editor/palette
        // no node passed in, ownsJob is true because local file is always owned by userID, passes in local file name
        if (!(await DatasetActions.confirmJobSubmission(doc.fileName, true))) {
            return;
        }

        // get session name
        const profiles = Profiles.getInstance();
        let sessProfileName;
        if (doc.uri.scheme !== ZoweScheme.DS && doc.uri.scheme !== ZoweScheme.USS) {
            const profileNamesList = ProfileManagement.getRegisteredProfileNameList(Definitions.Trees.JES);
            if (profileNamesList.length > 1) {
                const quickPickOptions: vscode.QuickPickOptions = {
                    placeHolder: vscode.l10n.t("Select the profile to use to submit the job"),
                    ignoreFocusOut: true,
                    canPickMany: false,
                };
                sessProfileName = await Gui.showQuickPick(profileNamesList, quickPickOptions);
                if (!sessProfileName) {
                    Gui.infoMessage(DatasetActions.localizedStrings.opCancelled);
                    return;
                }
            } else if (profileNamesList.length > 0) {
                sessProfileName = profileNamesList[0];
            } else {
                Gui.showMessage(vscode.l10n.t("No profiles available"));
            }
        } else {
            const filePathArray = FsAbstractUtils.getInfoForUri(doc.uri);
            sessProfileName = filePathArray.profileName;
        }

        // get profile from session name
        let sessProfile: imperative.IProfileLoaded;
        const sesNode = (await datasetProvider.getChildren()).find((child) => child.label.toString() === sessProfileName);
        if (sesNode) {
            sessProfile = sesNode.getProfile();
        } else {
            // if submitting from favorites, a session might not exist for this node
            sessProfile = profiles.loadNamedProfile(sessProfileName);
        }
        if (sessProfile == null) {
            ZoweLogger.error(vscode.l10n.t("Session for submitting JCL was null or undefined!"));
            return;
        }
        await Profiles.getInstance().checkCurrentProfile(sessProfile);
        if (Profiles.getInstance().validProfile !== Validation.ValidationType.INVALID) {
            try {
                const job = await ZoweExplorerApiRegister.getJesApi(sessProfile).submitJcl(doc.getText());
                const args = [sessProfileName, job.jobid];
                const setJobCmd = `${Constants.SET_JOB_SPOOL_COMMAND}?${encodeURIComponent(JSON.stringify(args))}`;
                Gui.showMessage(
                    vscode.l10n.t({
                        message: "Job submitted {0}",
                        args: [`[${job.jobid}](${setJobCmd})`],
                        comment: ["Job ID and set job command"],
                    })
                );
                ZoweLogger.info(
                    vscode.l10n.t({
                        message: "Job submitted {0} using profile {1}.",
                        args: [job.jobid, sessProfileName],
                        comment: ["Job ID", "Profile name"],
                    })
                );
            } catch (error) {
                if (error instanceof Error) {
                    await AuthUtils.errorHandling(error, {
                        apiType: ZoweExplorerApiType.Mvs,
                        profile: sessProfile,
                        scenario: vscode.l10n.t("Job submission failed."),
                    });
                }
            }
        } else {
            Gui.errorMessage(DatasetActions.localizedStrings.profileInvalid);
        }
    }

    /**
     * Attempts to open a data set from the selection of text made in the editor
     * Works the same as ZOOM command in TSO/ISPF
     *
     */
    public static async zoom(): Promise<void> {
        ZoweLogger.trace("dataset.actions.zoom called.");

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            Gui.warningMessage(vscode.l10n.t("No active editor open. Please open a file and select text to open a data set."));
            return;
        }

        const doc = editor.document;
        const selection = editor.selection;
        const selectedText = doc.getText(selection);
        // Shouldn't happen but just in case
        if (!selectedText) {
            Gui.warningMessage(vscode.l10n.t("No selection to open."));
            return;
        }

        // If selected text is not a valid data set name or data set(member name)
        const ds = DatasetUtils.extractDataSetAndMember(selectedText);
        const hasMember = ds.memberName && ds.memberName.length > 0;
        if (hasMember) {
            if (!DatasetUtils.validateMemberName(ds.memberName)) {
                Gui.warningMessage(vscode.l10n.t("Selection is not a valid data set member name."));
                return;
            }
        } else if (!DatasetUtils.validateDataSetName(ds.dataSetName)) {
            Gui.warningMessage(vscode.l10n.t("Selection is not a valid data set name."));
            return;
        }

        const profiles = Profiles.getInstance();
        const profileNamesList = ProfileManagement.getRegisteredProfileNameList(Definitions.Trees.MVS);
        let sessProfileName = doc.uri ? FsAbstractUtils.getInfoForUri(doc.uri)?.profileName : "";

        // If no profile name or not loaded, prompt user to select one
        if (!sessProfileName || !profiles.allProfiles.some((p) => p.name === sessProfileName)) {
            if (profileNamesList.length > 1) {
                const quickPickOptions: vscode.QuickPickOptions = {
                    placeHolder: vscode.l10n.t("Select the profile to use to open the data set"),
                    ignoreFocusOut: true,
                    canPickMany: false,
                };
                sessProfileName = await Gui.showQuickPick(profileNamesList, quickPickOptions);
                if (!sessProfileName) {
                    Gui.infoMessage(DatasetActions.localizedStrings.opCancelled);
                    return;
                }
            } else if (profileNamesList.length > 0) {
                sessProfileName = profileNamesList[0];
            } else {
                Gui.showMessage(vscode.l10n.t("No profiles available"));
                return;
            }
        }

        // Get the profile from the session name
        const sessProfile = profiles.loadNamedProfile(sessProfileName);

        await Profiles.getInstance().checkCurrentProfile(sessProfile);
        if (Profiles.getInstance().validProfile === Validation.ValidationType.INVALID) {
            Gui.errorMessage(DatasetActions.localizedStrings.profileInvalid);
            return;
        }

        const datasetUri = vscode.Uri.parse(
            hasMember
                ? `${ZoweScheme.DS}:/${sessProfileName}/${ds.dataSetName.toUpperCase()}/${ds.memberName.toUpperCase()}`
                : `${ZoweScheme.DS}:/${sessProfileName}/${ds.dataSetName.toUpperCase()}`
        );

        try {
            // If selected text is a PDS
            if (!hasMember) {
                const lookup = await DatasetFSProvider.instance.remoteLookupForResource(datasetUri);
                if (lookup && lookup instanceof PdsEntry) {
                    const datasetTree = SharedTreeProviders.ds as DatasetTree;
                    const successful = await datasetTree.focusOnDsInTree(ds.dataSetName, sessProfile);
                    if (!successful) {
                        Gui.warningMessage(vscode.l10n.t("PDS {0} could not be found.", ds.dataSetName));
                    }
                    return;
                }
            }

            await vscode.workspace.fs.readFile(datasetUri);
            await vscode.commands.executeCommand("vscode.open", datasetUri, {
                preview: false,
                viewColumn: vscode.window.activeTextEditor?.viewColumn,
            });
        } catch (error) {
            if (error instanceof vscode.FileSystemError) {
                const errorMessage = hasMember
                    ? vscode.l10n.t("Data set member {0} does not exist or cannot be opened in data set {1}.", ds.memberName, ds.dataSetName)
                    : vscode.l10n.t("Data set {0} does not exist or cannot be opened.", ds.dataSetName);
                Gui.warningMessage(errorMessage);
            } else {
                await AuthUtils.errorHandling(error, {
                    apiType: ZoweExplorerApiType.Mvs,
                    profile: sessProfile,
                    scenario: vscode.l10n.t("Opening data set failed."),
                });
            }
        }
    }

    /**
     * Shows a confirmation dialog (if needed) when submitting a job.
     *
     * @param nodeOrFileName The node/member that is being submitted, or the filename to submit
     * @param ownsJob Whether the current user profile owns this job
     * @returns Whether the job submission should continue.
     */
    public static async confirmJobSubmission(nodeOrFileName: IZoweDatasetTreeNode | string, ownsJob: boolean): Promise<boolean> {
        ZoweLogger.trace("dataset.actions.confirmJobSubmission called.");

        const jclName = typeof nodeOrFileName === "string" ? path.basename(nodeOrFileName) : nodeOrFileName.getLabel().toString();

        const showConfirmationDialog = async (): Promise<boolean> => {
            const selection = await Gui.warningMessage(
                vscode.l10n.t({
                    message: "Are you sure you want to submit the following job?\n\n{0}",
                    args: [jclName],
                    comment: ["JCL name"],
                }),
                {
                    items: [{ title: "Submit" }],
                    vsCodeOpts: { modal: true },
                }
            );
            return selection != null && selection?.title === "Submit";
        };

        const confirmationOption: string = vscode.workspace.getConfiguration().get("zowe.jobs.confirmSubmission");

        switch (Constants.JOB_SUBMIT_DIALOG_OPTS.indexOf(confirmationOption)) {
            case Definitions.JobSubmitDialogOpts.OtherUserJobs:
                if (!ownsJob && !(await showConfirmationDialog())) {
                    return false;
                }
                break;
            case Definitions.JobSubmitDialogOpts.YourJobs:
                if (ownsJob && !(await showConfirmationDialog())) {
                    return false;
                }
                break;
            case Definitions.JobSubmitDialogOpts.AllJobs:
                if (!(await showConfirmationDialog())) {
                    return false;
                }
                break;
            case Definitions.JobSubmitDialogOpts.Disabled:
            default:
                break;
        }
        return true;
    }

    /**
     * Submit the selected dataset member as a Job.
     *
     * @export
     * @param node The dataset member
     */
    public static async submitMember(node: IZoweDatasetTreeNode): Promise<void> {
        ZoweLogger.trace("dataset.actions.submitMember called.");
        let label: string;
        let sesName: string;
        let sessProfile: imperative.IProfileLoaded;
        const profiles = Profiles.getInstance();
        const nodeProfile = node.getProfile();
        await profiles.checkCurrentProfile(nodeProfile, node);

        const datasetName = SharedContext.isDsMember(node) ? node.getParent().getLabel().toString() : node.getLabel().toString();
        const ownsJob = datasetName.split(".")[0] === nodeProfile.profile?.user?.toUpperCase();

        if (!(await DatasetActions.confirmJobSubmission(node, ownsJob))) {
            return;
        }

        if (Profiles.getInstance().validProfile !== Validation.ValidationType.INVALID) {
            const defaultMessage = vscode.l10n.t("Cannot submit, item invalid.");
            switch (true) {
                // For favorited or non-favorited sequential DS:
                case SharedContext.isFavorite(node):
                case SharedContext.isSessionNotFav(node.getParent()):
                    sesName = node.getParent().getLabel() as string;
                    label = node.label as string;
                    sessProfile = node.getProfile();
                    break;
                // For favorited or non-favorited data set members:
                case SharedContext.isFavoritePds(node.getParent()):
                case SharedContext.isPdsNotFav(node.getParent()):
                    sesName = node.getParent().getParent().getLabel() as string;
                    label = node.getParent().getLabel().toString() + "(" + node.label.toString() + ")";
                    sessProfile = node.getProfile();
                    break;
                default:
                    Gui.errorMessage(defaultMessage);
                    throw Error(defaultMessage);
            }
            try {
                const job = await ZoweExplorerApiRegister.getJesApi(sessProfile).submitJob(label);
                const args = [sesName, job.jobid];
                const setJobCmd = `${Constants.SET_JOB_SPOOL_COMMAND}?${encodeURIComponent(JSON.stringify(args))}`;
                Gui.showMessage(
                    vscode.l10n.t({
                        message: "Job submitted {0}",
                        args: [`[${job.jobid}](${setJobCmd})`],
                        comment: ["Job ID and set job command"],
                    })
                );
                ZoweLogger.info(
                    vscode.l10n.t({
                        message: "Job submitted {0} using profile {1}.",
                        args: [job.jobid, sesName],
                        comment: ["Job ID", "Session name"],
                    })
                );
            } catch (error) {
                if (error instanceof Error) {
                    await AuthUtils.errorHandling(error, {
                        apiType: ZoweExplorerApiType.Mvs,
                        profile: sessProfile,
                        scenario: vscode.l10n.t("Job submission failed."),
                    });
                }
            }
        }
    }

    /**
     * Deletes a dataset/data set member
     *
     * @export
     * @param {IZoweDatasetTreeNode} node - The node to be deleted
     * @param {Types.IZoweDatasetTreeType} datasetProvider - the tree which contains the nodes
     */
    public static async deleteDataset(node: IZoweDatasetTreeNode, datasetProvider: Types.IZoweDatasetTreeType): Promise<void> {
        ZoweLogger.trace("dataset.actions.deleteDataset called.");
        let label = "";
        let fav = false;

        const parent = node.getParent();
        try {
            const parentContext = parent.contextValue;
            if (parentContext.includes(Constants.FAV_SUFFIX)) {
                label = node.getLabel() as string;
                fav = true;
                if (parentContext.includes(Constants.DS_PDS_CONTEXT + Constants.FAV_SUFFIX)) {
                    label = parent.getLabel().toString() + "(" + node.getLabel().toString() + ")";
                }
            } else if (parentContext.includes(Constants.DS_SESSION_CONTEXT)) {
                label = node.getLabel() as string;
            } else if (parentContext.includes(Constants.DS_PDS_CONTEXT)) {
                label = parent.getLabel().toString() + "(" + node.getLabel().toString() + ")";
            } else {
                throw Error(vscode.l10n.t("Cannot delete, item invalid."));
            }
            await datasetProvider.checkCurrentProfile(node);
            if (Profiles.getInstance().validProfile !== Validation.ValidationType.INVALID) {
                await vscode.workspace.fs.delete(node.resourceUri, { recursive: false });
            } else {
                return;
            }
        } catch (err) {
            if (err?.message.includes(vscode.l10n.t("not found"))) {
                ZoweLogger.error(
                    vscode.l10n.t({
                        message: "Error encountered when deleting data set. {0}",
                        args: [JSON.stringify(err)],
                        comment: ["Stringified JSON error"],
                    })
                );
                Gui.showMessage(
                    vscode.l10n.t({
                        message: "Unable to find file {0}",
                        args: [label],
                        comment: ["Label"],
                    })
                );
            } else {
                await AuthUtils.errorHandling(err, { apiType: ZoweExplorerApiType.Mvs, profile: node.getProfile() });
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
        } else {
            node.getSessionNode().dirty = true;
        }
        await datasetProvider.removeFavorite(node);

        const isMember = SharedContext.isDsMember(node);

        // If the node is a dataset member, go up a level in the node tree
        // to find the relevant, matching node
        const nodeOfInterest = isMember ? node.getParent() : node;
        const parentNode = datasetProvider.findEquivalentNode(nodeOfInterest, fav);

        if (parentNode != null) {
            // Refresh the correct node (parent of node to delete) to reflect changes
            datasetProvider.refreshElement(isMember ? parentNode : parentNode.getParent());
        }

        datasetProvider.refreshElement(node.getSessionNode());
    }

    /**
     * Refreshes the passed node with current mainframe data
     *
     * @param {IZoweDatasetTreeNode} node - The node which represents the dataset
     */
    // This is not a UI refresh.
    public static async refreshPS(node: IZoweDatasetTreeNode): Promise<void> {
        ZoweLogger.trace("dataset.actions.refreshPS called.");
        let label: string;
        try {
            switch (true) {
                // For favorited or non-favorited sequential DS:
                case SharedContext.isFavorite(node):
                case SharedContext.isSessionNotFav(node.getParent()):
                case SharedContext.isDs(node):
                    label = node.label as string;
                    break;
                // For favorited or non-favorited data set members:
                case SharedContext.isFavoritePds(node.getParent()):
                case SharedContext.isPdsNotFav(node.getParent()):
                    label = node.getParent().getLabel().toString() + "(" + node.getLabel().toString() + ")";
                    break;
                default:
                    throw Error(vscode.l10n.t("Item invalid."));
            }
            if (!(await FsAbstractUtils.confirmForUnsavedDoc(node.resourceUri))) {
                return;
            }

            ZoweLogger.info(`Refreshing data set ${label}`);
            const statusMsg = Gui.setStatusBarMessage(`$(sync~spin) ${vscode.l10n.t("Fetching data set...")}`);
            await DatasetFSProvider.instance.fetchDatasetAtUri(node.resourceUri, {
                editor: vscode.window.visibleTextEditors.find((v) => v.document.uri.path === node.resourceUri.path),
            });
            statusMsg.dispose();
        } catch (err) {
            if (err.message.includes(vscode.l10n.t("not found"))) {
                ZoweLogger.error(
                    vscode.l10n.t({
                        message: "Error encountered when refreshing data set view. {0}",
                        args: [JSON.stringify(err)],
                        comment: ["Stringified JSON error"],
                    })
                );
                Gui.showMessage(
                    vscode.l10n.t({
                        message: "Unable to find file {0}",
                        args: [label],
                        comment: ["Label"],
                    })
                );
            } else {
                await AuthUtils.errorHandling(err, { apiType: ZoweExplorerApiType.Mvs, profile: node.getProfile() });
            }
        }
    }

    /**
     * Refreshes the names of each member within a PDS
     *
     * @param {IZoweDatasetTreeNode} node - The node which represents the parent PDS of members
     * @param datasetProvider
     */
    public static async refreshDataset(node: IZoweDatasetTreeNode, datasetProvider: Types.IZoweDatasetTreeType): Promise<void> {
        ZoweLogger.trace("dataset.actions.refreshDataset called.");
        try {
            await node.getChildren();
            datasetProvider.refreshElement(node);
        } catch (err) {
            await AuthUtils.errorHandling(err, { apiType: ZoweExplorerApiType.Mvs, profile: node.getProfile() });
        }
    }

    /**
     * Copy data sets
     *
     * @export
     * @param {ZoweDatasetNode} node Node to copy,
     * @param {ZoweDatasetNode[]} nodeList - Multiple selected Nodes to copy
     * @param datasetProvider
     */
    public static async copyDataSets(node, nodeList: ZoweDatasetNode[], datasetProvider: Types.IZoweDatasetTreeType): Promise<void> {
        ZoweLogger.trace("dataset.actions.copyDataSets called.");
        let selectedNodes: ZoweDatasetNode[] = [];
        if (!(node || nodeList)) {
            selectedNodes = datasetProvider.getTreeView().selection as ZoweDatasetNode[];
        } else {
            selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList) as ZoweDatasetNode[];
        }

        const unique = [...new Set(selectedNodes.map((item) => item.contextValue))];
        if (unique.length > 1) {
            Gui.showMessage(vscode.l10n.t("Cannot perform the copy operation as the data sets selected have different types"));
            return;
        }
        const filePaths = [];
        for (const el of selectedNodes) {
            const element = await DatasetUtils.getNodeLabels(el);
            filePaths.push(element);
        }
        return vscode.env.clipboard.writeText(JSON.stringify(filePaths.length > 1 ? filePaths : filePaths[0]));
    }

    /**
     * Migrate data sets
     *
     * @export
     * @param {IZoweDatasetTreeNode} node - The node to migrate
     */
    public static async hMigrateDataSet(datasetProvider: Types.IZoweDatasetTreeType, node: ZoweDatasetNode): Promise<zosfiles.IZosFilesResponse> {
        ZoweLogger.trace("dataset.actions.hMigrateDataSet called.");
        await Profiles.getInstance().checkCurrentProfile(node.getProfile(), node);
        if (Profiles.getInstance().validProfile !== Validation.ValidationType.INVALID) {
            const nodelabels = await DatasetUtils.getNodeLabels(node);
            const dataSetName = nodelabels[0].dataSetName;
            try {
                Gui.showMessage(
                    vscode.l10n.t({
                        message: "Migration of data set {0} requested.",
                        args: [dataSetName],
                        comment: ["Data Set name"],
                    })
                );
                const response = await ZoweExplorerApiRegister.getMvsApi(node.getProfile()).hMigrateDataSet(dataSetName);
                datasetProvider.refreshElement(node.getParent());
                return response;
            } catch (err) {
                ZoweLogger.error(err);
                Gui.errorMessage(err.message);
                return;
            }
        } else {
            Gui.errorMessage(DatasetActions.localizedStrings.profileInvalid);
        }
    }

    /**
     * Recall data sets
     *
     * @export
     * @param {IZoweDatasetTreeNode} node - The node to recall
     */
    public static async hRecallDataSet(datasetProvider: Types.IZoweDatasetTreeType, node: ZoweDatasetNode): Promise<zosfiles.IZosFilesResponse> {
        ZoweLogger.trace("dataset.actions.hRecallDataSet called.");
        await Profiles.getInstance().checkCurrentProfile(node.getProfile(), node);
        if (Profiles.getInstance().validProfile !== Validation.ValidationType.INVALID) {
            const nodelabels = await DatasetUtils.getNodeLabels(node);
            const dataSetName = nodelabels[0].dataSetName;
            try {
                Gui.showMessage(
                    vscode.l10n.t({
                        message: "Recall of data set {0} requested.",
                        args: [dataSetName],
                        comment: ["Data Set name"],
                    })
                );
                const response = await ZoweExplorerApiRegister.getMvsApi(node.getProfile()).hRecallDataSet(dataSetName);
                datasetProvider.refreshElement(node.getParent());
                return response;
            } catch (err) {
                ZoweLogger.error(err);
                Gui.errorMessage(err.message);
                return;
            }
        } else {
            Gui.errorMessage(DatasetActions.localizedStrings.profileInvalid);
        }
    }

    /**
     * Show File Error details when gathering attributes for these data sets
     *
     * @export
     * @param {IZoweDatasetTreeNode} node - The node to get details from
     */
    public static async showFileErrorDetails(node: ZoweDatasetNode): Promise<void> {
        ZoweLogger.trace("dataset.actions.showFileErrorDetails called.");
        await Profiles.getInstance().checkCurrentProfile(node.getProfile(), node);
        if (Profiles.getInstance().validProfile === Validation.ValidationType.INVALID) {
            Gui.errorMessage(DatasetActions.localizedStrings.profileInvalid);
        } else {
            const nodelabels = await DatasetUtils.getNodeLabels(node);
            const dataSetName = nodelabels[0].dataSetName;
            if (node.errorDetails) {
                ZoweLogger.error(JSON.stringify(node.errorDetails, null, 2));
                Gui.errorMessage(node.errorDetails.message);
            } else {
                try {
                    await ZoweExplorerApiRegister.getMvsApi(node.getProfile()).hRecallDataSet(dataSetName);
                    Gui.errorMessage(vscode.l10n.t("Unable to gather more information"));
                } catch (err) {
                    ZoweLogger.error(JSON.stringify(err, null, 2));
                    Gui.errorMessage(err.message);
                }
            }
        }
    }

    /**
     * Paste Datasets
     *
     * @export
     * @param datasetProvider - the tree which contains the nodes
     * @param node - the node to which content is pasted
     */
    public static async pasteDataSet(datasetProvider: Types.IZoweDatasetTreeType, node: ZoweDatasetNode): Promise<void> {
        ZoweLogger.trace("dataset.actions.pasteDataSet called.");
        let clipboardContent;
        try {
            clipboardContent = JSON.parse(await vscode.env.clipboard.readText());
        } catch (err) {
            Gui.errorMessage(vscode.l10n.t("Invalid paste. Copy data set(s) first."));
            return;
        }
        clipboardContent = clipboardContent.flat();
        if (SharedContext.isPds(clipboardContent[0].contextValue)) {
            await DatasetActions.copyPartitionedDatasets(clipboardContent, node);
        } else if (SharedContext.isDsMember(clipboardContent[0].contextValue)) {
            await DatasetActions.copyDatasetMembers(clipboardContent, node);
        } else if (SharedContext.isDs(clipboardContent[0].contextValue)) {
            await DatasetActions.copySequentialDatasets(clipboardContent, node);
        }
        datasetProvider.refreshElement(node);
        vscode.env.clipboard.writeText("");
        return;
    }

    /**
     * copies given sequential dataset nodes
     *
     * @export
     * @param {ZoweDatasetNode} node - The node to which content is pasted
     * @param clipboardContent - Copied clipboard content
     */
    public static async copySequentialDatasets(clipboardContent, node: ZoweDatasetNode): Promise<void> {
        ZoweLogger.trace("dataset.actions.copySequentialDatasets called.");
        const mvsApi = ZoweExplorerApiRegister.getMvsApi(node.getProfile());
        const copiedcontent = clipboardContent.flat() as ClipboardItem[];
        const groupedByProfile = DatasetActions.groupClipboardItemsByProfile(copiedcontent);

        const sameProfileItems = groupedByProfile.get(node.getProfile().name);
        if (sameProfileItems?.length) {
            await DatasetActions.copyProcessor(sameProfileItems, "ps", async (content, dsname: string, replace: Definitions.ShouldReplace) => {
                const lbl = content.dataSetName;
                if (mvsApi?.copyDataSet == null) {
                    await Gui.errorMessage(vscode.l10n.t("Copying data sets is not supported."));
                } else {
                    await Gui.withProgress(
                        {
                            location: vscode.ProgressLocation.Notification,
                            title: DatasetActions.localizedStrings.copyingMembers,
                            cancellable: true,
                        },
                        async () => {
                            try {
                                return await mvsApi.copyDataSet(lbl, dsname, null, replace === "replace");
                            } catch (error) {
                                Gui.errorMessage(error.message);
                                return;
                            }
                        }
                    );
                }
            });
            groupedByProfile.delete(node.getProfile().name);
        }

        const crossProfileGroups: Array<{ profile: imperative.IProfileLoaded; items: ClipboardItem[] }> = [];
        for (const [profileName, items] of groupedByProfile) {
            const profile = DatasetActions.getProfileByName(profileName);
            if (profile) {
                crossProfileGroups.push({ profile, items });
            }
        }

        if (crossProfileGroups.length === 0) {
            return;
        }

        await Gui.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: DatasetActions.localizedStrings.copyingMembers,
                cancellable: true,
            },
            async (_progress, token) => {
                for (const group of crossProfileGroups) {
                    for (const content of group.items) {
                        const lbl = content.dataSetName;
                        const inputBoxOptions: vscode.InputBoxOptions = {
                            prompt: vscode.l10n.t("Enter a name for the new data set"),
                            value: lbl,
                            placeHolder: vscode.l10n.t("Name of Data Set"),
                        };
                        const dsname = await Gui.showInputBox(inputBoxOptions);
                        if (!dsname) {
                            return;
                        }
                        const replace = await DatasetActions.determineReplacement(node.getProfile(), dsname, "ps");
                        if (replace === "cancel") {
                            continue;
                        }

                        if (token.isCancellationRequested) {
                            Gui.showMessage(DatasetActions.localizedStrings.opCancelled);
                            return;
                        }
                        try {
                            if (mvsApi?.copyDataSetCrossLpar != null) {
                                const options: zosfiles.ICrossLparCopyDatasetOptions = {
                                    "from-dataset": { dsn: content.dataSetName, member: undefined },
                                    responseTimeout: node.getProfile()?.profile?.responseTimeout,
                                    replace: replace === "replace",
                                };
                                await mvsApi.copyDataSetCrossLpar(dsname, undefined, options, group.profile);
                            } else {
                                await DatasetActions.copySequentialDatasetViaFsFallback({
                                    destinationProfile: node.getProfile(),
                                    destinationDataSet: dsname,
                                    replace,
                                    sourceDataSet: content.dataSetName,
                                    sourceProfile: group.profile,
                                });
                            }
                        } catch (err) {
                            ZoweLogger.error(err);
                            if (err instanceof Error) {
                                Gui.errorMessage(err.message);
                            }
                        }
                    }
                }
            }
        );
    }

    /**
     * copies given dataset members
     *
     * @export
     * @param {ZoweDatasetNode} node - The node to which content is pasted
     * @param clipboardContent - Copied clipboard content
     */

    public static async copyDatasetMembers(clipboardContent, node: ZoweDatasetNode): Promise<void> {
        ZoweLogger.trace("dataset.actions.copyDatasetMembers called.");
        const mvsApi = ZoweExplorerApiRegister.getMvsApi(node.getProfile());
        const memberClipboard = clipboardContent as ClipboardItem[];
        const groupedByProfile = DatasetActions.groupClipboardItemsByProfile(memberClipboard);
        await Gui.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: DatasetActions.localizedStrings.copyingMembers,
                cancellable: true,
            },
            async (_progress, token) => {
                for (const [profileName, items] of groupedByProfile) {
                    const sourceProfile = DatasetActions.getProfileByName(profileName);
                    if (!sourceProfile) {
                        continue;
                    }
                    for (const content of items) {
                        if (!content.memberName) {
                            continue;
                        }
                        const inputBoxOptions: vscode.InputBoxOptions = {
                            value: content.memberName,
                            placeHolder: vscode.l10n.t("Name of data set member"),
                            validateInput: (text) => {
                                return DatasetUtils.validateMemberName(text) === true ? null : vscode.l10n.t("Enter valid member name");
                            },
                        };
                        const memberName = await Gui.showInputBox(inputBoxOptions);
                        if (!memberName) {
                            return;
                        }
                        const replace = await DatasetActions.determineReplacement(
                            node.getProfile(),
                            `${node.getLabel() as string}(${memberName})`,
                            "mem"
                        );
                        if (replace === "cancel") {
                            continue;
                        }
                        try {
                            if (token.isCancellationRequested) {
                                Gui.showMessage(DatasetActions.localizedStrings.opCancelled);
                                return;
                            }
                            if (node.getProfile().name === profileName) {
                                await ZoweExplorerApiRegister.getMvsApi(node.getProfile()).copyDataSetMember(
                                    { dsn: content.dataSetName, member: content.memberName },
                                    { dsn: node.getLabel().toString(), member: memberName },
                                    { replace: replace === "replace" }
                                );
                            } else if (mvsApi?.copyDataSetCrossLpar != null) {
                                const options: zosfiles.ICrossLparCopyDatasetOptions = {
                                    "from-dataset": { dsn: content.dataSetName, member: content.memberName },
                                    responseTimeout: node.getProfile()?.profile?.responseTimeout,
                                    replace: replace === "replace",
                                };
                                await mvsApi.copyDataSetCrossLpar(node.getLabel() as string, memberName, options, sourceProfile);
                            } else {
                                const sourceUri = vscode.Uri.from({
                                    scheme: ZoweScheme.DS,
                                    path: path.posix.join("/", sourceProfile.name, content.dataSetName, content.memberName),
                                });

                                const destUri = vscode.Uri.from({
                                    scheme: ZoweScheme.DS,
                                    path: path.posix.join("/", node.getProfile().name, node.getLabel().toString(), memberName),
                                });

                                const contents = await DatasetFSProvider.instance.readFile(sourceUri);

                                if (replace === "notFound") {
                                    await ZoweExplorerApiRegister.getMvsApi(node.getProfile()).createDataSetMember(
                                        `${node.getLabel().toString()}(${memberName})`,
                                        {
                                            responseTimeout: node.getProfile()?.profile?.responseTimeout,
                                        }
                                    );
                                }

                                await DatasetFSProvider.instance.writeFile(destUri.with({ query: "forceUpload=true" }), contents, {
                                    create: true,
                                    overwrite: true,
                                });
                            }
                        } catch (err) {
                            if (err instanceof Error) {
                                Gui.errorMessage(err.message);
                            }
                            return;
                        }
                    }
                }
            }
        );
    }

    /**
     * copies given partitioned dataset nodes
     *
     * @export
     * @param {ZoweDatasetNode} node - The node to which content is pasted
     * @param clipboardContent - Copied clipboard content
     */
    public static async copyPartitionedDatasets(clipboardContent, node: ZoweDatasetNode): Promise<void> {
        ZoweLogger.trace("dataset.actions.copyPartitionedDatasets called.");

        const clipboardItems = clipboardContent as ClipboardItem[];
        const groupedContent = clipboardItems.reduce((result, current) => {
            const { dataSetName, memberName, profileName, ...rest } = current;
            let group = result.find((item: any) => item.dataSetName === dataSetName && item.profileName === profileName);
            if (!group) {
                group = { ...rest, dataSetName, profileName, members: [] };
                result.push(group);
            }

            if (memberName && memberName !== vscode.l10n.t("No data sets found")) {
                group.members.push(memberName);
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return result;
        }, []);
        const mvsApi = ZoweExplorerApiRegister.getMvsApi(node.getProfile());
        const sameProfileGroups = groupedContent.filter((group: any) => group.profileName === node.getProfile().name);
        if (sameProfileGroups.length > 0) {
            await DatasetActions.copyProcessor(sameProfileGroups, "po", async (content: any, dsname: string, replace: Definitions.ShouldReplace) => {
                const lbl = content.dataSetName;

                const uploadOptions: zosfiles.IUploadOptions = {
                    etag: node.getEtag(),
                    returnEtag: true,
                };

                const prof = node.getProfile();
                if (prof.profile.encoding) {
                    uploadOptions.encoding = prof.profile.encoding;
                }
                await Gui.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: DatasetActions.localizedStrings.copyingMembers,
                        cancellable: true,
                    },
                    () => {
                        return Promise.all(
                            content.members.map((child) =>
                                ZoweExplorerApiRegister.getMvsApi(node.getProfile()).copyDataSetMember(
                                    { dsn: lbl, member: child },
                                    { dsn: dsname, member: child },
                                    { replace: replace === "replace" }
                                )
                            )
                        );
                    }
                );
            });
        }

        const crossProfileGroups = groupedContent.filter((group: any) => group.profileName !== node.getProfile().name);
        if (crossProfileGroups.length === 0) {
            return;
        }

        await Gui.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: DatasetActions.localizedStrings.copyingMembers,
                cancellable: true,
            },
            async (_progress, token) => {
                for (const content of crossProfileGroups) {
                    const lbl = content.dataSetName;
                    const sourceProfile = DatasetActions.getProfileByName(content.profileName);
                    if (!sourceProfile) {
                        continue;
                    }
                    const inputBoxOptions: vscode.InputBoxOptions = {
                        prompt: vscode.l10n.t("Enter a name for the new data set"),
                        value: lbl,
                        placeHolder: vscode.l10n.t("Name of Data Set"),
                    };
                    const dsname = await Gui.showInputBox(inputBoxOptions);
                    if (!dsname) {
                        return;
                    }
                    const replace = await DatasetActions.determineReplacement(node.getProfile(), dsname, "po");
                    if (replace === "cancel") {
                        continue;
                    }
                    if (token.isCancellationRequested) {
                        Gui.showMessage(DatasetActions.localizedStrings.opCancelled);
                        return;
                    }

                    if (mvsApi?.copyDataSetCrossLpar != null) {
                        const options: zosfiles.ICrossLparCopyDatasetOptions = {
                            "from-dataset": { dsn: lbl },
                            responseTimeout: node.getProfile()?.profile?.responseTimeout,
                            replace: replace === "replace",
                        };
                        try {
                            await mvsApi.copyDataSetCrossLpar(dsname, undefined, options, sourceProfile);
                        } catch (err) {
                            ZoweLogger.error(err);
                            if (err instanceof Error) {
                                Gui.errorMessage(err.message);
                            }
                            return;
                        }
                    } else {
                        const destPdsUri = vscode.Uri.from({
                            scheme: ZoweScheme.DS,
                            path: path.posix.join("/", node.getProfile().name, dsname),
                        });
                        const destExistsLocally = DatasetFSProvider.instance.exists(destPdsUri);
                        if (replace === "notFound") {
                            try {
                                await DatasetActions.createDataSetFromSourceAttributes(sourceProfile, node.getProfile(), lbl, dsname);
                            } catch (err) {
                                if (err instanceof Error) {
                                    Gui.errorMessage(
                                        vscode.l10n.t({
                                            message: "Failed to create {0}: {1}",
                                            args: [dsname, err.message],
                                            comment: ["Data set name", "Error message"],
                                        })
                                    );
                                }
                                return;
                            }
                        }
                        if (!destExistsLocally) {
                            DatasetFSProvider.instance.createDirectory(destPdsUri);
                        }

                        for (const child of content.members) {
                            if (token.isCancellationRequested) {
                                Gui.showMessage(DatasetActions.localizedStrings.opCancelled);
                                return;
                            }

                            try {
                                const sourceMemberUri = vscode.Uri.from({
                                    scheme: ZoweScheme.DS,
                                    path: path.posix.join("/", sourceProfile.name, lbl, child),
                                });

                                const destMemberUri = vscode.Uri.from({
                                    scheme: ZoweScheme.DS,
                                    path: path.posix.join("/", node.getProfile().name, dsname, child),
                                });

                                const contents = await DatasetFSProvider.instance.readFile(sourceMemberUri);

                                try {
                                    const entry = await DatasetFSProvider.instance.fetchDatasetAtUri(destMemberUri);
                                    if (entry == null) {
                                        await ZoweExplorerApiRegister.getMvsApi(node.getProfile()).createDataSetMember(`${dsname}(${child})`, {
                                            responseTimeout: node.getProfile()?.profile?.responseTimeout,
                                        });
                                    }
                                } catch (err) {
                                    ZoweLogger.error(err);
                                    Gui.errorMessage(
                                        vscode.l10n.t({
                                            message: "Failed to copy member {0}: {1}",
                                            args: [child, err.message],
                                            comment: ["Member name", "Error message"],
                                        })
                                    );
                                    // TODO: This should break in the event of an auth error.
                                    // Send notification w/ retry option and show auth prompt? Or show auth prompt and retry if successful/fail otherwise?
                                }

                                await DatasetFSProvider.instance.writeFile(destMemberUri.with({ query: "forceUpload=true" }), contents, {
                                    create: true,
                                    overwrite: true,
                                });
                            } catch (err) {
                                ZoweLogger.error(err);
                                if (err instanceof Error) {
                                    Gui.errorMessage(
                                        vscode.l10n.t({
                                            message: "Failed to copy member {0}: {1}",
                                            args: [child, err.message],
                                            comment: ["Member name", "Error message"],
                                        })
                                    );
                                }
                            }
                        }
                    }
                }
            }
        );
    }

    /**
     * Helper function to determine whether or not we should replace some z/os content
     *
     * @param nodeProfile The node for which we are going to determine replacement
     * @param name The fully quallified name of the dataset (member included)
     * @param type The type of z/os dataset (or member) that we should determine whether or not to replace
     * @returns string that explain whether or not to replace the z/os content
     */
    public static async determineReplacement(
        nodeProfile: imperative.IProfileLoaded,
        name: string,
        type: Definitions.ReplaceDSType
    ): Promise<Definitions.ShouldReplace> {
        ZoweLogger.trace("dataset.actions.determineReplacement called.");
        const mvsApi = ZoweExplorerApiRegister.getMvsApi(nodeProfile);
        const options = { responseTimeout: nodeProfile.profile?.responseTimeout };
        const stringReplace = vscode.l10n.t("Replace");
        const stringCancel = vscode.l10n.t("Cancel");
        let q: string = null;
        let replace = false;
        if (type === "mem") {
            const dsname = name.split("(")[0];
            const member = name.split("(")[1].slice(0, -1);
            const res = await mvsApi.allMembers(dsname, options);
            if (res?.success && res.apiResponse?.items.some((m) => m.member == member.toUpperCase())) {
                q = vscode.l10n.t("The data set member already exists.\nDo you want to replace it?");
                replace = stringReplace === (await Gui.showMessage(q, { items: [stringReplace, stringCancel] }));
            }
        } else {
            const res = await mvsApi.dataSet(name, options);
            if (res?.success && res.apiResponse?.items.length > 0) {
                if (type === "ps") {
                    q = vscode.l10n.t("The physical sequential (PS) data set already exists.\nDo you want to replace it?");
                } else if (type === "po") {
                    q = vscode.l10n.t(
                        "The partitioned (PO) data set already exists.\nDo you want to merge them while replacing any existing members?"
                    );
                }
                replace = stringReplace === (await Gui.showMessage(q, { items: [stringReplace, stringCancel] }));
            }
        }
        // Sonar cloud code-smell :'(
        const returnValueIfNotReplacing = q === null ? "notFound" : "cancel";
        return replace ? "replace" : returnValueIfNotReplacing;
    }

    /**
     * Helper funciton to process the copy operation on all selected nodes
     *
     * @param nodes List of selected nodes to process
     * @param type Type of replacement that should occur
     * @param action Function that will perform the actual replacement/copy operation
     * @returns void - Please don't expect a return value from this method
     */
    public static async copyProcessor(
        nodes: any[],
        type: Definitions.ReplaceDSType,
        action: (_node: any, _dsname: string, _shouldReplace: Definitions.ShouldReplace) => Promise<void>
    ): Promise<void> {
        ZoweLogger.trace("dataset.actions._copyProcessor called.");
        for (const node of nodes) {
            try {
                const lbl = node.dataSetName;
                const inputBoxOptions: vscode.InputBoxOptions = {
                    prompt: vscode.l10n.t("Enter a name for the new data set"),
                    value: lbl,
                    placeHolder: vscode.l10n.t("Name of Data Set"),
                    validateInput: (text) => {
                        return DatasetUtils.validateDataSetName(text) && (lbl !== text) === true
                            ? null
                            : vscode.l10n.t("Enter a valid data set name.");
                    },
                };
                const dsname = await Gui.showInputBox(inputBoxOptions);
                if (!dsname) {
                    return;
                }
                const profileName = node.profileName ?? nodes[0]?.profileName;
                const profile = DatasetActions.getProfileByName(profileName);
                if (profile == null) {
                    continue;
                }
                const replace = await DatasetActions.determineReplacement(profile, dsname, type);
                let res: zosfiles.IZosFilesResponse;
                if (replace === "notFound") {
                    res = await ZoweExplorerApiRegister.getMvsApi(profile).allocateLikeDataSet(dsname, lbl);
                }
                if (res?.success || replace !== "cancel") {
                    await action(node, dsname, replace);
                }
            } catch (error) {
                if (error instanceof Error) {
                    const nodelabels = await DatasetUtils.getNodeLabels(node);
                    await AuthUtils.errorHandling(error, {
                        apiType: ZoweExplorerApiType.Mvs,
                        dsName: nodelabels[0].dataSetName,
                        scenario: vscode.l10n.t("Unable to copy data set."),
                    });
                }
            }
        }
    }

    public static async copyName(node: IZoweDatasetTreeNode): Promise<void> {
        if (SharedContext.isDsMember(node) && node.getParent()) {
            await vscode.env.clipboard.writeText(`${node.getParent().label as string}(${node.label as string})`);
        } else if (SharedContext.isDs(node) || SharedContext.isPds(node) || SharedContext.isMigrated(node) || SharedContext.isVsam(node)) {
            await vscode.env.clipboard.writeText(node.label as string);
        }
    }

    private static readonly missingProfileWarnings: Set<string> = new Set();

    private static groupClipboardItemsByProfile(items: ClipboardItem[]): Map<string, ClipboardItem[]> {
        const grouped = new Map<string, ClipboardItem[]>();
        for (const item of items) {
            const profileName = item.profileName ?? "";
            if (!grouped.has(profileName)) {
                grouped.set(profileName, []);
            }
            grouped.get(profileName).push(item);
        }
        return grouped;
    }

    private static getProfileByName(profileName: string): imperative.IProfileLoaded | undefined {
        if (!profileName) {
            return undefined;
        }
        const profile = Profiles.getInstance().allProfiles.find((prof) => prof.name === profileName);
        if (!profile && !DatasetActions.missingProfileWarnings.has(profileName)) {
            DatasetActions.missingProfileWarnings.add(profileName);
            Gui.errorMessage(vscode.l10n.t("Profile {0} is no longer available. Skipping item.", profileName));
        }
        return profile;
    }

    private static buildDatasetUri(profileName: string, dataSetName: string): vscode.Uri {
        const extension = DatasetUtils.getExtension(dataSetName);
        const basePath = path.posix.join("/", profileName, dataSetName);
        return vscode.Uri.from({
            scheme: ZoweScheme.DS,
            path: extension ? `${basePath}${extension}` : basePath,
        });
    }

    private static normalizePrimaryForCylinders(attributes: Record<string, unknown>): void {
        const alcunit = attributes.alcunit as string;
        if (!alcunit || typeof alcunit !== "string" || alcunit.toUpperCase() !== "CYL") {
            return;
        }
        const TRACKS_PER_CYLINDER = 15;
        const primary = Number(attributes.primary);
        if (!isNaN(primary) && primary > 0) {
            attributes.primary = Math.ceil(primary / TRACKS_PER_CYLINDER);
        }
    }

    private static async createDataSetFromSourceAttributes(
        sourceProfile: imperative.IProfileLoaded,
        destinationProfile: imperative.IProfileLoaded,
        sourceDataSet: string,
        destinationDataSet: string
    ): Promise<void> {
        const sourceAttributesResponse = await ZoweExplorerApiRegister.getMvsApi(sourceProfile).dataSet(sourceDataSet, {
            attributes: true,
            responseTimeout: sourceProfile?.profile?.responseTimeout,
        });
        const sourceItem = sourceAttributesResponse.apiResponse?.items?.[0];
        if (!sourceItem) {
            throw new Error(vscode.l10n.t("Unable to retrieve attributes for {0}", sourceDataSet));
        }
        const { dsname: _omit, ...rest } = sourceItem;
        const transformedAttrs = (zosfiles.Copy as any).generateDatasetOptions({}, rest);
        DatasetActions.normalizePrimaryForCylinders(transformedAttrs);
        if (transformedAttrs.dsorg === "PO-E") {
            transformedAttrs.dsorg = "PO";
            transformedAttrs.dsntype = "LIBRARY";
        }
        await ZoweExplorerApiRegister.getMvsApi(destinationProfile).createDataSet(
            zosfiles.CreateDataSetTypeEnum.DATA_SET_BLANK,
            destinationDataSet,
            transformedAttrs
        );
    }

    private static async copySequentialDatasetViaFsFallback(params: {
        sourceProfile: imperative.IProfileLoaded;
        destinationProfile: imperative.IProfileLoaded;
        sourceDataSet: string;
        destinationDataSet: string;
        replace: Definitions.ShouldReplace;
    }): Promise<void> {
        const sourceUri = DatasetActions.buildDatasetUri(params.sourceProfile.name, params.sourceDataSet);
        const destUri = DatasetActions.buildDatasetUri(params.destinationProfile.name, params.destinationDataSet);
        if (params.replace === "notFound") {
            await DatasetActions.createDataSetFromSourceAttributes(
                params.sourceProfile,
                params.destinationProfile,
                params.sourceDataSet,
                params.destinationDataSet
            );
        }
        const contents = await DatasetFSProvider.instance.readFile(sourceUri);
        await DatasetFSProvider.instance.writeFile(destUri.with({ query: "forceUpload=true" }), contents, { create: true, overwrite: true });
    }
}
