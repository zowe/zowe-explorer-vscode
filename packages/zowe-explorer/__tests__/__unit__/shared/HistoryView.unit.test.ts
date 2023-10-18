import { HistoryView } from "../../../src/shared/HistoryView";
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
import * as vscode from "vscode";
import { Gui } from "@zowe/zowe-explorer-api";
import { Profiles } from "../../../src/Profiles";
import * as globals from "../../../src/globals";
import * as zowe from "@zowe/cli";
import { ZoweLogger } from "../../../src/utils/LoggerUtils";

async function initializeHistoryViewMock(blockMocks: any, globalMocks: any): Promise<HistoryView> {
    return new HistoryView(
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

function createBlockMocks(globalMocks: any): any {
    return {
        datasetSessionNode: createDatasetSessionNode(globalMocks.session, globalMocks.imperativeProfile),
        ussSessionNode: createUSSSessionNode(globalMocks.session, globalMocks.imperativeProfile),
    };
}

describe("HistoryView Unit Tests", () => {
    function createGlobalMocks(): any {
        const globalMocks = {
            session: createISessionWithoutCredentials(),
            testSession: createISession(),
            treeView: createTreeView(),
            imperativeProfile: createIProfile(),
            withProgress: null,
            mockCallback: null,
            ProgressLocation: jest.fn().mockImplementation(() => {
                return {
                    Notification: 15,
                };
            }),
            qpPlaceholder: 'Choose "Create new..." to define a new profile or select an existing profile to add to the Data Set Explorer',
        };

        Object.defineProperty(vscode.window, "withProgress", {
            value: jest.fn().mockImplementation((progLocation, callback) => {
                const progress = {
                    report: (message) => {
                        return;
                    },
                };
                const token = {
                    isCancellationRequested: false,
                    onCancellationRequested: undefined,
                };
                return callback(progress, token);
            }),
            configurable: true,
        });

        Object.defineProperty(Gui, "setStatusBarMessage", {
            value: jest.fn().mockReturnValue({
                dispose: jest.fn(),
            }),
            configurable: true,
        });
        Object.defineProperty(vscode.window, "createTreeView", { value: jest.fn(), configurable: true });
        Object.defineProperty(vscode.workspace, "getConfiguration", { value: jest.fn(), configurable: true });
        Object.defineProperty(vscode.window, "showInformationMessage", { value: jest.fn(), configurable: true });
        Object.defineProperty(vscode.window, "showInputBox", { value: jest.fn(), configurable: true });
        Object.defineProperty(vscode.window, "showErrorMessage", { value: jest.fn(), configurable: true });
        Object.defineProperty(Gui, "showMessage", { value: jest.fn(), configurable: true });
        Object.defineProperty(Gui, "resolveQuickPick", { value: jest.fn(), configurable: true });
        Object.defineProperty(Gui, "createQuickPick", { value: jest.fn(), configurable: true });
        Object.defineProperty(vscode.commands, "executeCommand", { value: globalMocks.withProgress, configurable: true });
        Object.defineProperty(vscode, "ProgressLocation", { value: globalMocks.ProgressLocation, configurable: true });
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn().mockReturnValue(createInstanceOfProfile(globalMocks.imperativeProfile)),
            configurable: true,
        });
        Object.defineProperty(zowe, "Download", {
            value: {
                ussFile: jest.fn().mockReturnValue({
                    apiResponse: {
                        etag: "ABC123",
                    },
                }),
            },
            configurable: true,
        });
        Object.defineProperty(zowe, "Utilities", { value: jest.fn(), configurable: true });
        Object.defineProperty(zowe.Utilities, "isFileTagBinOrAscii", { value: jest.fn(), configurable: true });
        Object.defineProperty(globals, "LOG", { value: jest.fn(), configurable: true });
        Object.defineProperty(globals.LOG, "debug", { value: jest.fn(), configurable: true });
        Object.defineProperty(globals.LOG, "error", { value: jest.fn(), configurable: true });
        Object.defineProperty(globals.LOG, "warn", { value: jest.fn(), configurable: true });
        Object.defineProperty(ZoweLogger, "error", { value: jest.fn(), configurable: true });
        Object.defineProperty(ZoweLogger, "debug", { value: jest.fn(), configurable: true });
        Object.defineProperty(ZoweLogger, "warn", { value: jest.fn(), configurable: true });
        Object.defineProperty(ZoweLogger, "info", { value: jest.fn(), configurable: true });
        Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });

        return globalMocks;
    }

    describe("constructor", () => {
        it("should create the webview instance and initialize", () => {
            const historyView = new HistoryView(
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
            await historyView["onDidReceiveMessage"]({ command: "refresh", attrs: { type: "uss" } });
            expect(postMessageSpy).toBeCalledTimes(1);
            expect(historyView["currentTab"]).toEqual("uss-panel-tab");
        });

        it("should handle the case where 'ready' is the command sent", async () => {
            const globalMocks = await createGlobalMocks();
            const blockMocks = createBlockMocks(globalMocks);
            const historyView = await initializeHistoryViewMock(blockMocks, globalMocks);
            const postMessageSpy = jest.spyOn(historyView.panel.webview, "postMessage");
            jest.spyOn(historyView as any, "getHistoryData").mockReturnValue([]);
            await historyView["onDidReceiveMessage"]({ command: "ready" });
            expect(postMessageSpy).toBeCalledWith({
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
            expect(errorMessageSpy).toBeCalledWith("test error");
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
            expect(addSearchHistorySpy).toBeCalledWith("test");
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
            expect(removeSearchHistorySpy).toBeCalledWith("test");
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
            expect(removeFileHistorySpy).toBeCalledWith("test");
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
            expect(showMessageSpy).toBeCalledTimes(1);
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
            expect(resetSearchHistorySpy).toBeCalledTimes(1);
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
            expect(resetFileHistorySpy).toBeCalledTimes(1);
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
            expect(showMessageSpy).toBeCalledTimes(2);
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
