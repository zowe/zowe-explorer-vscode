import * as vscode from "vscode";
import { closeOpenedTextFile, checkTextFileIsOpened } from "../../../src/utils/workspace";

jest.mock("vscode");

const activeTextEditor = jest.fn();
const executeCommand = jest.fn();

Object.defineProperty(vscode.window, "activeTextEditor", {get: activeTextEditor});
Object.defineProperty(vscode.commands, "executeCommand", {value: executeCommand});

describe("Checking Workspace file status method", () => {
    beforeEach(() => {
        activeTextEditor.mockReset();
        executeCommand.mockReset();
    });

    it("Tests if method runs correctly with no tabs available", async () => {
        const targetTextFile = "/doc";
        activeTextEditor.mockReturnValueOnce(null);

        const result = await checkTextFileIsOpened(targetTextFile);
        expect(result).toBe(false);
        expect(executeCommand.mock.calls.length).toBe(0);
    });
    it("Tests if method runs correctly with tabs and target document available", async () => {
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
    it("Tests if method runs correctly with tabs available but no target document opened", async () => {
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
describe("Checking Workspace file close method", () => {
    beforeEach(() => {
        activeTextEditor.mockReset();
        executeCommand.mockReset();
    });

    it("Tests if method runs correctly with no tabs available", async () => {
        const targetTextFile = "/doc";
        activeTextEditor.mockReturnValueOnce(null);

        const result = await closeOpenedTextFile(targetTextFile);
        expect(result).toBe(false);
        expect(executeCommand.mock.calls.length).toBe(0);
    });
    it("Tests if method runs correctly with tabs and target document available", async () => {
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
    it("Tests if method runs correctly with tabs available but no target document opened", async () => {
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
