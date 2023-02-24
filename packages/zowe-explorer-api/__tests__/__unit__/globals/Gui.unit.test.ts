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

import { Gui, IZoweTree, IZoweTreeNode } from "../../../src/";

import * as vscode from "vscode";
import { DOUBLE_CLICK_SPEED_MS } from "../../../src/globals";
jest.mock("vscode");

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createGlobalMocks() {
    const mocks = {
        showInfoMessage: jest.fn(),
        showErrorMessage: jest.fn(),
        showWarningMessage: jest.fn(),
        createOutputChannel: jest.fn(),
        createQuickPick: jest.fn(),
        createTreeView: jest.fn(),
        createWebviewPanel: jest.fn(),
        withProgress: jest.fn(),
        showTextDocument: jest.fn(),
        showQuickPick: jest.fn(),
        setStatusBarMessage: jest.fn(),
        showOpenDialog: jest.fn(),
        showInputBox: jest.fn(),
    };

    Object.defineProperty(vscode.window, "showInformationMessage", { value: mocks.showInfoMessage });
    Object.defineProperty(vscode.window, "showErrorMessage", { value: mocks.showErrorMessage });
    Object.defineProperty(vscode.window, "showWarningMessage", { value: mocks.showWarningMessage });
    Object.defineProperty(vscode.window, "createOutputChannel", { value: mocks.createOutputChannel });
    Object.defineProperty(vscode.window, "createQuickPick", { value: mocks.createQuickPick });
    Object.defineProperty(vscode.window, "createTreeView", { value: mocks.createTreeView });
    Object.defineProperty(vscode.window, "createWebviewPanel", { value: mocks.createWebviewPanel });
    Object.defineProperty(vscode.window, "withProgress", { value: mocks.withProgress });
    Object.defineProperty(vscode.window, "showTextDocument", { value: mocks.showTextDocument });
    Object.defineProperty(vscode.window, "showQuickPick", { value: mocks.showQuickPick });
    Object.defineProperty(vscode.window, "setStatusBarMessage", { value: mocks.setStatusBarMessage });
    Object.defineProperty(vscode.window, "showOpenDialog", { value: mocks.showOpenDialog });
    Object.defineProperty(vscode.window, "showInputBox", { value: mocks.showInputBox });

    return mocks;
}
const mocks = createGlobalMocks();

describe("Gui unit tests", () => {
    it("can call showMessage", async () => {
        await Gui.showMessage("Test message");
        expect(mocks.showInfoMessage).toHaveBeenCalledWith("Test message", undefined);
    });

    it("can show an info message", async () => {
        await Gui.infoMessage("Test info message");
        expect(mocks.showInfoMessage).toHaveBeenCalledWith("Test info message", undefined);
    });

    it("can show an error message", async () => {
        await Gui.errorMessage("Test error");
        expect(mocks.showErrorMessage).toHaveBeenCalledWith("Test error", undefined);
    });

    it("can show a warning message", async () => {
        await Gui.warningMessage("Test warning");
        expect(mocks.showWarningMessage).toHaveBeenCalledWith("Test warning", undefined);
    });

    it("can create an output channel", () => {
        Gui.createOutputChannel("OutputChannel");
        expect(mocks.createOutputChannel).toHaveBeenCalledWith("OutputChannel", undefined);
    });

    it("can create a tree view", () => {
        Gui.createTreeView("Test_ID", {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
            treeDataProvider: undefined as any,
        });
        expect(mocks.createTreeView).toHaveBeenCalled();
    });

    it("can create a quick pick", () => {
        Gui.createQuickPick();
        expect(mocks.createQuickPick).toHaveBeenCalled();
    });

    it("can create a webview panel", () => {
        Gui.createWebviewPanel({
            viewType: "Test_view_type",
            title: "Test_title",
            showOptions: {
                preserveFocus: true,
                viewColumn: 1,
            },
        });
        expect(mocks.createWebviewPanel).toHaveBeenCalled();
    });

    it("can show a URI using showTextDocument", async () => {
        await Gui.showTextDocument({} as vscode.Uri);
        expect(mocks.showTextDocument).toHaveBeenCalled();
    });
    it("can show a TextDocument using showTextDocument", async () => {
        await Gui.showTextDocument({} as vscode.TextDocument);
        expect(mocks.showTextDocument).toHaveBeenCalled();
    });
    it("can call withProgress", async () => {
        await Gui.withProgress(
            {
                location: {
                    viewId: "test-view-id",
                },
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
            undefined as any
        );
        expect(mocks.withProgress).toHaveBeenCalled();
    });

    it("can call showQuickPick", async () => {
        await Gui.showQuickPick(["Test1"]);
        expect(mocks.showQuickPick).toHaveBeenCalled();
    });

    it("can set a status bar message", () => {
        Gui.setStatusBarMessage("Example status bar message");

        expect(mocks.setStatusBarMessage).toHaveBeenCalledWith("Example status bar message", undefined);
    });

    it("can set a status bar message w/ a timeout", () => {
        const EXAMPLE_TIMEOUT_MS = 500;
        Gui.setStatusBarMessage("Example status bar message", EXAMPLE_TIMEOUT_MS);

        expect(mocks.setStatusBarMessage).toHaveBeenCalledWith("Example status bar message", EXAMPLE_TIMEOUT_MS);
    });

    it("can show a file open dialog", async () => {
        await Gui.showOpenDialog();
        expect(mocks.showOpenDialog).toHaveBeenCalled();
    });

    it("can show an input box", async () => {
        await Gui.showInputBox({});
        expect(mocks.showInputBox).toHaveBeenCalled();
    });

    it("can resolve a quick pick when accepted", async () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        const mockDidAccept = jest.fn((callback: any) => callback());
        await Gui.resolveQuickPick({
            activeItems: ["test"],
            onDidAccept: mockDidAccept,
            onDidHide: jest.fn(),
        } as any);
        expect(mockDidAccept).toHaveBeenCalledTimes(1);
    });

    it("can resolve a quick pick when hidden", async () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        const mockDidHide = jest.fn((callback: any) => callback());
        await Gui.resolveQuickPick({
            activeItems: ["test"],
            onDidAccept: jest.fn(),
            onDidHide: mockDidHide,
        } as any);
        expect(mockDidHide).toHaveBeenCalledTimes(1);
    });
});

describe("Gui.utils - unit tests", () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    it("returns false when checking if an invalid node was double-clicked", () => {
        const clicked = Gui.utils.wasDoubleClicked(null as unknown as IZoweTreeNode, { lastOpened: {} } as unknown as IZoweTree<unknown>);
        expect(clicked).toBe(false);
    });

    const testDoubleClickEvent = (timeout: number, expected: boolean): void => {
        const mockTime = new Date();
        const fakeNode = { label: "fakeLabel" } as unknown as IZoweTreeNode;

        setTimeout(() => {
            const wasDoubleClicked = Gui.utils.wasDoubleClicked(fakeNode, {
                lastOpened: { node: fakeNode, date: mockTime },
            } as unknown as IZoweTree<unknown>);
            expect(wasDoubleClicked).toBe(expected);
        }, timeout);
    };

    it("returns false when the second click event is after the DOUBLE_CLICK_SPEED_MS window", () => {
        testDoubleClickEvent(DOUBLE_CLICK_SPEED_MS * 4, false);
    });

    it("returns true when the second click event is within the DOUBLE_CLICK_SPEED_MS window", () => {
        testDoubleClickEvent(DOUBLE_CLICK_SPEED_MS / 8, true);
    });
});
