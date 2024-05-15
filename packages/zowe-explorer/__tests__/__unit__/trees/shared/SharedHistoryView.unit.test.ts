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
import { createDatasetSessionNode, createDatasetTree } from "../../../__mocks__/mockCreators/datasets";
import { createUSSSessionNode, createUSSTree } from "../../../__mocks__/mockCreators/uss";
import {
    createIProfile,
    createISession,
    createISessionWithoutCredentials,
    createInstanceOfProfile,
    createTreeView,
} from "../../../__mocks__/mockCreators/shared";
import { createIJobObject, createJobsTree } from "../../../__mocks__/mockCreators/jobs";
import { SharedHistoryView } from "../../../../src/trees/shared/SharedHistoryView";
import { Gui } from "@zowe/zowe-explorer-api";
import { Profiles } from "../../../../src/configuration/Profiles";
import { ZoweLocalStorage } from "../../../../src/tools/ZoweLocalStorage";
import { UssFSProvider } from "../../../../src/trees/uss/UssFSProvider";
import { Constants } from "../../../../src/configuration/Constants";

async function initializeHistoryViewMock(blockMocks: any, globalMocks: any): Promise<SharedHistoryView> {
    return new SharedHistoryView(
        {
            extensionPath: "",
        } as any,
        {
            ds: await createDatasetTree(blockMocks.datasetSessionNode, globalMocks.treeView),
            uss: createUSSTree([blockMocks.datasetSessionNode], [globalMocks.testSession], globalMocks.treeView),
            jobs: await createJobsTree(globalMocks.testSession, createIJobObject(), globalMocks.testProfile, createTreeView()),
        } as any
    );
}

function createGlobalMocks(): any {
    const globalMocks = {
        session: createISessionWithoutCredentials(),
        testSession: createISession(),
        treeView: createTreeView(),
        imperativeProfile: createIProfile(),
        FileSystemProvider: {
            createDirectory: jest.fn(),
        },
    };

    jest.spyOn(UssFSProvider.instance, "createDirectory").mockImplementation(globalMocks.FileSystemProvider.createDirectory);
    Object.defineProperty(Gui, "showMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(Gui, "resolveQuickPick", { value: jest.fn(), configurable: true });
    Object.defineProperty(Gui, "createQuickPick", { value: jest.fn(), configurable: true });
    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn().mockReturnValue(createInstanceOfProfile(globalMocks.imperativeProfile)),
        configurable: true,
    });
    Object.defineProperty(vscode.window, "createTreeView", { value: jest.fn().mockReturnValueOnce(globalMocks.treeView), configurable: true });
    Object.defineProperty(ZoweLocalStorage, "storage", {
        value: {
            get: () => ({ persistence: true, favorites: [], history: [], sessions: ["zosmf"], searchHistory: [], fileHistory: [] }),
            update: jest.fn(),
            keys: () => [],
        },
        configurable: true,
    });

    return globalMocks;
}

function createBlockMocks(globalMocks: any): any {
    return {
        datasetSessionNode: createDatasetSessionNode(globalMocks.session, globalMocks.imperativeProfile),
        ussSessionNode: createUSSSessionNode(globalMocks.session, globalMocks.imperativeProfile),
    };
}

