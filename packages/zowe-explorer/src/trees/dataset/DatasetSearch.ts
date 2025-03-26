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
import { Gui, imperative, IZoweDatasetTreeNode, Table, TableBuilder, TableViewProvider, ZoweScheme } from "@zowe/zowe-explorer-api";
import { SharedContext } from "../shared/SharedContext";
import { ZoweLocalStorage } from "../../tools/ZoweLocalStorage";
import { Definitions } from "../../configuration/Definitions";
import { Constants } from "../../configuration/Constants";
import { DatasetFSProvider } from "./DatasetFSProvider";
import { ZoweExplorerApiRegister } from "../../extending/ZoweExplorerApiRegister";
import { DatasetActions } from "./DatasetActions";
import { AuthUtils } from "../../utils/AuthUtils";
import { ZoweLogger } from "../../tools/ZoweLogger";
import { DatasetUtils } from "./DatasetUtils";

interface ISearchOptions {
    node: IZoweDatasetTreeNode;
    pattern: string;
    searchString: string;
    caseSensitive: boolean;
    regex: boolean;
}

export class DatasetSearch {
    // Commonly shared properties
    private static savedSearchOptions: Definitions.DataSetSearchOptions;
    private static searchQuickPick: vscode.QuickPick<vscode.QuickPickItem>;
    private static searchOptionsQuickPick: vscode.QuickPick<vscode.QuickPickItem>;
    private static optionsQuickPickEntry: vscode.QuickPickItem;

