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
import { Definitions } from "../../configuration/Definitions";
import { WebView, Gui } from "@zowe/zowe-explorer-api";
import { ExtensionContext } from "vscode";
import { ZoweLogger } from "../../tools/ZoweLogger";
import { JobTree } from "../job/JobTree";
import { Constants } from "../../configuration/Constants";
import { ZoweLocalStorage } from "../../tools/ZoweLocalStorage";

export class SharedHistoryView extends WebView {
    private treeProviders: Definitions.IZoweProviders;
    private currentTab: string;
    private currentSelection: { [type: string]: string };

    public constructor(context: ExtensionContext, treeProviders: Definitions.IZoweProviders) {
        const label = "Edit History";
        super(label, "edit-history", context, {
            onDidReceiveMessage: (message: object) => this.onDidReceiveMessage(message),
            retainContext: true,
        });
        this.treeProviders = treeProviders;
        this.currentSelection = { ds: "search", uss: "search", jobs: "search" };
    }

    protected async onDidReceiveMessage(message: any): Promise<void> {
        switch (message.command) {
            case "refresh":
                await this.refreshView(message);
                break;
            case "ready":
                await this.panel.webview.postMessage({
                    ds: this.getHistoryData("ds"),
                    uss: this.getHistoryData("uss"),
                    jobs: this.getHistoryData("job"),
                    tab: this.currentTab,
                    selection: this.currentSelection,
                });
                break;
            case "show-error":
                this.showError(message);
                break;
            case "update-selection":
                this.updateSelection(message);
                break;
            case "add-item":
                await this.addItem(message);
                break;
            case "remove-item":
                await this.removeItem(message);
                break;
            case "clear-all":
                await this.clearAll(message);
                break;
            default:
                break;
        }
    }

    private getTreeProvider(type: string): Definitions.TreeProvider {
        return this.treeProviders[type === "jobs" ? "job" : type] as Definitions.TreeProvider;
    }

    private getHistoryData(type: string): Definitions.History {
        const treeProvider = this.treeProviders[type] as Definitions.TreeProvider;
        return {
            search: treeProvider.getSearchHistory(),
            sessions: treeProvider.getSessions(),
            fileHistory: treeProvider.getFileHistory(),
            favorites: treeProvider.getFavorites(),
            encodingHistory: type === "uss" || type === "ds" ? this.fetchEncodingHistory() : [],
        };
    }

    private fetchEncodingHistory(): string[] {
        return ZoweLocalStorage.getValue<string[]>(Definitions.LocalStorageKey.ENCODING_HISTORY) ?? [];
    }

    private showError(message): void {
        ZoweLogger.trace("HistoryView.showError called.");
        Gui.errorMessage(message.attrs.errorMsg);
    }

    private updateSelection(message): void {
        ZoweLogger.trace("HistoryView.updateSelection called.");
        this.currentSelection[message.attrs.type] = message.attrs.selection;
    }

    private async addItem(message): Promise<void> {
        ZoweLogger.trace("HistoryView.addItem called.");

        const example = message.attrs.type === "ds" ? "e.g: USER.PDS.*" : "e.g: /u/user/mydir";

        const options: vscode.InputBoxOptions = {
            prompt: vscode.l10n.t("Type the new pattern to add to history"),
            value: "",
            placeHolder: example,
        };
        const item = await Gui.showInputBox(options);
        const treeProvider = this.getTreeProvider(message.attrs.type);
        treeProvider.addSearchHistory(item);
        await this.refreshView(message);
    }

    private async removeItem(message): Promise<void> {
        ZoweLogger.trace("HistoryView.removeItem called.");
        const treeProvider = this.getTreeProvider(message.attrs.type);
        switch (message.attrs.selection) {
            case "search":
                Object.keys(message.attrs.selectedItems).forEach((selectedItem) => {
                    if (message.attrs.selectedItems[selectedItem]) {
                        treeProvider.removeSearchHistory(selectedItem);
                    }
                });
                break;
            case "fileHistory":
                if (!(treeProvider instanceof JobTree)) {
                    Object.keys(message.attrs.selectedItems).forEach((selectedItem) => {
                        if (message.attrs.selectedItems[selectedItem]) {
                            treeProvider.removeFileHistory(selectedItem);
                        }
                    });
                }
                break;
            case "encodingHistory":
                Object.keys(message.attrs.selectedItems).forEach((selectedItem) => {
                    if (message.attrs.selectedItems[selectedItem]) {
                        const encodingHistory = this.fetchEncodingHistory();
                        ZoweLocalStorage.setValue(
                            Definitions.LocalStorageKey.ENCODING_HISTORY,
                            encodingHistory.filter((element) => element !== selectedItem)
                        );
                    }
                });
                break;
            default:
                Gui.showMessage(vscode.l10n.t("action is not supported for this property type."));
                break;
        }
        await this.refreshView(message);
    }

    private async clearAll(message): Promise<void> {
        ZoweLogger.trace("HistoryView.clearAll called.");
        const treeProvider = this.getTreeProvider(message.attrs.type);
        const infoMessage = vscode.l10n.t("Clear all history items for this persistent property?");
        const yesButton = vscode.l10n.t("Yes");
        const noButton = vscode.l10n.t("No");
        const choice = await Gui.showMessage(infoMessage, { items: [yesButton, noButton], vsCodeOpts: { modal: true } });
        if (choice === yesButton) {
            switch (message.attrs.selection) {
                case "search":
                    treeProvider.resetSearchHistory();
                    break;
                case "fileHistory":
                    if (!(treeProvider instanceof JobTree)) {
                        treeProvider.resetFileHistory();
                    }
                    break;
                case "encodingHistory":
                    ZoweLocalStorage.setValue(Definitions.LocalStorageKey.ENCODING_HISTORY, []);
                    break;
                default:
                    Gui.showMessage(vscode.l10n.t("action is not supported for this property type."));
                    break;
            }
            await this.refreshView(message);
        }
    }

    private async refreshView(message): Promise<void> {
        ZoweLogger.trace("HistoryView.refreshView called.");
        this.currentTab = Constants.HISTORY_VIEW_TABS[(message.attrs.type as string).toUpperCase()];
        await this.panel.webview.postMessage({
            ds: this.getHistoryData("ds"),
            uss: this.getHistoryData("uss"),
            jobs: this.getHistoryData("job"),
            tab: this.currentTab,
            selection: this.currentSelection,
        });
    }
}
