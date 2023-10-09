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

jest.mock("fs");
jest.mock("vscode");
jest.mock("@zowe/cli");

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
            mockIsDsNode: true,
            mockIsUnixNode: false,
            mockPath: "/u/fake/path/file.txt",
        };
        newMocks.mockDsFileNode = dsMock.createDatasetSessionNode(newMocks.mockSession, newMocks.mockProfile) as any;
        Object.defineProperty(dsActions, "downloadPs", { value: jest.fn().mockResolvedValue({ path: newMocks.mockPath }), configurable: true });
        newMocks.mockDlDsSpy = jest.spyOn(dsActions, "downloadPs");
        Object.defineProperty(unixActions, "downloadUnixFile", {
            value: jest.fn().mockResolvedValue({ path: newMocks.mockPath }),
            configurable: true,
        });
        newMocks.mockDlUnixSpy = jest.spyOn(unixActions, "downloadUnixFile");
        Object.defineProperty(utils, "isZoweDatasetTreeNode", { value: jest.fn().mockReturnValue(newMocks.mockIsDsNode), configurable: true });
        Object.defineProperty(utils, "isZoweUSSTreeNode", { value: jest.fn(), configurable: true });
        Object.defineProperty(vscode.Uri, "file", { value: jest.fn().mockReturnValue({ path: newMocks.mockPath }), configurable: true });
        Object.defineProperty(vscode.commands, "executeCommand", { value: jest.fn(), configurable: true });
        Object.defineProperty(globals, "resetCompareChoices", { value: jest.fn(), configurable: true });
        return newMocks;
    }

    describe("CompareChosenFileContent method unit tests", () => {
        it("should pass with mockDlDsSpy spy called", async () => {
            const mocks = createGlobalMocks();
            mocks.mockFilesToCompare = [mocks.mockDsFileNode, mocks.mockDsFileNode];
            Object.defineProperty(globals, "filesToCompare", { value: mocks.mockFilesToCompare, configurable: true });
            await LocalFileManagement.compareChosenFileContent();
            expect(mocks.mockDlDsSpy).toBeCalledTimes(2);
            expect(mocks.mockDlUnixSpy).not.toBeCalled();
        });
        it("should pass with mockDlUnixSpy spy called", async () => {
            const mocks = createGlobalMocks();
            mocks.mockFilesToCompare = [mocks.mockDsFileNode, mocks.mockDsFileNode];
            Object.defineProperty(globals, "filesToCompare", { value: mocks.mockFilesToCompare, configurable: true });
            mocks.mockIsDsNode = false;
            Object.defineProperty(utils, "isZoweDatasetTreeNode", { value: jest.fn().mockReturnValue(mocks.mockIsDsNode), configurable: true });
            mocks.mockIsUnixNode = true;
            Object.defineProperty(utils, "isZoweUSSTreeNode", { value: jest.fn().mockReturnValue(mocks.mockIsUnixNode), configurable: true });
            await LocalFileManagement.compareChosenFileContent();
            expect(mocks.mockDlUnixSpy).toBeCalledTimes(2);
            expect(mocks.mockDlDsSpy).not.toBeCalled();
        });
    });
});
