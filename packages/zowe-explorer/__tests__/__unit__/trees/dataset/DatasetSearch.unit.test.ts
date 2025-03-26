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
import * as zosfiles from "@zowe/zos-files-for-zowe-sdk";
import { Gui, Table, TableBuilder, TableViewProvider, ZoweScheme } from "@zowe/zowe-explorer-api";
import { DatasetSearch } from "../../../../src/trees/dataset/DatasetSearch";
import { ZoweLogger } from "../../../../src/tools/ZoweLogger";
import { createIProfile, createISession } from "../../../__mocks__/mockCreators/shared";
import { createDatasetSessionNode } from "../../../__mocks__/mockCreators/datasets";
import { ZoweExplorerApiRegister } from "../../../../src/extending/ZoweExplorerApiRegister";
import { AuthUtils } from "../../../../src/utils/AuthUtils";
import { DatasetActions } from "../../../../src/trees/dataset/DatasetActions";
import { DatasetUtils } from "../../../../src/trees/dataset/DatasetUtils";
import { Constants } from "../../../../src/configuration/Constants";
import { ZoweDatasetNode } from "../../../../src/trees/dataset/ZoweDatasetNode";
import { DatasetFSProvider } from "../../../../src/trees/dataset/DatasetFSProvider";

jest.mock("fs");
jest.mock("vscode");
jest.mock("../../../../src/tools/ZoweLogger");