    public static async search(this: void, context: vscode.ExtensionContext, node: IZoweDatasetTreeNode): Promise<void> {
        const isSessionNotFav = SharedContext.isSessionNotFav(node);
        const generateFullUri = (isSessionNotFav && node.pattern != null) || SharedContext.isFavoriteSearch(node);
        const pattern = isSessionNotFav ? node.pattern : (node.label as string);

        // There may not be a pattern on a session node if there is no filter applied. Warn if this is the case.
        if (!pattern) {
            Gui.errorMessage(vscode.l10n.t("No search pattern applied. Search for a pattern and try again."));
            return;
        }

        // Figure out what text we are looking for.
        ZoweLocalStorage.setValue(Definitions.LocalStorageKey.DS_SEARCH_OPTIONS, undefined); // Remove me
        DatasetSearch.savedSearchOptions =
            ZoweLocalStorage.getValue<Definitions.DataSetSearchOptions>(Definitions.LocalStorageKey.DS_SEARCH_OPTIONS) ?? {};

        // Set defaults if they are not present on the object in case we add options in the future
        DatasetSearch.savedSearchOptions.caseSensitive ??= false;
        DatasetSearch.savedSearchOptions.history ??= [];
        DatasetSearch.savedSearchOptions.regex ??= false;

        DatasetSearch.constructQuickPicks();
        DatasetSearch.searchQuickPickReset();
        DatasetSearch.searchQuickPick.show();

        // Show the search quick pick
        const searchString = await new Promise<string | undefined>((resolve) => {
            let accepted = false;
            // Return input string or value selected from history
            DatasetSearch.searchQuickPick.onDidAccept(() => {
                accepted = true;
                DatasetSearch.searchQuickPick.hide();
                if (DatasetSearch.searchQuickPick.selectedItems[0].label === DatasetSearch.optionsQuickPickEntry.label) {
                    DatasetSearch.searchOptionsPrompt();
                } else {
                    resolve(DatasetSearch.searchQuickPick.selectedItems[0].label);
                }
            });
            DatasetSearch.searchQuickPick.onDidHide(() => {
                if (!accepted) {
                    resolve(undefined);
                } else {
                    accepted = false;
                }
            });
        });

        // Dispose of our quick picks
        DatasetSearch.searchQuickPick.dispose();
        DatasetSearch.searchOptionsQuickPick.dispose();

        if (!searchString) {
            return;
        }

        // Update history
        DatasetSearch.savedSearchOptions.history = DatasetSearch.savedSearchOptions.history.filter((item) => item !== searchString);
        DatasetSearch.savedSearchOptions.history.unshift(searchString);

        // Update saved search options
        await ZoweLocalStorage.setValue<Definitions.DataSetSearchOptions>(
            Definitions.LocalStorageKey.DS_SEARCH_OPTIONS,
            DatasetSearch.savedSearchOptions
        );

        // Perform the actual search.
        const response: zosfiles.IZosFilesResponse = await Gui.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: vscode.l10n.t({ message: 'Searching for "{0}"', args: [searchString], comment: "The string to search data sets for." }),
                cancellable: true,
            },
            async (progress, token) => {
                return DatasetSearch.performSearch(progress, token, {
                    node,
                    pattern,
                    searchString,
                    caseSensitive: DatasetSearch.savedSearchOptions.caseSensitive,
                    regex: DatasetSearch.savedSearchOptions.regex,
                });
            }
        );

        // Either the user cancelled the search, or a catastrophic error occurred and error handling has already been done.
        if (response === undefined) {
            return;
        }

        // Prepare a list of matches in a format the table expects
        const matches = DatasetSearch.getSearchMatches(node, response, generateFullUri, searchString);

        // Prepare the table for display to the user
        const table = new TableBuilder(context)
            .title(vscode.l10n.t({ message: 'Search Results for "{0}"', args: [searchString], comment: "The string to search data sets for." }))
            .options({
                autoSizeStrategy: { type: "fitCellContents" },
                pagination: true,
                rowSelection: "multiple",
                selectEverything: true,
                suppressRowClickSelection: true,
            })
            .isView()
            .rows(...matches)
            .columns(
                ...[
                    {
                        field: "name",
                        headerName: vscode.l10n.t("Data Set Name"),
                        filter: true,
                        initialSort: "asc",
                    } as Table.ColumnOpts,
                    {
                        field: "position",
                        headerName: vscode.l10n.t("Position"),
                        filter: false,
                    },
                    {
                        field: "contents",
                        headerName: vscode.l10n.t("Contents"),
                        filter: true,
                    },
                    {
                        field: "actions",
                        hide: true,
                    },
                ]
            )
            .addRowAction("all", {
                title: vscode.l10n.t("Open"),
                command: "open",
                callback: {
                    fn: DatasetSearch.openSearchAtLocation,
                    typ: "multi-row",
                },
                type: "secondary",
            })
            .build();

        // Show the table to the user.
        await TableViewProvider.getInstance().setTableView(table);
    }

    // A helper function to construct our quick picks
    private static constructQuickPicks(): void {
        // Construct the quick pick
        DatasetSearch.searchQuickPick = Gui.createQuickPick();
        DatasetSearch.optionsQuickPickEntry = { label: "", alwaysShow: true };
        const userInputEntry: vscode.QuickPickItem = { label: "" };
        const historyEntries: vscode.QuickPickItem[] = DatasetSearch.savedSearchOptions.history.map((entry) => ({ label: entry }));

        // Set up the search quick pick
        DatasetSearch.searchQuickPick.items = [...historyEntries, Constants.SEPARATORS.BLANK, DatasetSearch.optionsQuickPickEntry];
        DatasetSearch.searchQuickPick.title = vscode.l10n.t("Enter the text to search for.");
        DatasetSearch.searchQuickPick.ignoreFocusOut = true;
        DatasetSearch.searchQuickPick.onDidChangeValue((value: string) => {
            userInputEntry.label = value;
            if (value) {
                DatasetSearch.searchQuickPick.items = [
                    userInputEntry,
                    ...historyEntries,
                    Constants.SEPARATORS.BLANK,
                    DatasetSearch.optionsQuickPickEntry,
                ];
            } else {
                DatasetSearch.searchQuickPick.items = [...historyEntries, Constants.SEPARATORS.BLANK, DatasetSearch.optionsQuickPickEntry];
            }
        });

        // Set up the options quick pick
        DatasetSearch.searchOptionsQuickPick = Gui.createQuickPick();
        DatasetSearch.searchOptionsQuickPick.title = vscode.l10n.t("Search Options");
        DatasetSearch.searchOptionsQuickPick.placeholder = vscode.l10n.t("Select search options");
        DatasetSearch.searchOptionsQuickPick.ignoreFocusOut = true;
        DatasetSearch.searchOptionsQuickPick.canSelectMany = true;

        DatasetSearch.searchOptionsQuickPick.onDidAccept(() => {
            // Set and save the options
            DatasetSearch.savedSearchOptions.caseSensitive = DatasetSearch.searchOptionsQuickPick.selectedItems.some(
                (option) => option.label === vscode.l10n.t("Case Sensitive")
            );
            DatasetSearch.savedSearchOptions.regex = DatasetSearch.searchOptionsQuickPick.selectedItems.some(
                (option) => option.label === vscode.l10n.t("Regex")
            );
            DatasetSearch.searchOptionsQuickPick.hide();
        });

        DatasetSearch.searchOptionsQuickPick.onDidHide(() => {
            DatasetSearch.searchQuickPickReset();
        });
    }

    private static searchQuickPickReset(): void {
        DatasetSearch.searchUpdateOptionsLabel();

        // This statement is required to show the quick pick items again after the search options are edited.
        // eslint-disable-next-line no-self-assign
        DatasetSearch.searchQuickPick.items = DatasetSearch.searchQuickPick.items; // Do not remove this line.
        // I blame VSCode for making me do this.

        DatasetSearch.searchQuickPick.show();
    }

    // A simple helper function to update the options quick pick label with the latest settings
    private static searchUpdateOptionsLabel(): void {
        const caseSensitive = DatasetSearch.savedSearchOptions.caseSensitive ? vscode.l10n.t("On") : vscode.l10n.t("Off");
        const regex = DatasetSearch.savedSearchOptions.regex ? vscode.l10n.t("On") : vscode.l10n.t("Off");
        DatasetSearch.optionsQuickPickEntry.label = vscode.l10n.t(`Edit Options (Case Sensitive: {0}, Regex: {1})`, [caseSensitive, regex]);
    }

    private static searchOptionsPrompt(): void {
        // Show a multiselect quick pick with the available search options
        const caseSensitiveItem: vscode.QuickPickItem = {
            label: vscode.l10n.t("Case Sensitive"),
            description: vscode.l10n.t("Perform the search with case sensitivity"),
            iconPath: new vscode.ThemeIcon("case-sensitive"),
            picked: DatasetSearch.savedSearchOptions.caseSensitive,
        };
        const regexItem: vscode.QuickPickItem = {
            label: vscode.l10n.t("Regex"),
            description: vscode.l10n.t("Treat the search query as a regex"),
            iconPath: new vscode.ThemeIcon("regex"),
            picked: DatasetSearch.savedSearchOptions.regex,
        };

        DatasetSearch.searchOptionsQuickPick.items = [caseSensitiveItem, regexItem];
        DatasetSearch.searchOptionsQuickPick.selectedItems = DatasetSearch.searchOptionsQuickPick.items.filter((item) => item.picked);
        DatasetSearch.searchOptionsQuickPick.show();
    }

    private static async openSearchAtLocation(this: void, _view: Table.View, data: Record<number, Table.RowData>): Promise<void> {
        const childrenToOpen = Object.values(data);
        if (childrenToOpen.length === 0) {
            return;
        }

        for (const child of childrenToOpen) {
            // Get the URI, look it up so the Filesystem provider is aware of it, then display the document to the user
            const childUri = vscode.Uri.from({ scheme: ZoweScheme.DS, path: child.uri as string });
            await DatasetFSProvider.instance.remoteLookupForResource(childUri);
            void Gui.showTextDocument(childUri, { preview: false }).then(
                (editor) => {
                    // Highlight the searched for text so the user can easily find it
                    const startPosition = new vscode.Position((child.line as number) - 1, (child.column as number) - 1);
                    const endPosition = new vscode.Position(
                        (child.line as number) - 1,
                        (child.column as number) - 1 + (child.searchString as string).length
                    );
                    editor.selection = new vscode.Selection(startPosition, endPosition);
                },
                (err) => {
                    Gui.errorMessage(err.message);
                }
            );
        }
    }

    private static async continueSearchPrompt(this: void, dataSets: zosfiles.IDataSet[]): Promise<boolean> {
        const MAX_DATASETS = 50;

        // If there are 50 matches or under, do not prompt the user for confirmation to continue
        if (dataSets.length <= MAX_DATASETS) {
            return true;
        }

        // There are 51 or more results, which may take a long time. Make sure the user is prepared for that.
        const resp = await Gui.infoMessage(
            vscode.l10n.t({
                message: "Are you sure you want to search {0} data sets and members?",
                args: [dataSets.length.toString()],
                comment: "The number of data sets that are about to be searched",
            }),
            {
                items: [vscode.l10n.t("Continue")],
                vsCodeOpts: { modal: true },
            }
        );

        return resp === vscode.l10n.t("Continue");
    }

    private static async performSearch(progress: any, token: vscode.CancellationToken, options: ISearchOptions): Promise<zosfiles.ISearchResponse> {
        const profile = options.node.getProfile();
        const mvsApi = ZoweExplorerApiRegister.getMvsApi(profile);
        let response: zosfiles.ISearchResponse;
        if (token.isCancellationRequested) {
            Gui.showMessage(DatasetActions.localizedStrings.opCancelled);
            return;
        }

        // Prepare a hacky task object that updates the progress bar on the GUI.
        // Pass that into the MVS API call.
        let realPercentComplete = 0;
        let realTotalEntries = 100;
        const task: imperative.ITaskWithStatus = {
            set percentComplete(value: number) {
                realPercentComplete = value;
                // eslint-disable-next-line no-magic-numbers
                Gui.reportProgress(progress, realTotalEntries, Math.floor((value * realTotalEntries) / 100), "");
            },
            get percentComplete(): number {
                return realPercentComplete;
            },
            statusMessage: "",
            stageName: 0, // TaskStage.IN_PROGRESS - https://github.com/kulshekhar/ts-jest/issues/281
        };

        try {
            // Perform the actual search
            response = await mvsApi.searchDataSets({
                pattern: options.pattern,
                searchString: options.searchString,
                progressTask: task,
                mainframeSearch: false,
                caseSensitive: options.caseSensitive,
                regex: options.regex,
                continueSearch: function intercept(dataSets: zosfiles.IDataSet[]) {
                    realTotalEntries = dataSets.length;
                    return DatasetSearch.continueSearchPrompt(dataSets);
                },
                abortSearch: function abort() {
                    return token.isCancellationRequested;
                },
            });

            // The user cancelled the search
            if (response.success === false && response.commandResponse?.includes("cancelled")) {
                return;
            }

            // If there is no API response and success is false, the search didn't even begin searching data sets, and stopped during listing.
            // Return an error to the user since we have no useful data. Otherwise, display partial results.
            if (response.success === false) {
                ZoweLogger.error(response.errorMessage);
                Gui.errorMessage(response.errorMessage);
            }
            return response.apiResponse != null ? response : undefined;
        } catch (err) {
            // Something catastrophic happened that was not handled (i.e. bad credentials).
            await AuthUtils.errorHandling(err);
            return;
        }
    }

    private static getSearchMatches(
        node: IZoweDatasetTreeNode,
        response: any,
        generateFullUri: boolean,
        searchString: string
    ): Record<string, any>[] {
        const matches = response.apiResponse;
        const newMatches: object[] = [];

        // Take in the API response, and iterate through the list of matched data sets and members
        for (const ds of matches) {
            const dsn = ds.dsn as string;
            const member = ds.member as string;
            const extension = DatasetUtils.getExtension(ds.dsn);

            let name: string = dsn;
            let uri = generateFullUri ? path.posix.join(node.getSessionNode().resourceUri.path, dsn) : node.resourceUri.path;

            if (member) {
                uri = uri + "/" + member;
                name = name + "(" + member + ")";
            }

            if (extension != null) {
                uri += extension;
            }

            // The data set or member might have multiple matches itself. Display each one as a separate item.
            for (const match of ds.matchList) {
                newMatches.push({
                    name,
                    line: match.line as number,
                    column: match.column as number,
                    position: (match.line as number).toString() + ":" + (match.column as number).toString(),
                    contents: match.contents,
                    uri,
                    searchString,
                });
            }
        }
        return newMatches;
    }
}
