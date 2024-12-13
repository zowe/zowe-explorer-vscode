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
import * as workspaceUtils from "../../../src/utils/workspace";
import { workspaceUtilMaxEmptyWindowsInTheRow } from "../../../src/config/constants";
import { SettingsConfig } from "../../../src/utils/SettingsConfig";
import { ZoweSaveQueue } from "../../../src/abstract/ZoweSaveQueue";
import { Gui } from "@zowe/zowe-explorer-api";

function createGlobalMocks() {
    const activeTextEditor = jest.fn();
    const executeCommand = jest.fn();

    Object.defineProperty(vscode.window, "activeTextEditor", { get: activeTextEditor, configurable: true });
    Object.defineProperty(vscode.commands, "executeCommand", { value: executeCommand, configurable: true });

    return {
        activeTextEditor,
        executeCommand,
    };
}

/**
 * Function which imitates looping through an array
 */
const generateCycledMock = (mock: any[]) => {
    let currentIndex = 0;

    return () => {
        if (currentIndex === mock.length) {
            currentIndex = 0;
        }

        const entry = mock[currentIndex];
        currentIndex++;

        return entry;
    };
};

describe("Workspace Utils Unit Test - Function checkTextFileIsOpened", () => {
    it("Checking logic when no tabs available", async () => {
        const globalMocks = createGlobalMocks();
        const targetTextFile = "/doc";
        globalMocks.activeTextEditor.mockReturnValue(null);

        const result = await workspaceUtils.checkTextFileIsOpened(targetTextFile);
        expect(result).toBe(false);
        expect(globalMocks.executeCommand.mock.calls.map((call) => call[0])).toEqual(
            Array(workspaceUtilMaxEmptyWindowsInTheRow).fill("workbench.action.nextEditor")
        );
    });
    it("Checking logic when target tab is available", async () => {
        const globalMocks = createGlobalMocks();
        const targetTextFile = "/doc3";
        const mockDocuments = [
            {
                id: 1,
                document: {
                    fileName: "/doc1",
                },
            },
            {
                id: 2,
                document: {
                    fileName: "/doc2",
                },
            },
            {
                id: 3,
                document: {
                    fileName: "/doc3",
                },
            },
        ];
        globalMocks.activeTextEditor.mockImplementation(generateCycledMock(mockDocuments));

        const result = await workspaceUtils.checkTextFileIsOpened(targetTextFile);
        expect(result).toBe(true);
        expect(globalMocks.executeCommand.mock.calls.map((call) => call[0])).toEqual([
            "workbench.action.nextEditor",
            "workbench.action.nextEditor",
            "workbench.action.nextEditor",
        ]);
    });
    it("Checking logic when target tab is not available", async () => {
        const globalMocks = createGlobalMocks();
        const targetTextFile = "/doc";
        const mockDocuments = [
            {
                id: 1,
                document: {
                    fileName: "/doc1",
                },
            },
            {
                id: 2,
                document: {
                    fileName: "/doc2",
                },
            },
            {
                id: 3,
                document: {
                    fileName: "/doc3",
                },
            },
        ];
        globalMocks.activeTextEditor.mockImplementation(generateCycledMock(mockDocuments));

        const result = await workspaceUtils.checkTextFileIsOpened(targetTextFile);
        expect(result).toBe(false);
        expect(globalMocks.executeCommand.mock.calls.map((call) => call[0])).toEqual([
            "workbench.action.nextEditor",
            "workbench.action.nextEditor",
            "workbench.action.nextEditor",
        ]);
    });
});
describe("Workspace Utils Unit Test - Function closeOpenedTextFile", () => {
    it("Checking logic when no tabs available", async () => {
        const globalMocks = createGlobalMocks();
        const targetTextFile = "/doc";
        globalMocks.activeTextEditor.mockReturnValueOnce(null);

        const result = await workspaceUtils.closeOpenedTextFile(targetTextFile);
        expect(result).toBe(false);
        expect(globalMocks.executeCommand.mock.calls.map((call) => call[0])).toEqual(
            Array(workspaceUtilMaxEmptyWindowsInTheRow).fill("workbench.action.nextEditor")
        );
    });
    it("Checking logic when target tab is available", async () => {
        const globalMocks = createGlobalMocks();
        const targetTextFile = "/doc3";
        const mockDocuments = [
            {
                id: 1,
                document: {
                    fileName: "/doc1",
                },
            },
            {
                id: 2,
                document: {
                    fileName: "/doc2",
                },
            },
            {
                id: 3,
                document: {
                    fileName: "/doc3",
                },
            },
        ];
        globalMocks.activeTextEditor.mockImplementation(generateCycledMock(mockDocuments));

        const result = await workspaceUtils.closeOpenedTextFile(targetTextFile);
        expect(result).toBe(true);
        expect(globalMocks.executeCommand.mock.calls.map((call) => call[0])).toEqual([
            "workbench.action.nextEditor",
            "workbench.action.nextEditor",
            "workbench.action.closeActiveEditor",
        ]);
    });
    it("Checking logic when target tab is not available", async () => {
        const globalMocks = createGlobalMocks();
        const targetTextFile = "/doc";
        const mockDocuments = [
            {
                id: 1,
                document: {
                    fileName: "/doc1",
                },
            },
            {
                id: 2,
                document: {
                    fileName: "/doc2",
                },
            },
            {
                id: 3,
                document: {
                    fileName: "/doc3",
                },
            },
        ];
        globalMocks.activeTextEditor.mockImplementation(generateCycledMock(mockDocuments));

        const result = await workspaceUtils.closeOpenedTextFile(targetTextFile);
        expect(result).toBe(false);
        expect(globalMocks.executeCommand.mock.calls.map((call) => call[0])).toEqual([
            "workbench.action.nextEditor",
            "workbench.action.nextEditor",
            "workbench.action.nextEditor",
        ]);
    });
});

