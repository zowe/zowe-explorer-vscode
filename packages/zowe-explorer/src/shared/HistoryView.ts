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
import * as nls from "vscode-nls";
import { WebView, Gui, DataSetAllocTemplate } from "@zowe/zowe-explorer-api";
import { ExtensionContext } from "vscode";
import { IZoweProviders } from "./init";
import { USSTree } from "../uss/USSTree";
import { DatasetTree } from "../dataset/DatasetTree";
import { ZosJobsProvider } from "../job/ZosJobsProvider";
import { ZoweLogger } from "../utils/LoggerUtils";

const localize: nls.LocalizeFunc = nls.loadMessageBundle();

type TreeProvider = USSTree | DatasetTree | ZosJobsProvider;

type History = {
    search: string[];
    sessions: string[];
    fileHistory: string[];
    dsTemplates?: DataSetAllocTemplate[];
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

    public constructor(context: ExtensionContext, treeProviders: IZoweProviders) {
        const label = "Edit History";
        super(label, "edit-history", context, (message: object) => this.onDidReceiveMessage(message));
        this.treeProviders = treeProviders;
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
                });
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

    private async addItem(message): Promise<void> {
        ZoweLogger.trace("HistoryView.addItem called.");
        const options: vscode.InputBoxOptions = {
            prompt: localize("HistoryView.addItem.prompt", "Type the new pattern to add to history"),
            value: "",
        };
        const item = await Gui.showInputBox(options);
        const treeProvider = this.getTreeProvider(message.attrs.type);
        treeProvider.addSearchHistory(item);
        await this.refreshView(message);
    }

    private async removeItem(message): Promise<void> {
        ZoweLogger.trace("HistoryView.removeItem called.");
        const treeProvider = this.getTreeProvider(message.attrs.type);
        treeProvider.removeSearchHistory(message.attrs.name);
        await this.refreshView(message);
    }

    private async clearAll(message): Promise<void> {
        ZoweLogger.trace("HistoryView.clearAll called.");
        const treeProvider = this.getTreeProvider(message.attrs.type);
        treeProvider.resetSearchHistory();
        await this.refreshView(message);
    }

    private async refreshView(message): Promise<void> {
        ZoweLogger.trace("HistoryView.refreshView called.");
        this.currentTab = tabs[message.attrs.type];
        await vscode.commands.executeCommand("workbench.action.webview.reloadWebviewAction");
    }
}
