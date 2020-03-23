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
import { closeOpenedTextFile, checkTextFileIsOpened } from "../../../src/utils/workspace";

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
