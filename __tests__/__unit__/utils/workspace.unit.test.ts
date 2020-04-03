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

import * as vscode from "vscode";

jest.mock("vscode");

const activeTextEditor = jest.fn();
const executeCommand = jest.fn();

Object.defineProperty(vscode.window, "activeTextEditor", {get: activeTextEditor});
Object.defineProperty(vscode.commands, "executeCommand", {value: executeCommand});

describe("Workspace file status method", () => {
    beforeEach(() => {
        activeTextEditor.mockReset();
        executeCommand.mockReset();
    });

    it("Runs correctly with no tabs available", async () => {
        const targetTextFile = "/doc";
        activeTextEditor.mockReturnValueOnce(null);

        const result = await checkTextFileIsOpened(targetTextFile);
        expect(result).toBe(false);
        expect(executeCommand.mock.calls.length).toBe(0);
    });
    it("Runs correctly with tabs and target document available", async () => {
        const targetTextFile = "/doc3";
        const mockDocuments = [
            {
                id: 1,
                document: {
                    fileName: "/doc1"
                }
            },
            {
                id: 2,
                document: {
                    fileName: "/doc2"
                }
            },
            {
                id: 3,
                document: {
                    fileName: "/doc3"
                }
            }
        ];
        mockDocuments.forEach((doc) => activeTextEditor.mockReturnValueOnce(doc));

        const result = await checkTextFileIsOpened(targetTextFile);
        expect(result).toBe(true);
        expect(executeCommand.mock.calls.map((call) => call[0]))
            .toEqual(["workbench.action.nextEditor", "workbench.action.nextEditor", "workbench.action.nextEditor"]);
    });
    it("Runs correctly with tabs available but no target document opened", async () => {
        const targetTextFile = "/doc";
        const mockDocuments = [
            {
                id: 1,
                document: {
                    fileName: "/doc1"
                }
            },
            {
                id: 2,
                document: {
                    fileName: "/doc2"
                }
            },
            {
                id: 3,
                document: {
                    fileName: "/doc3"
                }
            }
        ];
        mockDocuments.forEach((doc) => activeTextEditor.mockReturnValueOnce(doc));

        const result = await checkTextFileIsOpened(targetTextFile);
        expect(result).toBe(false);
        expect(executeCommand.mock.calls.map((call) => call[0]))
            .toEqual(["workbench.action.nextEditor", "workbench.action.nextEditor", "workbench.action.nextEditor"]);
    });
});
describe("Workspace file close method", () => {
    beforeEach(() => {
        activeTextEditor.mockReset();
        executeCommand.mockReset();
    });

    it("Runs correctly with no tabs available", async () => {
        const targetTextFile = "/doc";
        activeTextEditor.mockReturnValueOnce(null);

        const result = await closeOpenedTextFile(targetTextFile);
        expect(result).toBe(false);
        expect(executeCommand.mock.calls.length).toBe(0);
    });
    it("Runs correctly with tabs and target document available", async () => {
        const targetTextFile = "/doc3";
        const mockDocuments = [
            {
                id: 1,
                document: {
                    fileName: "/doc1"
                }
            },
            {
                id: 2,
                document: {
                    fileName: "/doc2"
                }
            },
            {
                id: 3,
                document: {
                    fileName: "/doc3"
                }
            }
        ];
        mockDocuments.forEach((doc) => activeTextEditor.mockReturnValueOnce(doc));

        const result = await closeOpenedTextFile(targetTextFile);
        expect(result).toBe(true);
        expect(executeCommand.mock.calls.map((call) => call[0]))
            .toEqual(["workbench.action.nextEditor", "workbench.action.nextEditor", "workbench.action.closeActiveEditor"]);
    });
    it("Runs correctly with tabs available but no target document opened", async () => {
        const targetTextFile = "/doc";
        const mockDocuments = [
            {
                id: 1,
                document: {
                    fileName: "/doc1"
                }
            },
            {
                id: 2,
                document: {
                    fileName: "/doc2"
                }
            },
            {
                id: 3,
                document: {
                    fileName: "/doc3"
                }
            }
        ];
        mockDocuments.forEach((doc) => activeTextEditor.mockReturnValueOnce(doc));

        const result = await closeOpenedTextFile(targetTextFile);
        expect(result).toBe(false);
        expect(executeCommand.mock.calls.map((call) => call[0]))
            .toEqual(["workbench.action.nextEditor", "workbench.action.nextEditor", "workbench.action.nextEditor"]);
    });
});

/********************************************************************************************************************/
/**************************************************HELPER FUNCTIONS**************************************************/
/********************************************************************************************************************/

interface IExtTextEditor extends vscode.TextEditor { id: string; }

/**
 * Checks if file is opened using iteration through tabs
 * This kind of method is caused by incompleteness of VSCode API, which allows to check only buffered status of files
 * There's an issue on GitHub for such feature: https://github.com/Microsoft/vscode/issues/15178 let's track it
 * Idea of the approach was borrowed from the another extension: https://github.com/eamodio/vscode-restore-editors/blob/master/src/documentManager.ts
 * Also notice that timer delay as well as iteration through opened tabs can cause side-effects on slow machines
 */
export async function checkTextFileIsOpened(path: string) {
    const tabSwitchDelay = 200;
    const openedWindows = [] as IExtTextEditor[];

    let selectedEditor = vscode.window.activeTextEditor as IExtTextEditor;
    while (selectedEditor && !openedWindows.some((window) => window.id === selectedEditor.id)) {
        openedWindows.push(selectedEditor);

        await openNextTab(tabSwitchDelay);
        selectedEditor = vscode.window.activeTextEditor as IExtTextEditor;
    }

    return openedWindows.some((window) => window.document.fileName === path);
}

/**
 * Opens the next tab in editor with given delay
 */
function openNextTab(delay: number) {
    return new Promise((resolve) => {
        vscode.commands.executeCommand("workbench.action.nextEditor");
        setTimeout(() => resolve(), delay);
    });
}

/**
 * Closes opened file tab using iteration through the tabs
 * This kind of method is caused by incompleteness of VSCode API, which allows to close only currently selected editor
 * For us it means we need to select editor first, which is again not possible via existing VSCode APIs
 */
export async function closeOpenedTextFile(path: string) {
    const tabSwitchDelay = 200;
    const openedWindows = [] as IExtTextEditor[];

    let selectedEditor = vscode.window.activeTextEditor as IExtTextEditor;
    while (selectedEditor && !openedWindows.some((window) => window.id === selectedEditor.id)) {
        openedWindows.push(selectedEditor);

        await openNextTab(tabSwitchDelay);
        selectedEditor = vscode.window.activeTextEditor as IExtTextEditor;

        if (selectedEditor && selectedEditor.document.fileName === path) {
            vscode.commands.executeCommand("workbench.action.closeActiveEditor");
            return true;
        }
    }

    return false;
}
