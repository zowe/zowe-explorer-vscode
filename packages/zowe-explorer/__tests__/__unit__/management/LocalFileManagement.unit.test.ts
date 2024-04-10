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
import { ZoweDatasetNode } from "../../../src/trees/dataset";
import { LocalFileManagement } from "../../../src/management";
import { ZoweLogger } from "../../../src/tools";
import { ZoweUSSNode } from "../../../src/trees/uss";
import { createUSSSessionNode } from "../../__mocks__/mockCreators/uss";
import { Constants } from "../../../src/configuration";
import { SharedUtils } from "../../../src/trees/shared";

jest.mock("vscode");

describe("LocalFileManagement unit tests", () => {
    beforeEach(() => {
        Constants.resetCompareChoices();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    function createGlobalMocks() {
        const profile = sharedMock.createValidIProfile();
        const session = sharedMock.createISession();
        // jest.spyOn(DatasetFSProvider.instance, "createDirectory").mockImplementation();
        // jest.spyOn(UssFSProvider.instance, "createDirectory").mockImplementation();
        const dsSession = dsMock.createDatasetSessionNode(session, profile);
        const ussSession = createUSSSessionNode(session, profile);
        const mockFileInfo = { path: "/u/fake/path/file.txt" } as SharedUtils.LocalFileInfo;

        jest.spyOn(ZoweDatasetNode.prototype, "downloadDs").mockResolvedValue(mockFileInfo);
        jest.spyOn(ZoweUSSNode.prototype, "downloadUSS").mockResolvedValue(mockFileInfo);

        return {
            session,
            profile,
            dsSession,
            ussSession,
            mockFileInfo,
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
            warnLogSpy: jest.spyOn(ZoweLogger, "warn").mockImplementation(),
            executeCommand: jest.spyOn(vscode.commands, "executeCommand").mockImplementation(),
        };
    }

    describe("CompareChosenFileContent method unit tests", () => {
        it("should pass with 2 MVS files chosen", async () => {
            const mocks = createGlobalMocks();
            Constants.filesToCompare.push(mocks.fileNodes.ds[0]);
            await LocalFileManagement.compareChosenFileContent(mocks.fileNodes.ds[1]);
            expect(mocks.executeCommand).toHaveBeenCalledWith("vscode.diff", mocks.mockFileInfo, mocks.mockFileInfo);
            expect(mocks.warnLogSpy).not.toHaveBeenCalled();
        });
        it("should pass with 2 UNIX files chosen", async () => {
            const mocks = createGlobalMocks();
            Constants.filesToCompare.push(mocks.fileNodes.uss[0]);
            await LocalFileManagement.compareChosenFileContent(mocks.fileNodes.uss[1]);
            expect(mocks.executeCommand).toHaveBeenCalledWith("vscode.diff", mocks.mockFileInfo, mocks.mockFileInfo);
            expect(mocks.warnLogSpy).not.toHaveBeenCalled();
        });
        it("should pass with 1 MVS file & 1 UNIX file chosen", async () => {
            const mocks = createGlobalMocks();
            Constants.filesToCompare.push(mocks.fileNodes.uss[0]);
            await LocalFileManagement.compareChosenFileContent(mocks.fileNodes.ds[0]);
            expect(mocks.executeCommand).toHaveBeenCalledWith("vscode.diff", mocks.mockFileInfo, mocks.mockFileInfo);
            expect(mocks.warnLogSpy).not.toHaveBeenCalled();
        });
    });
});
