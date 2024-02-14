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

import * as globals from "../../../src/globals";
import * as vscode from "vscode";
import * as sharedMock from "../../../__mocks__/mockCreators/shared";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import * as dsMock from "../../../__mocks__/mockCreators/datasets";
import * as unixActions from "../../../src/uss/actions";
import * as dsActions from "../../../src/dataset/actions";
import { LocalFileManagement } from "../../../src/utils/LocalFileManagement";
import * as utils from "../../../src/shared/utils";
import { ZoweLogger } from "../../../src/globals";

jest.mock("vscode");

describe("LocalFileManagement unit tests", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    function createGlobalMocks() {
        const newMocks = {
            mockSession: sharedMock.createISession(),
            mockProfile: sharedMock.createValidIProfile(),
            mockDsFileNode: ZoweDatasetNode,
            mockFilesToCompare: null as any,
            mockDlUnixSpy: null as any,
            mockDlDsSpy: null as any,
            mockIsDsNode: jest.fn(),
            mockIsUnixNode: jest.fn(),
            mockFileInfo: { path: "/u/fake/path/file.txt" },
            warnLogSpy: null as any,
            readFile: jest.fn(),
        };
        newMocks.mockFilesToCompare = [newMocks.mockDsFileNode];
        Object.defineProperty(globals, "filesToCompare", { value: newMocks.mockFilesToCompare, configurable: true });
        newMocks.mockDsFileNode = dsMock.createDatasetSessionNode(newMocks.mockSession, newMocks.mockProfile) as any;
        Object.defineProperty(dsActions, "downloadPs", { value: jest.fn().mockResolvedValue(newMocks.mockFileInfo), configurable: true });
        newMocks.mockDlDsSpy = jest.spyOn(vscode.workspace.fs, "readFile").mockImplementation(newMocks.readFile);
        Object.defineProperty(unixActions, "downloadUnixFile", {
            value: jest.fn().mockResolvedValue(newMocks.mockFileInfo),
            configurable: true,
        });
        newMocks.mockDlUnixSpy = jest.spyOn(vscode.workspace.fs, "readFile").mockImplementation(newMocks.readFile);
        Object.defineProperty(utils, "isZoweDatasetTreeNode", { value: newMocks.mockIsDsNode, configurable: true });
        Object.defineProperty(utils, "isZoweUSSTreeNode", { value: newMocks.mockIsUnixNode, configurable: true });
        Object.defineProperty(vscode.commands, "executeCommand", { value: jest.fn(), configurable: true });
        Object.defineProperty(globals, "resetCompareChoices", { value: jest.fn(), configurable: true });
        Object.defineProperty(ZoweLogger, "warn", { value: jest.fn(), configurable: true });
        newMocks.warnLogSpy = jest.spyOn(ZoweLogger, "warn");
        return newMocks;
    }

    describe("CompareChosenFileContent method unit tests", () => {
        it("should pass with 2 MVS files chosen", async () => {
            const mocks = createGlobalMocks();
            mocks.mockIsDsNode.mockReturnValue(true);
            mocks.mockIsUnixNode.mockReturnValue(false);
            await LocalFileManagement.compareChosenFileContent(mocks.mockDsFileNode as any);
            expect(mocks.mockDlDsSpy).toBeCalledTimes(2);
            expect(mocks.mockDlUnixSpy).not.toBeCalled();
            expect(mocks.warnLogSpy).not.toBeCalled();
        });
        it("should pass with 2 UNIX files chosen", async () => {
            const mocks = createGlobalMocks();
            mocks.mockIsDsNode.mockReturnValue(false);
            mocks.mockIsUnixNode.mockReturnValue(true);
            await LocalFileManagement.compareChosenFileContent(mocks.mockDsFileNode as any);
            expect(mocks.mockDlUnixSpy).toBeCalledTimes(2);
            expect(mocks.mockDlDsSpy).not.toBeCalled();
            expect(mocks.warnLogSpy).not.toBeCalled();
        });
        it("should pass with 1 MVS file & 1 UNIX file chosen", async () => {
            const mocks = createGlobalMocks();
            mocks.mockIsDsNode.mockReturnValueOnce(true);
            mocks.mockIsDsNode.mockReturnValueOnce(false);
            mocks.mockIsUnixNode.mockReturnValueOnce(true);
            await LocalFileManagement.compareChosenFileContent(mocks.mockDsFileNode as any);
            expect(mocks.mockDlUnixSpy).toBeCalledTimes(1);
            expect(mocks.mockDlDsSpy).toBeCalledTimes(1);
            expect(mocks.warnLogSpy).not.toBeCalled();
        });
        it("should log warning and return if MVS or UNIX file not chosen", async () => {
            const mocks = createGlobalMocks();
            mocks.mockIsDsNode.mockReturnValue(false);
            mocks.mockIsUnixNode.mockReturnValue(false);
            await LocalFileManagement.compareChosenFileContent(mocks.mockDsFileNode as any);
            expect(mocks.mockDlUnixSpy).not.toBeCalled();
            expect(mocks.mockDlDsSpy).not.toBeCalled();
            expect(mocks.warnLogSpy).toBeCalled();
        });
    });
});
