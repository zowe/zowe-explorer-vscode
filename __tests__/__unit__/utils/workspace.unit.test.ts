import * as vscode from "vscode";
import { closeOpenedTextFile, checkTextFileIsOpened } from "../../../src/utils/workspace";
import { workspaceUtilMaxEmptyWindowsInTheRow } from "../../../src/config/constants";

jest.mock("vscode");

const activeTextEditor = jest.fn();
const executeCommand = jest.fn();

Object.defineProperty(vscode.window, "activeTextEditor", {get: activeTextEditor});
Object.defineProperty(vscode.commands, "executeCommand", {value: executeCommand});

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

describe("Workspace file status method", () => {
    afterEach(() => {
        activeTextEditor.mockReset();
        executeCommand.mockReset();
    });

    it("Runs correctly with no tabs available", async () => {
        const targetTextFile = "/doc";
        activeTextEditor.mockReturnValue(null);

        const result = await checkTextFileIsOpened(targetTextFile);
        expect(result).toBe(false);
        expect(executeCommand.mock.calls.map((call) => call[0])).toEqual(Array(workspaceUtilMaxEmptyWindowsInTheRow).fill("workbench.action.nextEditor"));
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
        activeTextEditor.mockImplementation(generateCycledMock(mockDocuments));

        const result = await checkTextFileIsOpened(targetTextFile);
        expect(result).toBe(true);
        expect(executeCommand.mock.calls.map((call) => call[0]))
            .toEqual(["workbench.action.nextEditor", "workbench.action.nextEditor", "workbench.action.nextEditor"]);
    });
    it("Runs correctly with tabs and target document available, but with non-text file opened", async () => {
        const targetTextFile = "/doc3";
        const mockDocuments = [
            {
                id: 1,
                document: {
                    fileName: "/doc1"
                }
            },
            null,
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
        activeTextEditor.mockImplementation(generateCycledMock(mockDocuments));

        const result = await checkTextFileIsOpened(targetTextFile);
        expect(result).toBe(true);
        expect(executeCommand.mock.calls.map((call) => call[0]))
            .toEqual(["workbench.action.nextEditor", "workbench.action.nextEditor", "workbench.action.nextEditor", "workbench.action.nextEditor"]);
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
        activeTextEditor.mockImplementation(generateCycledMock(mockDocuments));

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
        activeTextEditor.mockReturnValue(null);

        const result = await closeOpenedTextFile(targetTextFile);
        expect(result).toBe(false);
        expect(executeCommand.mock.calls.map((call) => call[0])).toEqual(Array(workspaceUtilMaxEmptyWindowsInTheRow).fill("workbench.action.nextEditor"));
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
        activeTextEditor.mockImplementation(generateCycledMock(mockDocuments));

        const result = await closeOpenedTextFile(targetTextFile);
        expect(result).toBe(true);
        expect(executeCommand.mock.calls.map((call) => call[0]))
            .toEqual(["workbench.action.nextEditor", "workbench.action.nextEditor", "workbench.action.closeActiveEditor"]);
    });
    it("Runs correctly with tabs and target document available, but with non-text file opened", async () => {
        const targetTextFile = "/doc3";
        const mockDocuments = [
            {
                id: 1,
                document: {
                    fileName: "/doc1"
                }
            },
            null,
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
        activeTextEditor.mockImplementation(generateCycledMock(mockDocuments));

        const result = await closeOpenedTextFile(targetTextFile);
        expect(result).toBe(true);
        expect(executeCommand.mock.calls.map((call) => call[0]))
            .toEqual(["workbench.action.nextEditor", "workbench.action.nextEditor", "workbench.action.nextEditor", "workbench.action.closeActiveEditor"]);
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
        activeTextEditor.mockImplementation(generateCycledMock(mockDocuments));

        const result = await closeOpenedTextFile(targetTextFile);
        expect(result).toBe(false);
        expect(executeCommand.mock.calls.map((call) => call[0]))
            .toEqual(["workbench.action.nextEditor", "workbench.action.nextEditor", "workbench.action.nextEditor"]);
    });
});