describe("Dataset Search Unit Tests - function search", () => {
    describe("Helper function - continueSearchPrompt", () => {
        let infoMessageSpy: jest.SpyInstance;

        beforeAll(() => {
            infoMessageSpy = jest.spyOn(Gui, "infoMessage");
        });

        beforeEach(() => {
            infoMessageSpy.mockReset();
        });

        afterAll(() => {
            infoMessageSpy.mockRestore();
        });

        it("should return true if there are under 50 data sets", async () => {
            let i = 1;
            const dataSets: zosfiles.IDataSet[] = [];
            while (i < 49) {
                dataSets.push({ dsn: "TEST.DATA.SET." + i.toString() });
                i++;
            }

            const result = await (DatasetSearch as any).continueSearchPrompt(dataSets);

            expect(infoMessageSpy).toHaveBeenCalledTimes(0);
            expect(result).toEqual(true);
        });

        it("should return true if the user responds with continue", async () => {
            let i = 1;
            const dataSets: zosfiles.IDataSet[] = [];
            while (i < 55) {
                dataSets.push({ dsn: "TEST.DATA.SET." + i.toString() });
                i++;
            }

            infoMessageSpy.mockResolvedValue("Continue");
            const result = await (DatasetSearch as any).continueSearchPrompt(dataSets);

            expect(infoMessageSpy).toHaveBeenCalledTimes(1);
            expect(result).toEqual(true);
        });

        it("should return false if the user responds with no", async () => {
            let i = 1;
            const dataSets: zosfiles.IDataSet[] = [];
            while (i < 55) {
                dataSets.push({ dsn: "TEST.DATA.SET." + i.toString() });
                i++;
            }

            infoMessageSpy.mockResolvedValue("No");
            const result = await (DatasetSearch as any).continueSearchPrompt(dataSets);

            expect(infoMessageSpy).toHaveBeenCalledTimes(1);
            expect(result).toEqual(false);
        });

        it("should return false if the user cancels", async () => {
            let i = 1;
            const dataSets: zosfiles.IDataSet[] = [];
            while (i < 55) {
                dataSets.push({ dsn: "TEST.DATA.SET." + i.toString() });
                i++;
            }

            infoMessageSpy.mockResolvedValue(undefined);
            const result = await (DatasetSearch as any).continueSearchPrompt(dataSets);

            expect(infoMessageSpy).toHaveBeenCalledTimes(1);
            expect(result).toEqual(false);
        });
    });
    describe("Helper function - performSearch", () => {
        const searchDataSetsMock = jest.fn();
        let getMvsApiSpy: jest.SpyInstance;
        let showMessageSpy: jest.SpyInstance;
        let reportProgressSpy: jest.SpyInstance;
        let continueSearchPromptSpy: jest.SpyInstance;
        let authErrorHandlingSpy: jest.SpyInstance;
        let loggerErrorSpy: jest.SpyInstance;

        const fakeMvsApi = {
            searchDataSets: searchDataSetsMock,
        };
        const token: vscode.CancellationToken = {
            isCancellationRequested: false,
            onCancellationRequested: jest.fn(),
        };

        beforeAll(() => {
            getMvsApiSpy = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue(fakeMvsApi as any);
            showMessageSpy = jest.spyOn(Gui, "showMessage").mockImplementation();
            reportProgressSpy = jest.spyOn(Gui, "reportProgress").mockImplementation();
            continueSearchPromptSpy = jest.spyOn(DatasetSearch as any, "continueSearchPrompt");
            authErrorHandlingSpy = jest.spyOn(AuthUtils, "errorHandling").mockImplementation();
            loggerErrorSpy = jest.spyOn(ZoweLogger, "error").mockImplementation();
        });

        beforeEach(() => {
            jest.clearAllMocks();
            searchDataSetsMock.mockReset();
        });

        afterAll(() => {
            jest.restoreAllMocks();
        });

        it("should show a message if cancellation was requested 1", async () => {
            const tokenCancellation: vscode.CancellationToken = {
                isCancellationRequested: true,
                onCancellationRequested: jest.fn(),
            };
            const myProgress = { test: "test" };
            const profile = createIProfile();
            const node = createDatasetSessionNode(createISession(), profile);

            await (DatasetSearch as any).performSearch(myProgress, tokenCancellation, { node, pattern: "TEST.*", searchString: "test" });

            expect(getMvsApiSpy).toHaveBeenCalledTimes(1);
            expect(showMessageSpy).toHaveBeenCalledTimes(1);
            expect(showMessageSpy).toHaveBeenCalledWith(DatasetActions.localizedStrings.opCancelled);
            expect(reportProgressSpy).not.toHaveBeenCalled();
            expect(searchDataSetsMock).not.toHaveBeenCalled();
            expect(continueSearchPromptSpy).not.toHaveBeenCalled();
            expect(authErrorHandlingSpy).not.toHaveBeenCalled();
            expect(loggerErrorSpy).not.toHaveBeenCalled();
        });

        it("should show a message if cancellation was requested 2", async () => {
            const tokenCancellation: vscode.CancellationToken = {
                isCancellationRequested: false,
                onCancellationRequested: jest.fn(),
            };
            const myProgress = { test: "test" };
            const profile = createIProfile();
            const node = createDatasetSessionNode(createISession(), profile);
            const taskExpected = { percentComplete: 0, stageName: 0, statusMessage: "" };

            searchDataSetsMock.mockImplementation((object) => {
                object.progressTask.percentComplete = 0;
                object.continueSearch([]);
                return Promise.resolve({ success: false, commandResponse: "The search was cancelled." });
            });

            await (DatasetSearch as any).performSearch(myProgress, tokenCancellation, { node, pattern: "TEST.*", searchString: "test" });

            expect(getMvsApiSpy).toHaveBeenCalledTimes(1);
            expect(showMessageSpy).not.toHaveBeenCalled();
            expect(reportProgressSpy).toHaveBeenCalledWith(myProgress, 100, 0, "");
            expect(searchDataSetsMock).toHaveBeenCalledWith({
                pattern: "TEST.*",
                searchString: "test",
                progressTask: taskExpected,
                mainframeSearch: false,
                continueSearch: expect.any(Function),
                abortSearch: expect.any(Function),
            });
            expect(continueSearchPromptSpy).toHaveBeenCalledTimes(1);
            expect(authErrorHandlingSpy).not.toHaveBeenCalled();
            expect(loggerErrorSpy).not.toHaveBeenCalled();
        });

        it("should perform the search and succeed", async () => {
            const myProgress = { test: "test" };
            const taskExpected = { percentComplete: 51, stageName: 0, statusMessage: "" };
            const profile = createIProfile();
            const node = createDatasetSessionNode(createISession(), profile);

            searchDataSetsMock.mockImplementation((object) => {
                object.progressTask.percentComplete = 51;
                object.continueSearch([]);
                return Promise.resolve({ success: true, apiResponse: { test: "test" } });
            });

            const response = await (DatasetSearch as any).performSearch(myProgress, token, { node, pattern: "TEST.*", searchString: "test" });

            expect(showMessageSpy).not.toHaveBeenCalled();
            expect(getMvsApiSpy).toHaveBeenCalledTimes(1);
            expect(searchDataSetsMock).toHaveBeenCalledWith({
                pattern: "TEST.*",
                searchString: "test",
                progressTask: taskExpected,
                mainframeSearch: false,
                continueSearch: expect.any(Function),
                abortSearch: expect.any(Function),
            });
            expect(authErrorHandlingSpy).not.toHaveBeenCalled();
            expect(loggerErrorSpy).not.toHaveBeenCalled();
            expect(reportProgressSpy).toHaveBeenCalledWith(myProgress, 100, 51, "");
            expect(continueSearchPromptSpy).toHaveBeenCalled();
            expect(response).toEqual({ success: true, apiResponse: { test: "test" } });
        });

        it("should perform the search and fail gracefully with a partial response", async () => {
            const myProgress = { test: "test" };
            const taskExpected = { percentComplete: 100, stageName: 0, statusMessage: "" };
            const profile = createIProfile();
            const node = createDatasetSessionNode(createISession(), profile);

            searchDataSetsMock.mockImplementation((object) => {
                object.progressTask.percentComplete = 100;
                object.continueSearch([]);
                return Promise.resolve({ errorMessage: "test error message", success: false, apiResponse: { test: "test" } });
            });

            const response = await (DatasetSearch as any).performSearch(myProgress, token, { node, pattern: "TEST.*", searchString: "test" });

            expect(showMessageSpy).not.toHaveBeenCalled();
            expect(getMvsApiSpy).toHaveBeenCalledTimes(1);
            expect(searchDataSetsMock).toHaveBeenCalledWith({
                pattern: "TEST.*",
                searchString: "test",
                progressTask: taskExpected,
                mainframeSearch: false,
                continueSearch: expect.any(Function),
                abortSearch: expect.any(Function),
            });
            expect(authErrorHandlingSpy).not.toHaveBeenCalled();
            expect(loggerErrorSpy).toHaveBeenCalledWith("test error message");
            expect(reportProgressSpy).toHaveBeenCalledWith(myProgress, 100, 100, "");
            expect(continueSearchPromptSpy).toHaveBeenCalledTimes(1);
            expect(response).toEqual({ errorMessage: "test error message", success: false, apiResponse: { test: "test" } });
        });

        it("should perform the search and fail - graceful failure", async () => {
            const myProgress = { test: "test" };
            const taskExpected = { percentComplete: 100, stageName: 0, statusMessage: "" };
            const profile = createIProfile();
            const node = createDatasetSessionNode(createISession(), profile);

            searchDataSetsMock.mockImplementation((object) => {
                object.progressTask.percentComplete = 100;
                object.continueSearch([]);
                return Promise.resolve({ errorMessage: "test error message", success: false, apiResponse: undefined });
            });

            const response = await (DatasetSearch as any).performSearch(myProgress, token, { node, pattern: "TEST.*", searchString: "test" });

            expect(showMessageSpy).not.toHaveBeenCalled();
            expect(getMvsApiSpy).toHaveBeenCalledTimes(1);
            expect(searchDataSetsMock).toHaveBeenCalledWith({
                pattern: "TEST.*",
                searchString: "test",
                progressTask: taskExpected,
                mainframeSearch: false,
                continueSearch: expect.any(Function),
                abortSearch: expect.any(Function),
            });
            expect(authErrorHandlingSpy).not.toHaveBeenCalled();
            expect(loggerErrorSpy).toHaveBeenCalledWith("test error message");
            expect(reportProgressSpy).toHaveBeenCalledWith(myProgress, 100, 100, "");
            expect(continueSearchPromptSpy).toHaveBeenCalled();
            expect(response).toEqual(undefined);
        });

        it("should perform the search and fail - catastrophic failure", async () => {
            const myProgress = { test: "test" };
            const taskExpected = { percentComplete: 51, stageName: 0, statusMessage: "" };
            const profile = createIProfile();
            const node = createDatasetSessionNode(createISession(), profile);
            const error = new Error("Catastrophic Failure");

            searchDataSetsMock.mockImplementation((object) => {
                object.progressTask.percentComplete = 51;
                object.continueSearch([]);
                return Promise.reject(error);
            });

            const response = await (DatasetSearch as any).performSearch(myProgress, token, { node, pattern: "TEST.*", searchString: "test" });

            expect(showMessageSpy).not.toHaveBeenCalled();
            expect(getMvsApiSpy).toHaveBeenCalledTimes(1);
            expect(searchDataSetsMock).toHaveBeenCalledWith({
                pattern: "TEST.*",
                searchString: "test",
                progressTask: taskExpected,
                mainframeSearch: false,
                continueSearch: expect.any(Function),
                abortSearch: expect.any(Function),
            });
            expect(authErrorHandlingSpy).toHaveBeenCalledWith(error);
            expect(loggerErrorSpy).not.toHaveBeenCalled();
            expect(reportProgressSpy).toHaveBeenCalledWith(myProgress, 100, 51, "");
            expect(continueSearchPromptSpy).toHaveBeenCalled();
            expect(response).toBeUndefined();
        });
    });
    describe("Helper function - getSearchMatches", () => {
        const searchString = "test";
        let getSessionNodeSpy: jest.SpyInstance;
        let getExtensionSpy: jest.SpyInstance;

        beforeAll(() => {
            getExtensionSpy = jest.spyOn(DatasetUtils, "getExtension");
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        afterAll(() => {
            jest.restoreAllMocks();
        });

        it("Should return matches from a response object - generateFullUri (pattern)", () => {
            const profile = createIProfile();
            const node = createDatasetSessionNode(createISession(), profile);
            const response = {
                apiResponse: [
                    {
                        dsn: "FAKE.TEST.DS",
                        member: undefined,
                        matchList: [
                            {
                                line: 1,
                                column: 1,
                                contents: "test",
                            },
                        ],
                    },
                    {
                        dsn: "FAKE.TEST.PDS",
                        member: "TEST1",
                        matchList: [
                            {
                                line: 1,
                                column: 1,
                                contents: "test",
                            },
                            {
                                line: 2,
                                column: 1,
                                contents: "test",
                            },
                        ],
                    },
                    {
                        dsn: "FAKE.TEST.JCL",
                        member: "TEST1",
                        matchList: [
                            {
                                line: 1,
                                column: 1,
                                contents: "test",
                            },
                        ],
                    },
                ],
            };
            const expectedMatches = [
                {
                    name: "FAKE.TEST.DS",
                    line: 1,
                    column: 1,
                    position: "1:1",
                    uri: "/sestest/sestest/FAKE.TEST.DS",
                    contents: "test",
                    searchString,
                },
                {
                    name: "FAKE.TEST.PDS(TEST1)",
                    line: 1,
                    column: 1,
                    position: "1:1",
                    uri: "/sestest/sestest/FAKE.TEST.PDS/TEST1",
                    contents: "test",
                    searchString,
                },
                {
                    name: "FAKE.TEST.PDS(TEST1)",
                    line: 2,
                    column: 1,
                    position: "2:1",
                    uri: "/sestest/sestest/FAKE.TEST.PDS/TEST1",
                    contents: "test",
                    searchString,
                },
                {
                    name: "FAKE.TEST.JCL(TEST1)",
                    line: 1,
                    column: 1,
                    position: "1:1",
                    uri: "/sestest/sestest/FAKE.TEST.JCL/TEST1.jcl",
                    contents: "test",
                    searchString,
                },
            ];

            getSessionNodeSpy = jest.spyOn(node, "getSessionNode");

            const matches = (DatasetSearch as any).getSearchMatches(node, response, true, searchString);

            expect(getSessionNodeSpy).toHaveBeenCalledTimes(3);
            expect(getExtensionSpy).toHaveBeenCalledTimes(3);
            expect(getExtensionSpy).toHaveReturnedWith(".jcl");

            expect(matches).toEqual(expectedMatches);
        });
        it("Should return matches from a response object - no generateFullUri (pds)", () => {
            const profile = createIProfile();
            const node = createDatasetSessionNode(createISession(), profile);
            const pdsNode = new ZoweDatasetNode({
                label: "FAKE.TEST.PDS",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                contextOverride: Constants.DS_PDS_CONTEXT,
                profile,
                parentNode: node,
            });
            const response = {
                apiResponse: [
                    {
                        dsn: "FAKE.TEST.PDS",
                        member: "TEST1",
                        matchList: [
                            {
                                line: 1,
                                column: 1,
                                contents: "test",
                            },
                        ],
                    },
                    {
                        dsn: "FAKE.TEST.PDS",
                        member: "TEST2",
                        matchList: [
                            {
                                line: 1,
                                column: 1,
                                contents: "test",
                            },
                            {
                                line: 2,
                                column: 1,
                                contents: "test",
                            },
                        ],
                    },
                    {
                        dsn: "FAKE.TEST.PDS",
                        member: "TEST3",
                        matchList: [
                            {
                                line: 1,
                                column: 1,
                                contents: "test",
                            },
                        ],
                    },
                ],
            };
            const expectedMatches = [
                {
                    name: "FAKE.TEST.PDS(TEST1)",
                    line: 1,
                    column: 1,
                    position: "1:1",
                    uri: "/sestest/FAKE.TEST.PDS/TEST1",
                    contents: "test",
                    searchString,
                },
                {
                    name: "FAKE.TEST.PDS(TEST2)",
                    line: 1,
                    column: 1,
                    position: "1:1",
                    uri: "/sestest/FAKE.TEST.PDS/TEST2",
                    contents: "test",
                    searchString,
                },
                {
                    name: "FAKE.TEST.PDS(TEST2)",
                    line: 2,
                    column: 1,
                    position: "2:1",
                    uri: "/sestest/FAKE.TEST.PDS/TEST2",
                    contents: "test",
                    searchString,
                },
                {
                    name: "FAKE.TEST.PDS(TEST3)",
                    line: 1,
                    column: 1,
                    position: "1:1",
                    uri: "/sestest/FAKE.TEST.PDS/TEST3",
                    contents: "test",
                    searchString,
                },
            ];

            getSessionNodeSpy = jest.spyOn(node, "getSessionNode");

            const matches = (DatasetSearch as any).getSearchMatches(pdsNode, response, false, searchString);

            expect(getSessionNodeSpy).toHaveBeenCalledTimes(0);
            expect(getExtensionSpy).toHaveBeenCalledTimes(3);
            expect(getExtensionSpy).not.toHaveReturnedWith(".jcl");

            expect(matches).toEqual(expectedMatches);
        });
        it("Should return matches from a response object - no generateFullUri (pds w/ JCL)", () => {
            const profile = createIProfile();
            const node = createDatasetSessionNode(createISession(), profile);
            const pdsNode = new ZoweDatasetNode({
                label: "FAKE.TEST.JCL",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                contextOverride: Constants.DS_PDS_CONTEXT,
                profile,
                parentNode: node,
            });
            const response = {
                apiResponse: [
                    {
                        dsn: "FAKE.TEST.JCL",
                        member: "TEST1",
                        matchList: [
                            {
                                line: 1,
                                column: 1,
                                contents: "test",
                            },
                        ],
                    },
                    {
                        dsn: "FAKE.TEST.JCL",
                        member: "TEST2",
                        matchList: [
                            {
                                line: 1,
                                column: 1,
                                contents: "test",
                            },
                            {
                                line: 2,
                                column: 1,
                                contents: "test",
                            },
                        ],
                    },
                    {
                        dsn: "FAKE.TEST.JCL",
                        member: "TEST3",
                        matchList: [
                            {
                                line: 1,
                                column: 1,
                                contents: "test",
                            },
                        ],
                    },
                ],
            };
            const expectedMatches = [
                {
                    name: "FAKE.TEST.JCL(TEST1)",
                    line: 1,
                    column: 1,
                    position: "1:1",
                    uri: "/sestest/FAKE.TEST.JCL/TEST1.jcl",
                    contents: "test",
                    searchString,
                },
                {
                    name: "FAKE.TEST.JCL(TEST2)",
                    line: 1,
                    column: 1,
                    position: "1:1",
                    uri: "/sestest/FAKE.TEST.JCL/TEST2.jcl",
                    contents: "test",
                    searchString,
                },
                {
                    name: "FAKE.TEST.JCL(TEST2)",
                    line: 2,
                    column: 1,
                    position: "2:1",
                    uri: "/sestest/FAKE.TEST.JCL/TEST2.jcl",
                    contents: "test",
                    searchString,
                },
                {
                    name: "FAKE.TEST.JCL(TEST3)",
                    line: 1,
                    column: 1,
                    position: "1:1",
                    uri: "/sestest/FAKE.TEST.JCL/TEST3.jcl",
                    contents: "test",
                    searchString,
                },
            ];

            getSessionNodeSpy = jest.spyOn(node, "getSessionNode");

            const matches = (DatasetSearch as any).getSearchMatches(pdsNode, response, false, searchString);

            expect(getSessionNodeSpy).toHaveBeenCalledTimes(0);
            expect(getExtensionSpy).toHaveBeenCalledTimes(3);
            expect(getExtensionSpy).toHaveReturnedWith(".jcl");

            expect(matches).toEqual(expectedMatches);
        });
    });
    describe("Helper function - openSearchAtLocation", () => {
        let fakeEditor = { selection: undefined };
        let dsFsProviderSpy: jest.SpyInstance;
        let guiShowTextDocumentSpy: jest.SpyInstance;
        let errorMessageSpy: jest.SpyInstance;

        beforeAll(() => {
            dsFsProviderSpy = jest.spyOn(DatasetFSProvider.instance, "remoteLookupForResource").mockImplementation();
            guiShowTextDocumentSpy = jest.spyOn(Gui, "showTextDocument");
            errorMessageSpy = jest.spyOn(Gui, "errorMessage");
        });

        beforeEach(() => {
            jest.clearAllMocks();
            fakeEditor = { selection: undefined };
            guiShowTextDocumentSpy.mockResolvedValue(fakeEditor as any);
        });

        afterAll(() => {
            jest.restoreAllMocks();
        });

        it("should try to open one text document", async () => {
            const data = {
                1: {
                    uri: `/test/ZOWE.TEST.T1.DS`,
                    line: 1,
                    column: 1,
                    searchString: "test",
                },
            };

            await (DatasetSearch as any).openSearchAtLocation(null, data);

            expect(dsFsProviderSpy).toHaveBeenCalledTimes(1);
            expect(guiShowTextDocumentSpy).toHaveBeenCalledTimes(1);
            expect(errorMessageSpy).not.toHaveBeenCalled();

            expect(guiShowTextDocumentSpy).toHaveBeenCalledWith(vscode.Uri.from({ scheme: ZoweScheme.DS, path: data[1].uri }), { preview: false });
            expect(fakeEditor.selection).toEqual(new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 4)));
        });

        it("should try to open multiple text documents", async () => {
            const data = {};
            let i = 1;
            while (i < 10) {
                data[i] = {
                    uri: `/test/ZOWE.TEST.T${i}.DS`,
                    line: 1,
                    column: 1,
                    searchString: "test",
                };
                i++;
                data[i] = {
                    uri: `/test/ZOWE.TEST.T${i}.PDS/MEMBER`,
                    line: 1,
                    column: 1,
                    searchString: "test",
                };
                i++;
            }

            await (DatasetSearch as any).openSearchAtLocation(null, data);

            expect(dsFsProviderSpy).toHaveBeenCalledTimes(10);
            expect(guiShowTextDocumentSpy).toHaveBeenCalledTimes(10);
            expect(errorMessageSpy).not.toHaveBeenCalled();

            i = 1;
            while (i < 10) {
                expect(guiShowTextDocumentSpy).toHaveBeenCalledWith(vscode.Uri.from({ scheme: ZoweScheme.DS, path: data[i].uri }), {
                    preview: false,
                });
                i++;
            }
            expect(fakeEditor.selection).toEqual(new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 4)));
        });

        it("should do nothing if we try to open zero documents", async () => {
            const data = {};

            await (DatasetSearch as any).openSearchAtLocation(null, data);

            expect(dsFsProviderSpy).not.toHaveBeenCalled();
            expect(guiShowTextDocumentSpy).not.toHaveBeenCalled();
            expect(errorMessageSpy).not.toHaveBeenCalled();

            expect(fakeEditor.selection).toEqual(undefined);
        });

        it("should gracefully handle an error and display the rest", async () => {
            const data = {};
            let i = 1;
            while (i < 10) {
                data[i] = {
                    uri: `/test/ZOWE.TEST.T${i}.DS`,
                    line: 1,
                    column: 1,
                    searchString: "test",
                };
                i++;
                data[i] = {
                    uri: `/test/ZOWE.TEST.T${i}.PDS/MEMBER`,
                    line: 1,
                    column: 1,
                    searchString: "test",
                };
                i++;
            }

            guiShowTextDocumentSpy.mockRejectedValueOnce({ message: "Mock Rejection" });

            await (DatasetSearch as any).openSearchAtLocation(null, data);

            expect(dsFsProviderSpy).toHaveBeenCalledTimes(10);
            expect(guiShowTextDocumentSpy).toHaveBeenCalledTimes(10);
            expect(errorMessageSpy).toHaveBeenCalledTimes(1);

            i = 1;
            while (i < 10) {
                expect(guiShowTextDocumentSpy).toHaveBeenCalledWith(vscode.Uri.from({ scheme: ZoweScheme.DS, path: data[i].uri }), {
                    preview: false,
                });
                i++;
            }
            expect(errorMessageSpy).toHaveBeenCalledWith("Mock Rejection");
            expect(fakeEditor.selection).toEqual(new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 4)));
        });
    });
    describe("Main function - search", () => {
        let tableViewProviderSetTableViewMock = jest.fn();
        let tableViewProviderSpy: jest.SpyInstance;
        let openSearchAtLocationSpy: jest.SpyInstance;
        let getSearchMatchesSpy: jest.SpyInstance;
        let performSearchSpy: jest.SpyInstance;
        let withProgressSpy: jest.SpyInstance;
        let showMessageSpy: jest.SpyInstance;
        let showInputBoxSpy: jest.SpyInstance;
        let showQuickPickSpy: jest.SpyInstance;
        let errorMessageSpy: jest.SpyInstance;
        let tableBuilderOptionsSpy: jest.SpyInstance;
        let tableBuilderTitleSpy: jest.SpyInstance;
        let tableBuilderIsViewSpy: jest.SpyInstance;
        let tableBuilderRowsSpy: jest.SpyInstance;
        let tableBuilderColumnsSpy: jest.SpyInstance;
        let tableBuilderAddRowActionSpy: jest.SpyInstance;
        let tableBuilderBuildSpy: jest.SpyInstance;

        function quickPickPositiveExpect() {
            expect(showQuickPickSpy).toHaveBeenCalledWith(
                [
                    {
                        label: vscode.l10n.t("Case Sensitive"),
                        description: vscode.l10n.t("Perform the search with case sensitivity"),
                        iconPath: new vscode.ThemeIcon("case-sensitive"),
                    },
                ],
                {
                    title: vscode.l10n.t("Search Options"),
                    placeHolder: vscode.l10n.t("Select search options"),
                    ignoreFocusOut: true,
                    canPickMany: true,
                }
            );
        }

        beforeAll(() => {
            tableViewProviderSetTableViewMock = jest.fn();
            tableViewProviderSpy = jest
                .spyOn(TableViewProvider, "getInstance")
                .mockReturnValue({ setTableView: tableViewProviderSetTableViewMock } as any);
            openSearchAtLocationSpy = jest.spyOn(DatasetSearch as any, "openSearchAtLocation");
            getSearchMatchesSpy = jest.spyOn(DatasetSearch as any, "getSearchMatches");
            performSearchSpy = jest.spyOn(DatasetSearch as any, "performSearch");
            withProgressSpy = jest.spyOn(Gui, "withProgress");
            showMessageSpy = jest.spyOn(Gui, "showMessage").mockImplementation();
            errorMessageSpy = jest.spyOn(Gui, "errorMessage").mockImplementation();
            showInputBoxSpy = jest.spyOn(Gui, "showInputBox");
            showQuickPickSpy = jest.spyOn(Gui, "showQuickPick");
            tableBuilderOptionsSpy = jest.spyOn(TableBuilder.prototype, "options").mockReturnValue(TableBuilder.prototype);
            tableBuilderTitleSpy = jest.spyOn(TableBuilder.prototype, "title").mockReturnValue(TableBuilder.prototype);
            tableBuilderIsViewSpy = jest.spyOn(TableBuilder.prototype, "isView").mockReturnValue(TableBuilder.prototype);
            tableBuilderRowsSpy = jest.spyOn(TableBuilder.prototype, "rows").mockReturnValue(TableBuilder.prototype);
            tableBuilderColumnsSpy = jest.spyOn(TableBuilder.prototype, "columns").mockReturnValue(TableBuilder.prototype);
            tableBuilderAddRowActionSpy = jest.spyOn(TableBuilder.prototype, "addRowAction").mockReturnValue(TableBuilder.prototype);
            tableBuilderBuildSpy = jest.spyOn(TableBuilder.prototype, "build").mockImplementation();
        });

        beforeEach(() => {
            jest.clearAllMocks();
            tableViewProviderSetTableViewMock = jest.fn();
            tableViewProviderSpy = jest
                .spyOn(TableViewProvider, "getInstance")
                .mockReturnValue({ setTableView: tableViewProviderSetTableViewMock } as any);
        });

        afterAll(() => {
            jest.restoreAllMocks();
        });

        it("should fail to perform a search (no pattern on session node)", async () => {
            const profile = createIProfile();
            const node = createDatasetSessionNode(createISession(), profile);
            node.pattern = "";
            const context = { context: "fake" } as any;

            await DatasetSearch.search(context, node);

            expect(errorMessageSpy).toHaveBeenCalledWith("No search pattern applied. Search for a pattern and try again.");
            expect(showMessageSpy).not.toHaveBeenCalled();
            expect(showQuickPickSpy).not.toHaveBeenCalled();
            expect(performSearchSpy).not.toHaveBeenCalled();
            expect(getSearchMatchesSpy).not.toHaveBeenCalled();
            expect(tableViewProviderSpy).not.toHaveBeenCalled();
            expect(openSearchAtLocationSpy).not.toHaveBeenCalled();
            expect(withProgressSpy).not.toHaveBeenCalled();
            expect(tableBuilderTitleSpy).not.toHaveBeenCalled();
        });

        it("should fail to perform a search if the user does not specify a search string", async () => {
            const profile = createIProfile();
            const node = createDatasetSessionNode(createISession(), profile);
            node.pattern = "FAKE.*.DS";
            const context = { context: "fake" } as any;

            showInputBoxSpy.mockResolvedValue("");

            await DatasetSearch.search(context, node);

            expect(errorMessageSpy).not.toHaveBeenCalled();
            expect(showInputBoxSpy).toHaveBeenCalledWith({ prompt: "Enter the text to search for." });
            expect(showQuickPickSpy).not.toHaveBeenCalled();
            expect(performSearchSpy).not.toHaveBeenCalled();
            expect(getSearchMatchesSpy).not.toHaveBeenCalled();
            expect(tableViewProviderSpy).not.toHaveBeenCalled();
            expect(openSearchAtLocationSpy).not.toHaveBeenCalled();
            expect(withProgressSpy).not.toHaveBeenCalled();
            expect(tableBuilderTitleSpy).not.toHaveBeenCalled();
        });

        it("should fail to perform a search if the user does not specify search case sensitivity", async () => {
            const profile = createIProfile();
            const node = createDatasetSessionNode(createISession(), profile);
            node.pattern = "FAKE.*.DS";
            const context = { context: "fake" } as any;
            const searchString = "test";

            showInputBoxSpy.mockResolvedValue(searchString);
            showQuickPickSpy.mockResolvedValue(undefined);

            await DatasetSearch.search(context, node);

            expect(errorMessageSpy).not.toHaveBeenCalled();
            expect(showInputBoxSpy).toHaveBeenCalledWith({ prompt: "Enter the text to search for." });
            quickPickPositiveExpect();
            expect(performSearchSpy).not.toHaveBeenCalled();
            expect(getSearchMatchesSpy).not.toHaveBeenCalled();
            expect(tableViewProviderSpy).not.toHaveBeenCalled();
            expect(openSearchAtLocationSpy).not.toHaveBeenCalled();
            expect(withProgressSpy).not.toHaveBeenCalled();
            expect(tableBuilderTitleSpy).not.toHaveBeenCalled();
        });

        it("should fail to perform a search if the user responds no to the prompt", async () => {
            const profile = createIProfile();
            const node = createDatasetSessionNode(createISession(), profile);
            node.pattern = "FAKE.*.DS";
            const context = { context: "fake" } as any;
            const searchString = "test";

            const tokenCancellation: vscode.CancellationToken = {
                isCancellationRequested: false,
                onCancellationRequested: jest.fn(),
            };
            const myProgress = { test: "test" };

            showInputBoxSpy.mockResolvedValue(searchString);
            showQuickPickSpy.mockResolvedValue([]);
            withProgressSpy.mockImplementation((opts: any, fn: any) => {
                return fn(myProgress, tokenCancellation);
            });
            performSearchSpy.mockResolvedValue(undefined);

            await DatasetSearch.search(context, node);

            expect(errorMessageSpy).not.toHaveBeenCalled();
            expect(showInputBoxSpy).toHaveBeenCalledWith({ prompt: "Enter the text to search for." });
            quickPickPositiveExpect();
            expect(showMessageSpy).not.toHaveBeenCalled();
            expect(performSearchSpy).toHaveBeenCalledTimes(1);
            expect(getSearchMatchesSpy).not.toHaveBeenCalled();
            expect(tableViewProviderSpy).not.toHaveBeenCalled();
            expect(openSearchAtLocationSpy).not.toHaveBeenCalled();
            expect(withProgressSpy.mock.calls[0][0]).toEqual({
                location: vscode.ProgressLocation.Notification,
                title: 'Searching for "test"',
                cancellable: true,
            });
            expect(tableBuilderTitleSpy).not.toHaveBeenCalled();
        });

        it("should attempt to perform the search (session node)", async () => {
            const profile = createIProfile();
            const node = createDatasetSessionNode(createISession(), profile);
            node.pattern = "FAKE.*.DS";
            const context = { context: "fake" } as any;
            const searchString = "test";

            const expectedResponse = {
                success: true,
                apiResponse: [
                    {
                        dsn: "FAKE.DATA.SET.DS",
                        member: undefined,
                        matchList: [
                            {
                                line: 1,
                                column: 1,
                                contents: "test",
                            },
                        ],
                    },
                ],
            };
            const expectedMatches = [
                {
                    name: "FAKE.DATA.SET.DS",
                    line: 1,
                    column: 1,
                    position: "1:1",
                    contents: "test",
                    uri: "/test/FAKE.DATA.SET.DS",
                    searchString,
                },
            ];
            const tokenCancellation: vscode.CancellationToken = {
                isCancellationRequested: false,
                onCancellationRequested: jest.fn(),
            };
            const myProgress = { test: "test" };

            showInputBoxSpy.mockResolvedValue(searchString);
            showQuickPickSpy.mockResolvedValue([]);
            withProgressSpy.mockImplementation((opts: any, fn: any) => {
                return fn(myProgress, tokenCancellation);
            });
            getSearchMatchesSpy.mockReturnValue(expectedMatches);
            performSearchSpy.mockResolvedValue(expectedResponse);

            await DatasetSearch.search(context, node);

            expect(errorMessageSpy).not.toHaveBeenCalled();
            expect(showInputBoxSpy).toHaveBeenCalledWith({ prompt: "Enter the text to search for." });
            quickPickPositiveExpect();
            expect(showMessageSpy).not.toHaveBeenCalled();

            expect(withProgressSpy.mock.calls[0][0]).toEqual({
                location: vscode.ProgressLocation.Notification,
                title: 'Searching for "test"',
                cancellable: true,
            });

            expect(getSearchMatchesSpy).toHaveBeenCalledWith(node, expectedResponse, true, searchString);

            expect(performSearchSpy).toHaveBeenCalledTimes(1);
            expect(performSearchSpy).toHaveBeenCalledWith(myProgress, tokenCancellation, {
                node,
                pattern: node.pattern,
                searchString,
                caseSensitive: false,
            });
            expect(openSearchAtLocationSpy).not.toHaveBeenCalled();

            expect(tableBuilderTitleSpy).toHaveBeenCalledWith('Search Results for "test"');
            expect(tableBuilderOptionsSpy).toHaveBeenCalledWith({
                autoSizeStrategy: { type: "fitCellContents" },
                pagination: true,
                rowSelection: "multiple",
                selectEverything: true,
                suppressRowClickSelection: true,
            });
            expect(tableBuilderIsViewSpy).toHaveBeenCalledTimes(1);
            expect(tableBuilderRowsSpy).toHaveBeenCalledWith(...expectedMatches);
            expect(tableBuilderColumnsSpy).toHaveBeenCalledWith(
                ...[
                    {
                        field: "name",
                        headerName: vscode.l10n.t("Data Set Name"),
                        filter: true,
                        initialSort: "asc",
                    } as Table.ColumnOpts,
                    {
                        field: "position",
                        headerName: vscode.l10n.t("Position"),
                        filter: false,
                    },
                    {
                        field: "contents",
                        headerName: vscode.l10n.t("Contents"),
                        filter: true,
                    },
                    {
                        field: "actions",
                        hide: true,
                    },
                ]
            );
            expect(tableBuilderAddRowActionSpy).toHaveBeenCalledWith("all", {
                title: vscode.l10n.t("Open"),
                command: "open",
                callback: {
                    fn: (DatasetSearch as any).openSearchAtLocation,
                    typ: "multi-row",
                },
                type: "secondary",
            });
            expect(tableBuilderBuildSpy).toHaveBeenCalledTimes(1);
            expect(tableViewProviderSpy).toHaveBeenCalledTimes(1);
            expect(tableViewProviderSetTableViewMock).toHaveBeenCalledTimes(1);
        });
        it("should attempt to perform the search (pds node)", async () => {
            const profile = createIProfile();
            const node = createDatasetSessionNode(createISession(), profile);
            const pdsNode = new ZoweDatasetNode({
                label: "FAKE.DATA.SET.PDS",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                parentNode: node,
            });
            pdsNode.contextValue = Constants.DS_PDS_CONTEXT;
            node.pattern = "FAKE.*.PDS";
            const context = { context: "fake" } as any;
            const searchString = "test";

            const expectedResponse = {
                success: true,
                apiResponse: [
                    {
                        dsn: "FAKE.DATA.SET.PDS",
                        member: "MEM1",
                        matchList: [
                            {
                                line: 1,
                                column: 1,
                                contents: "test",
                            },
                        ],
                    },
                    {
                        dsn: "FAKE.DATA.SET.PDS",
                        member: "MEM2",
                        matchList: [
                            {
                                line: 1,
                                column: 1,
                                contents: "test",
                            },
                        ],
                    },
                ],
            };
            const expectedMatches = [
                {
                    name: "FAKE.DATA.SET.PDS(MEM1)",
                    line: 1,
                    column: 1,
                    position: "1:1",
                    contents: "test",
                    uri: "/test/FAKE.DATA.SET.PDS/MEM1",
                    searchString,
                },
                {
                    name: "FAKE.DATA.SET.PDS(MEM2)",
                    line: 1,
                    column: 1,
                    position: "1:1",
                    contents: "test",
                    uri: "/test/FAKE.DATA.SET.PDS/MEM2",
                    searchString,
                },
            ];

            const tokenCancellation: vscode.CancellationToken = {
                isCancellationRequested: false,
                onCancellationRequested: jest.fn(),
            };
            const myProgress = { test: "test" };

            showInputBoxSpy.mockResolvedValue(searchString);
            showQuickPickSpy.mockResolvedValue([]);
            withProgressSpy.mockImplementation((opts: any, fn: any) => {
                return fn(myProgress, tokenCancellation);
            });
            getSearchMatchesSpy.mockReturnValue(expectedMatches);
            performSearchSpy.mockResolvedValue(expectedResponse);

            await DatasetSearch.search(context, pdsNode);

            expect(errorMessageSpy).not.toHaveBeenCalled();
            expect(showInputBoxSpy).toHaveBeenCalledWith({ prompt: "Enter the text to search for." });
            quickPickPositiveExpect();
            expect(showMessageSpy).not.toHaveBeenCalled();

            expect(withProgressSpy.mock.calls[0][0]).toEqual({
                location: vscode.ProgressLocation.Notification,
                title: 'Searching for "test"',
                cancellable: true,
            });

            expect(getSearchMatchesSpy).toHaveBeenCalledWith(pdsNode, expectedResponse, false, searchString);

            expect(performSearchSpy).toHaveBeenCalledTimes(1);
            expect(performSearchSpy).toHaveBeenCalledWith(myProgress, tokenCancellation, {
                node: pdsNode,
                pattern: pdsNode.label,
                searchString,
                caseSensitive: false,
            });
            expect(openSearchAtLocationSpy).not.toHaveBeenCalled();

            expect(tableBuilderTitleSpy).toHaveBeenCalledWith('Search Results for "test"');
            expect(tableBuilderOptionsSpy).toHaveBeenCalledWith({
                autoSizeStrategy: { type: "fitCellContents" },
                pagination: true,
                rowSelection: "multiple",
                selectEverything: true,
                suppressRowClickSelection: true,
            });
            expect(tableBuilderIsViewSpy).toHaveBeenCalledTimes(1);
            expect(tableBuilderRowsSpy).toHaveBeenCalledWith(...expectedMatches);
            expect(tableBuilderColumnsSpy).toHaveBeenCalledWith(
                ...[
                    {
                        field: "name",
                        headerName: vscode.l10n.t("Data Set Name"),
                        filter: true,
                        initialSort: "asc",
                    } as Table.ColumnOpts,
                    {
                        field: "position",
                        headerName: vscode.l10n.t("Position"),
                        filter: false,
                    },
                    {
                        field: "contents",
                        headerName: vscode.l10n.t("Contents"),
                        filter: true,
                    },
                    {
                        field: "actions",
                        hide: true,
                    },
                ]
            );
            expect(tableBuilderAddRowActionSpy).toHaveBeenCalledWith("all", {
                title: vscode.l10n.t("Open"),
                command: "open",
                callback: {
                    fn: (DatasetSearch as any).openSearchAtLocation,
                    typ: "multi-row",
                },
                type: "secondary",
            });
            expect(tableBuilderBuildSpy).toHaveBeenCalledTimes(1);
            expect(tableViewProviderSpy).toHaveBeenCalledTimes(1);
            expect(tableViewProviderSetTableViewMock).toHaveBeenCalledTimes(1);
        });

        it("should attempt to perform the search (favorited session node)", async () => {
            const profile = createIProfile();
            const node = createDatasetSessionNode(createISession(), profile);
            node.pattern = "FAKE.*.DS";
            node.contextValue = Constants.DS_SESSION_FAV_CONTEXT;
            const context = { context: "fake" } as any;
            const searchString = "test";

            const expectedResponse = {
                success: true,
                apiResponse: [
                    {
                        dsn: "FAKE.DATA.SET.DS",
                        member: undefined,
                        matchList: [
                            {
                                line: 1,
                                column: 1,
                                contents: "test",
                            },
                        ],
                    },
                ],
            };
            const expectedMatches = [
                {
                    name: "FAKE.DATA.SET.DS",
                    line: 1,
                    column: 1,
                    position: "1:1",
                    contents: "test",
                    uri: "/test/FAKE.DATA.SET.DS",
                    searchString,
                },
            ];

            const tokenCancellation: vscode.CancellationToken = {
                isCancellationRequested: false,
                onCancellationRequested: jest.fn(),
            };
            const myProgress = { test: "test" };

            showInputBoxSpy.mockResolvedValue(searchString);
            showQuickPickSpy.mockResolvedValue([]);
            withProgressSpy.mockImplementation((opts: any, fn: any) => {
                return fn(myProgress, tokenCancellation);
            });
            getSearchMatchesSpy.mockReturnValue(expectedMatches);
            performSearchSpy.mockResolvedValue(expectedResponse);

            await DatasetSearch.search(context, node);

            expect(errorMessageSpy).not.toHaveBeenCalled();
            expect(showInputBoxSpy).toHaveBeenCalledWith({ prompt: "Enter the text to search for." });
            quickPickPositiveExpect();
            expect(showMessageSpy).not.toHaveBeenCalled();

            expect(withProgressSpy.mock.calls[0][0]).toEqual({
                location: vscode.ProgressLocation.Notification,
                title: 'Searching for "test"',
                cancellable: true,
            });

            expect(getSearchMatchesSpy).toHaveBeenCalledWith(node, expectedResponse, true, searchString);

            expect(performSearchSpy).toHaveBeenCalledTimes(1);
            expect(performSearchSpy).toHaveBeenCalledWith(myProgress, tokenCancellation, {
                node,
                pattern: node.label,
                searchString,
                caseSensitive: false,
            });
            expect(openSearchAtLocationSpy).not.toHaveBeenCalled();

            expect(tableBuilderTitleSpy).toHaveBeenCalledWith('Search Results for "test"');
            expect(tableBuilderOptionsSpy).toHaveBeenCalledWith({
                autoSizeStrategy: { type: "fitCellContents" },
                pagination: true,
                rowSelection: "multiple",
                selectEverything: true,
                suppressRowClickSelection: true,
            });
            expect(tableBuilderIsViewSpy).toHaveBeenCalledTimes(1);
            expect(tableBuilderRowsSpy).toHaveBeenCalledWith(...expectedMatches);
            expect(tableBuilderColumnsSpy).toHaveBeenCalledWith(
                ...[
                    {
                        field: "name",
                        headerName: vscode.l10n.t("Data Set Name"),
                        filter: true,
                        initialSort: "asc",
                    } as Table.ColumnOpts,
                    {
                        field: "position",
                        headerName: vscode.l10n.t("Position"),
                        filter: false,
                    },
                    {
                        field: "contents",
                        headerName: vscode.l10n.t("Contents"),
                        filter: true,
                    },
                    {
                        field: "actions",
                        hide: true,
                    },
                ]
            );
            expect(tableBuilderAddRowActionSpy).toHaveBeenCalledWith("all", {
                title: vscode.l10n.t("Open"),
                command: "open",
                callback: {
                    fn: (DatasetSearch as any).openSearchAtLocation,
                    typ: "multi-row",
                },
                type: "secondary",
            });
            expect(tableBuilderBuildSpy).toHaveBeenCalledTimes(1);
            expect(tableViewProviderSpy).toHaveBeenCalledTimes(1);
            expect(tableViewProviderSetTableViewMock).toHaveBeenCalledTimes(1);
        });

        it("should attempt to perform the search (favorited pds node)", async () => {
            const profile = createIProfile();
            const node = createDatasetSessionNode(createISession(), profile);
            const pdsNode = new ZoweDatasetNode({
                label: "FAKE.DATA.SET.PDS",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                parentNode: node,
            });
            pdsNode.contextValue = Constants.PDS_FAV_CONTEXT;
            node.pattern = "FAKE.*.PDS";
            node.contextValue = Constants.DS_SESSION_FAV_CONTEXT;
            const context = { context: "fake" } as any;
            const searchString = "test";

            const expectedResponse = {
                success: true,
                apiResponse: [
                    {
                        dsn: "FAKE.DATA.SET.PDS",
                        member: "MEM1",
                        matchList: [
                            {
                                line: 1,
                                column: 1,
                                contents: "test",
                            },
                        ],
                    },
                    {
                        dsn: "FAKE.DATA.SET.PDS",
                        member: "MEM2",
                        matchList: [
                            {
                                line: 1,
                                column: 1,
                                contents: "test",
                            },
                        ],
                    },
                ],
            };
            const expectedMatches = [
                {
                    name: "FAKE.DATA.SET.PDS(MEM1)",
                    line: 1,
                    column: 1,
                    position: "1:1",
                    contents: "test",
                    uri: "/test/FAKE.DATA.SET.PDS/MEM1",
                    searchString,
                },
                {
                    name: "FAKE.DATA.SET.PDS(MEM2)",
                    line: 1,
                    column: 1,
                    position: "1:1",
                    contents: "test",
                    uri: "/test/FAKE.DATA.SET.PDS/MEM2",
                    searchString,
                },
            ];

            const tokenCancellation: vscode.CancellationToken = {
                isCancellationRequested: false,
                onCancellationRequested: jest.fn(),
            };
            const myProgress = { test: "test" };

            showInputBoxSpy.mockResolvedValue(searchString);
            showQuickPickSpy.mockResolvedValue([]);
            withProgressSpy.mockImplementation((opts: any, fn: any) => {
                return fn(myProgress, tokenCancellation);
            });
            getSearchMatchesSpy.mockReturnValue(expectedMatches);
            performSearchSpy.mockResolvedValue(expectedResponse);

            await DatasetSearch.search(context, pdsNode);

            expect(errorMessageSpy).not.toHaveBeenCalled();
            expect(showInputBoxSpy).toHaveBeenCalledWith({ prompt: "Enter the text to search for." });
            quickPickPositiveExpect();
            expect(showMessageSpy).not.toHaveBeenCalled();

            expect(withProgressSpy.mock.calls[0][0]).toEqual({
                location: vscode.ProgressLocation.Notification,
                title: 'Searching for "test"',
                cancellable: true,
            });

            expect(getSearchMatchesSpy).toHaveBeenCalledWith(pdsNode, expectedResponse, false, searchString);

            expect(performSearchSpy).toHaveBeenCalledTimes(1);
            expect(performSearchSpy).toHaveBeenCalledWith(myProgress, tokenCancellation, {
                node: pdsNode,
                pattern: pdsNode.label,
                searchString,
                caseSensitive: false,
            });
            expect(openSearchAtLocationSpy).not.toHaveBeenCalled();

            expect(tableBuilderTitleSpy).toHaveBeenCalledWith('Search Results for "test"');
            expect(tableBuilderOptionsSpy).toHaveBeenCalledWith({
                autoSizeStrategy: { type: "fitCellContents" },
                pagination: true,
                rowSelection: "multiple",
                selectEverything: true,
                suppressRowClickSelection: true,
            });
            expect(tableBuilderIsViewSpy).toHaveBeenCalledTimes(1);
            expect(tableBuilderRowsSpy).toHaveBeenCalledWith(...expectedMatches);
            expect(tableBuilderColumnsSpy).toHaveBeenCalledWith(
                ...[
                    {
                        field: "name",
                        headerName: vscode.l10n.t("Data Set Name"),
                        filter: true,
                        initialSort: "asc",
                    } as Table.ColumnOpts,
                    {
                        field: "position",
                        headerName: vscode.l10n.t("Position"),
                        filter: false,
                    },
                    {
                        field: "contents",
                        headerName: vscode.l10n.t("Contents"),
                        filter: true,
                    },
                    {
                        field: "actions",
                        hide: true,
                    },
                ]
            );
            expect(tableBuilderAddRowActionSpy).toHaveBeenCalledWith("all", {
                title: vscode.l10n.t("Open"),
                command: "open",
                callback: {
                    fn: (DatasetSearch as any).openSearchAtLocation,
                    typ: "multi-row",
                },
                type: "secondary",
            });
            expect(tableBuilderBuildSpy).toHaveBeenCalledTimes(1);
            expect(tableViewProviderSpy).toHaveBeenCalledTimes(1);
            expect(tableViewProviderSetTableViewMock).toHaveBeenCalledTimes(1);
        });
        it("should attempt to perform the search with case sensitivity", async () => {
            const profile = createIProfile();
            const node = createDatasetSessionNode(createISession(), profile);
            node.pattern = "FAKE.*.DS";
            const context = { context: "fake" } as any;
            const searchString = "test";

            const expectedResponse = {
                success: true,
                apiResponse: [
                    {
                        dsn: "FAKE.DATA.SET.DS",
                        member: undefined,
                        matchList: [
                            {
                                line: 1,
                                column: 1,
                                contents: "test",
                            },
                        ],
                    },
                ],
            };
            const expectedMatches = [
                {
                    name: "FAKE.DATA.SET.DS",
                    line: 1,
                    column: 1,
                    position: "1:1",
                    contents: "test",
                    uri: "/test/FAKE.DATA.SET.DS",
                    searchString,
                },
            ];
            const tokenCancellation: vscode.CancellationToken = {
                isCancellationRequested: false,
                onCancellationRequested: jest.fn(),
            };
            const myProgress = { test: "test" };

            showInputBoxSpy.mockResolvedValue(searchString);
            showQuickPickSpy.mockResolvedValue([
                {
                    label: vscode.l10n.t("Case Sensitive"),
                    description: vscode.l10n.t("Perform the search with case sensitivity"),
                    iconPath: new vscode.ThemeIcon("case-sensitive"),
                } as vscode.QuickPickItem,
            ]);
            withProgressSpy.mockImplementation((opts: any, fn: any) => {
                return fn(myProgress, tokenCancellation);
            });
            getSearchMatchesSpy.mockReturnValue(expectedMatches);
            performSearchSpy.mockResolvedValue(expectedResponse);

            await DatasetSearch.search(context, node);

            expect(errorMessageSpy).not.toHaveBeenCalled();
            expect(showInputBoxSpy).toHaveBeenCalledWith({ prompt: "Enter the text to search for." });
            quickPickPositiveExpect();
            expect(showMessageSpy).not.toHaveBeenCalled();

            expect(withProgressSpy.mock.calls[0][0]).toEqual({
                location: vscode.ProgressLocation.Notification,
                title: 'Searching for "test"',
                cancellable: true,
            });

            expect(getSearchMatchesSpy).toHaveBeenCalledWith(node, expectedResponse, true, searchString);

            expect(performSearchSpy).toHaveBeenCalledTimes(1);
            expect(performSearchSpy).toHaveBeenCalledWith(myProgress, tokenCancellation, {
                node,
                pattern: node.pattern,
                searchString,
                caseSensitive: true,
            });
            expect(openSearchAtLocationSpy).not.toHaveBeenCalled();

            expect(tableBuilderTitleSpy).toHaveBeenCalledWith('Search Results for "test"');
            expect(tableBuilderOptionsSpy).toHaveBeenCalledWith({
                autoSizeStrategy: { type: "fitCellContents" },
                pagination: true,
                rowSelection: "multiple",
                selectEverything: true,
                suppressRowClickSelection: true,
            });
            expect(tableBuilderIsViewSpy).toHaveBeenCalledTimes(1);
            expect(tableBuilderRowsSpy).toHaveBeenCalledWith(...expectedMatches);
            expect(tableBuilderColumnsSpy).toHaveBeenCalledWith(
                ...[
                    {
                        field: "name",
                        headerName: vscode.l10n.t("Data Set Name"),
                        filter: true,
                        initialSort: "asc",
                    } as Table.ColumnOpts,
                    {
                        field: "position",
                        headerName: vscode.l10n.t("Position"),
                        filter: false,
                    },
                    {
                        field: "contents",
                        headerName: vscode.l10n.t("Contents"),
                        filter: true,
                    },
                    {
                        field: "actions",
                        hide: true,
                    },
                ]
            );
            expect(tableBuilderAddRowActionSpy).toHaveBeenCalledWith("all", {
                title: vscode.l10n.t("Open"),
                command: "open",
                callback: {
                    fn: (DatasetSearch as any).openSearchAtLocation,
                    typ: "multi-row",
                },
                type: "secondary",
            });
            expect(tableBuilderBuildSpy).toHaveBeenCalledTimes(1);
            expect(tableViewProviderSpy).toHaveBeenCalledTimes(1);
            expect(tableViewProviderSetTableViewMock).toHaveBeenCalledTimes(1);
        });
    });
});
