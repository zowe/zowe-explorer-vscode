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
import { WebView, Gui, Types } from "@zowe/zowe-explorer-api";
import { ExtensionContext } from "vscode";
import { IZoweProviders } from "./init";
import { USSTree } from "../uss/USSTree";
import { DatasetTree } from "../dataset/DatasetTree";
import { ZosJobsProvider } from "../job/ZosJobsProvider";
import { ZoweLogger } from "../utils/ZoweLogger";

type TreeProvider = USSTree | DatasetTree | ZosJobsProvider;

type History = {
    search: string[];
    sessions: string[];
    fileHistory: string[];
    dsTemplates?: Types.DataSetAllocTemplate[];
    favorites: string[];
};

const tabs = {
    ds: "ds-panel-tab",
    uss: "uss-panel-tab",
    jobs: "jobs-panel-tab",
};

export class HistoryView extends WebView {
    private treeProviders: IZoweProviders;
    private currentTab: string;
    private currentSelection: { [type: string]: string };

    public constructor(context: ExtensionContext, treeProviders: IZoweProviders) {
        const label = "Edit History";
        super(label, "edit-history", context, (message: object) => this.onDidReceiveMessage(message), true);
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

    private getTreeProvider(type: string): TreeProvider {
        return this.treeProviders[type === "jobs" ? "job" : type] as TreeProvider;
    }

    private getHistoryData(type: string): History {
        const treeProvider = this.treeProviders[type] as TreeProvider;
        return {
            search: treeProvider.getSearchHistory(),
            sessions: treeProvider.getSessions(),
            fileHistory: treeProvider.getFileHistory(),
            dsTemplates: type === "ds" ? (treeProvider as DatasetTree).getDsTemplates() : undefined,
            favorites: treeProvider.getFavorites(),
        };
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
                if (!(treeProvider instanceof ZosJobsProvider)) {
                    Object.keys(message.attrs.selectedItems).forEach((selectedItem) => {
                        if (message.attrs.selectedItems[selectedItem]) {
                            treeProvider.removeFileHistory(selectedItem);
                        }
                    });
                }
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
                    if (!(treeProvider instanceof ZosJobsProvider)) {
                        treeProvider.resetFileHistory();
                    }
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
        this.currentTab = tabs[message.attrs.type];
        await this.panel.webview.postMessage({
            ds: this.getHistoryData("ds"),
            uss: this.getHistoryData("uss"),
            jobs: this.getHistoryData("job"),
            tab: this.currentTab,
            selection: this.currentSelection,
        });
    }
}