describe("Workspace Utils Unit Tests - function awaitForDocumentBeingSaved", () => {
    it("should hold for a document to be saved", async () => {
        let testCount = 0;
        const testSaveTimer = setInterval(() => {
            if (testCount > 5) {
                workspaceUtils.setFileSaved(true);
                clearInterval(testSaveTimer);
            }
            testCount++;
        });
        await expect(workspaceUtils.awaitForDocumentBeingSaved()).resolves.not.toThrow();
    });
});

describe("Workspace Utils Unit Tests - function handleAutoSaveOnError", () => {
    function getBlockMocks(autoSaveEnabled: boolean = true, userResponse?: string): Record<string, jest.SpyInstance> {
        const executeCommand = jest.spyOn(vscode.commands, "executeCommand").mockClear();
        const getDirectValue = jest.spyOn(SettingsConfig, "getDirectValue");
        if (autoSaveEnabled) {
            executeCommand.mockResolvedValueOnce(undefined);
            getDirectValue.mockReturnValueOnce("afterDelay");
        } else {
            getDirectValue.mockReturnValueOnce("off");
        }

        if (userResponse === "Enable Auto Save") {
            executeCommand.mockResolvedValueOnce(undefined);
        }

        return {
            errorMessage: jest.spyOn(Gui, "errorMessage").mockResolvedValueOnce(userResponse),
            executeCommand,
            getDirectValue,
            markAllUnsaved: jest.spyOn(ZoweSaveQueue, "markAllUnsaved"),
        };
    }

    it("returns early if Auto Save is disabled", async () => {
        const blockMocks = getBlockMocks(false);
        await workspaceUtils.handleAutoSaveOnError();
        expect(blockMocks.getDirectValue).toHaveBeenCalledWith("files.autoSave");
        expect(blockMocks.executeCommand).not.toHaveBeenCalled();
    });

    it("toggles off auto save if enabled", async () => {
        const blockMocks = getBlockMocks(true);
        await workspaceUtils.handleAutoSaveOnError();
        expect(blockMocks.executeCommand).toHaveBeenCalledWith("workbench.action.toggleAutoSave");
    });

    it("calls ZoweSaveQueue.markAllUnsaved to mark documents unsaved and clear queue", async () => {
        const blockMocks = getBlockMocks(true);
        await workspaceUtils.handleAutoSaveOnError();
        expect(blockMocks.markAllUnsaved).toHaveBeenCalled();
    });

    it("prompts the user to reactivate Auto Save in event of save error", async () => {
        const blockMocks = getBlockMocks(true);
        await workspaceUtils.handleAutoSaveOnError();
        expect(blockMocks.errorMessage).toHaveBeenCalledWith(
            "Zowe Explorer encountered a save error and has disabled Auto Save. Once the issue is addressed, enable Auto Save and try again.",
            { items: ["Enable Auto Save"] }
        );
    });

    it("does nothing if 'Enable Auto Save' clicked and Auto Save is already on", async () => {
        const blockMocks = getBlockMocks(true, "Enable Auto Save");
        await workspaceUtils.handleAutoSaveOnError();
        expect(blockMocks.executeCommand).toHaveBeenCalledWith("workbench.action.toggleAutoSave");
        expect(blockMocks.executeCommand).toHaveBeenCalledTimes(1);
    });

    it("reactivates Auto Save if 'Enable Auto Save' clicked", async () => {
        const blockMocks = getBlockMocks(true, "Enable Auto Save");
        blockMocks.getDirectValue.mockReturnValueOnce("off");
        await workspaceUtils.handleAutoSaveOnError();
        expect(blockMocks.executeCommand).toHaveBeenCalledTimes(2);
        expect(blockMocks.executeCommand).toHaveBeenCalledWith("workbench.action.toggleAutoSave");
    });
});
