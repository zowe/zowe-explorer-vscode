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
import * as sharedMock from "../../__mocks__/mockCreators/shared";
import * as dsMock from "../../__mocks__/mockCreators/datasets";
import { ZoweLogger } from "../../../src/tools/ZoweLogger";
import { DatasetFSProvider } from "../../../src/trees/dataset/DatasetFSProvider";
import { ZoweDatasetNode } from "../../../src/trees/dataset/ZoweDatasetNode";
import { UssFSProvider } from "../../../src/trees/uss/UssFSProvider";
import { ZoweUSSNode } from "../../../src/trees/uss/ZoweUSSNode";
import { createUSSNode, createUSSSessionNode } from "../../__mocks__/mockCreators/uss";
import { LocalFileManagement } from "../../../src/management/LocalFileManagement";
import { createISession, createIProfile } from "../../__mocks__/mockCreators/shared";

jest.mock("vscode");

describe("LocalFileManagement unit tests", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    function createGlobalMocks() {
        const profile = sharedMock.createValidIProfile();
        const session = sharedMock.createISession();
        jest.spyOn(DatasetFSProvider.instance, "createDirectory").mockImplementation();
        jest.spyOn(UssFSProvider.instance, "createDirectory").mockImplementation();
        const dsSession = dsMock.createDatasetSessionNode(session, profile);
        const ussSession = createUSSSessionNode(session, profile);

        return {
            session,
            profile,
            dsSession,
            ussSession,
            fileNodes: {
                ds: [
                    new ZoweDatasetNode({ label: "test", collapsibleState: vscode.TreeItemCollapsibleState.None, profile, parentNode: dsSession }),
                    new ZoweDatasetNode({ label: "test2", collapsibleState: vscode.TreeItemCollapsibleState.None, profile, parentNode: dsSession }),
                ],
                uss: [
                    new ZoweUSSNode({ label: "test3", collapsibleState: vscode.TreeItemCollapsibleState.None, profile, parentNode: ussSession }),
                    new ZoweUSSNode({ label: "test4", collapsibleState: vscode.TreeItemCollapsibleState.None, profile, parentNode: ussSession }),
                ],
            },
            mockFileInfo: { path: "/u/fake/path/file.txt" },
            warnLogSpy: jest.spyOn(ZoweLogger, "warn").mockImplementation(),
            executeCommand: jest.spyOn(vscode.commands, "executeCommand").mockImplementation(),
        };
    }

    describe("CompareChosenFileContent method unit tests", () => {
        it("should pass with 2 MVS files chosen", async () => {
            const mocks = createGlobalMocks();
            LocalFileManagement.filesToCompare = [mocks.fileNodes.ds[0]];
            await LocalFileManagement.compareChosenFileContent(mocks.fileNodes.ds[1]);
            expect(mocks.executeCommand).toHaveBeenCalledWith("vscode.diff", mocks.fileNodes.ds[0].resourceUri, mocks.fileNodes.ds[1].resourceUri);
            expect(mocks.warnLogSpy).not.toHaveBeenCalled();
        });
        it("should pass with 2 UNIX files chosen", async () => {
            const mocks = createGlobalMocks();
            LocalFileManagement.filesToCompare = [mocks.fileNodes.uss[0]];
            await LocalFileManagement.compareChosenFileContent(mocks.fileNodes.uss[1]);
            expect(mocks.executeCommand).toHaveBeenCalledWith("vscode.diff", mocks.fileNodes.uss[0].resourceUri, mocks.fileNodes.uss[1].resourceUri);
            expect(mocks.warnLogSpy).not.toHaveBeenCalled();
        });
        it("should pass with 1 MVS file & 1 UNIX file chosen", async () => {
            const mocks = createGlobalMocks();
            LocalFileManagement.filesToCompare = [mocks.fileNodes.uss[0]];
            await LocalFileManagement.compareChosenFileContent(mocks.fileNodes.ds[0]);
            expect(mocks.executeCommand).toHaveBeenCalledWith("vscode.diff", mocks.fileNodes.uss[0].resourceUri, mocks.fileNodes.ds[0].resourceUri);
            expect(mocks.warnLogSpy).not.toHaveBeenCalled();
        });

        it("should pass with 2 UNIX files chosen - readonly", async () => {
            const mocks = createGlobalMocks();
            LocalFileManagement.filesToCompare = [mocks.fileNodes.uss[0]];
            await LocalFileManagement.compareChosenFileContent(mocks.fileNodes.uss[1], true);
            expect(mocks.executeCommand).toHaveBeenCalledWith("vscode.diff", mocks.fileNodes.uss[0].resourceUri, mocks.fileNodes.uss[1].resourceUri);
            expect(mocks.warnLogSpy).not.toHaveBeenCalled();
            expect(mocks.executeCommand).toHaveBeenCalledWith("workbench.action.files.setActiveEditorReadonlyInSession");
        });
    });

    describe("selectFileForCompare", () => {
        it("calls reset when elements exist in filesToCompare array", () => {
            const node2 = createUSSNode(createISession(), createIProfile());
            node2.label = "node2";
            LocalFileManagement.filesToCompare = [createUSSNode(createISession(), createIProfile())];
            const setCompareSelectionSpy = jest.spyOn(LocalFileManagement, "setCompareSelection");
            const resetSpy = jest.spyOn(LocalFileManagement, "resetCompareSelection");
            const traceSpy = jest.spyOn(ZoweLogger, "trace");
            LocalFileManagement.selectFileForCompare(node2);
            expect(resetSpy).toHaveBeenCalled();
            expect(setCompareSelectionSpy).toHaveBeenCalledWith(true);
            expect(LocalFileManagement.filesToCompare[0]).toBe(node2);
            expect(traceSpy).toHaveBeenCalledWith("node2 selected for compare.");
        });
    });

    describe("resetCompareSelection", () => {
        it("resets the compare selection and calls setCompareSelection", () => {
            const node = createUSSNode(createISession(), createIProfile());
            const setCompareSelectionSpy = jest.spyOn(LocalFileManagement, "setCompareSelection");
            LocalFileManagement.filesToCompare = [node];
            LocalFileManagement.resetCompareSelection();
            expect(setCompareSelectionSpy).toHaveBeenCalled();
            expect(LocalFileManagement.filesToCompare.length).toBe(0);
        });
    });
});