describe("HistoryView Unit Tests", () => {
    describe("constructor", () => {
        it("should create the webview instance and initialize", () => {
            const historyView = new SharedHistoryView(
                {
                    extensionPath: "",
                } as any,
                { test: "test" } as any
            );
            expect(historyView["treeProviders"]).toEqual({ test: "test" });
            expect(historyView["currentSelection"]).toEqual({ ds: "search", uss: "search", jobs: "search" });
        });
    });

    describe("onDidReceiveMessage", () => {
        it("should handle the case where 'refresh' is the command sent", async () => {
            const globalMocks = await createGlobalMocks();
            const blockMocks = createBlockMocks(globalMocks);
            const historyView = await initializeHistoryViewMock(blockMocks, globalMocks);
            const postMessageSpy = jest.spyOn(historyView.panel.webview, "postMessage");
            jest.spyOn(historyView as any, "getHistoryData").mockReturnValue([]);
            await historyView["onDidReceiveMessage"]({ command: "refresh", attrs: { type: "USS" } });
            expect(postMessageSpy).toHaveBeenCalledTimes(1);
            expect(historyView["currentTab"]).toEqual("uss-panel-tab");
        });

        it("should handle the case where 'ready' is the command sent", async () => {
            const globalMocks = await createGlobalMocks();
            const blockMocks = createBlockMocks(globalMocks);
            const historyView = await initializeHistoryViewMock(blockMocks, globalMocks);
            const postMessageSpy = jest.spyOn(historyView.panel.webview, "postMessage");
            jest.spyOn(historyView as any, "getHistoryData").mockReturnValue([]);
            await historyView["onDidReceiveMessage"]({ command: "ready" });
            expect(postMessageSpy).toHaveBeenCalledWith({
                ds: [],
                uss: [],
                jobs: [],
                tab: undefined,
                selection: {
                    ds: "search",
                    jobs: "search",
                    uss: "search",
                },
            });
        });

        it("should handle the case where 'show-error' is the command sent", async () => {
            const globalMocks = await createGlobalMocks();
            const blockMocks = createBlockMocks(globalMocks);
            const historyView = await initializeHistoryViewMock(blockMocks, globalMocks);
            const errorMessageSpy = jest.spyOn(Gui, "errorMessage");
            await historyView["onDidReceiveMessage"]({ command: "show-error", attrs: { errorMsg: "test error" } });
            expect(errorMessageSpy).toHaveBeenCalledWith("test error");
        });

        it("should handle the case where 'update-selection' is the command sent", async () => {
            const globalMocks = await createGlobalMocks();
            const blockMocks = createBlockMocks(globalMocks);
            const historyView = await initializeHistoryViewMock(blockMocks, globalMocks);
            await historyView["onDidReceiveMessage"]({ command: "update-selection", attrs: { type: "uss", selection: "favorites" } });
            expect(historyView["currentSelection"]).toEqual({ ds: "search", jobs: "search", uss: "favorites" });
        });

        it("should handle the case where 'add-item' is the command sent", async () => {
            const globalMocks = await createGlobalMocks();
            const blockMocks = createBlockMocks(globalMocks);
            const historyView = await initializeHistoryViewMock(blockMocks, globalMocks);
            jest.spyOn(Gui, "showInputBox").mockResolvedValue("test");
            const addSearchHistorySpy = jest.spyOn(historyView["treeProviders"].uss, "addSearchHistory");
            jest.spyOn(historyView as any, "refreshView").mockImplementation();
            await historyView["onDidReceiveMessage"]({ command: "add-item", attrs: { type: "uss" } });
            expect(historyView["currentSelection"]).toEqual({ ds: "search", jobs: "search", uss: "search" });
            expect(addSearchHistorySpy).toHaveBeenCalledWith("test");
        });

        it("should handle the case where 'remove-item' is the command sent and the selection is 'search'", async () => {
            const globalMocks = await createGlobalMocks();
            const blockMocks = createBlockMocks(globalMocks);
            const historyView = await initializeHistoryViewMock(blockMocks, globalMocks);
            jest.spyOn(historyView as any, "refreshView").mockImplementation();
            const removeSearchHistorySpy = jest.spyOn(historyView["treeProviders"].ds as any, "removeSearchHistory");
            await historyView["onDidReceiveMessage"]({
                command: "remove-item",
                attrs: { type: "ds", selection: "search", selectedItems: { test: "test1" } },
            });
            expect(historyView["currentSelection"]).toEqual({ ds: "search", jobs: "search", uss: "search" });
            expect(removeSearchHistorySpy).toHaveBeenCalledWith("test");
        });

        it("should handle the case where 'remove-item' is the command sent and the selection is 'fileHistory'", async () => {
            const globalMocks = await createGlobalMocks();
            const blockMocks = createBlockMocks(globalMocks);
            const historyView = await initializeHistoryViewMock(blockMocks, globalMocks);
            jest.spyOn(historyView as any, "refreshView").mockImplementation();
            const removeFileHistorySpy = jest.spyOn(historyView["treeProviders"].ds, "removeFileHistory");
            await historyView["onDidReceiveMessage"]({
                command: "remove-item",
                attrs: { type: "ds", selection: "fileHistory", selectedItems: { test: "test1" } },
            });
            expect(historyView["currentSelection"]).toEqual({ ds: "search", jobs: "search", uss: "search" });
            expect(removeFileHistorySpy).toHaveBeenCalledWith("test");
        });

        it("should handle the case where 'remove-item' is the command sent and the selection is not supported", async () => {
            const globalMocks = await createGlobalMocks();
            const blockMocks = createBlockMocks(globalMocks);
            const historyView = await initializeHistoryViewMock(blockMocks, globalMocks);
            jest.spyOn(historyView as any, "refreshView").mockImplementation();
            const showMessageSpy = jest.spyOn(Gui, "showMessage");
            await historyView["onDidReceiveMessage"]({
                command: "remove-item",
                attrs: { type: "ds", selection: "favorites", selectedItems: { test: "test1" } },
            });
            expect(historyView["currentSelection"]).toEqual({ ds: "search", jobs: "search", uss: "search" });
            expect(showMessageSpy).toHaveBeenCalledTimes(1);
        });

        it("should handle the case where 'clear-all' is the command sent and the selection is 'search'", async () => {
            const globalMocks = await createGlobalMocks();
            const blockMocks = createBlockMocks(globalMocks);
            const historyView = await initializeHistoryViewMock(blockMocks, globalMocks);
            jest.spyOn(historyView as any, "refreshView").mockImplementation();
            jest.spyOn(Gui, "showMessage").mockResolvedValue("Yes");

            const resetSearchHistorySpy = jest.spyOn(historyView["treeProviders"].ds as any, "resetSearchHistory");
            await historyView["onDidReceiveMessage"]({
                command: "clear-all",
                attrs: { type: "ds", selection: "search" },
            });
            expect(historyView["currentSelection"]).toEqual({ ds: "search", jobs: "search", uss: "search" });
            expect(resetSearchHistorySpy).toHaveBeenCalledTimes(1);
        });

        it("should handle the case where 'clear-all' is the command sent and the selection is 'fileHistory'", async () => {
            const globalMocks = await createGlobalMocks();
            const blockMocks = createBlockMocks(globalMocks);
            const historyView = await initializeHistoryViewMock(blockMocks, globalMocks);
            jest.spyOn(historyView as any, "refreshView").mockImplementation();
            jest.spyOn(Gui, "showMessage").mockResolvedValue("Yes");

            const resetFileHistorySpy = jest.spyOn(historyView["treeProviders"].ds as any, "resetFileHistory");
            await historyView["onDidReceiveMessage"]({
                command: "clear-all",
                attrs: { type: "ds", selection: "fileHistory" },
            });
            expect(historyView["currentSelection"]).toEqual({ ds: "search", jobs: "search", uss: "search" });
            expect(resetFileHistorySpy).toHaveBeenCalledTimes(1);
        });

        it("should handle the case where 'clear-all' is the command sent and the selection is 'fileHistory'", async () => {
            const globalMocks = await createGlobalMocks();
            const blockMocks = createBlockMocks(globalMocks);
            const historyView = await initializeHistoryViewMock(blockMocks, globalMocks);
            jest.spyOn(historyView as any, "refreshView").mockImplementation();
            jest.spyOn(Gui, "showMessage").mockResolvedValueOnce("Yes");
            const showMessageSpy = jest.spyOn(Gui, "showMessage");
            await historyView["onDidReceiveMessage"]({
                command: "clear-all",
                attrs: { type: "ds", selection: "favorites" },
            });
            expect(historyView["currentSelection"]).toEqual({ ds: "search", jobs: "search", uss: "search" });
            expect(showMessageSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe("getHistoryData", () => {
        it("should get the latest history data", async () => {
            const globalMocks = await createGlobalMocks();
            const blockMocks = createBlockMocks(globalMocks);
            const historyView = await initializeHistoryViewMock(blockMocks, globalMocks);

            expect(historyView["getHistoryData"]("ds")).toEqual({
                dsTemplates: undefined,
                favorites: undefined,
                fileHistory: [],
                search: undefined,
                sessions: undefined,
            });
        });
    });
});
