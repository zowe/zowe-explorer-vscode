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
import * as globals from "../../../src/globals";
import * as os from "os";
import * as sharedMock from "../../../__mocks__/mockCreators/shared";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import { ZoweUSSNode } from "../../../src/uss/ZoweUSSNode";
import * as dsMock from "../../../__mocks__/mockCreators/datasets";
import * as unixMock from "../../../__mocks__/mockCreators/uss";
import * as unixActions from "../../../src/uss/actions";
import * as dsActions from "../../../src/dataset/actions";
import * as utils from "../../../src/shared/utils";
import { LocalFileManagement } from "../../../src/utils/LocalFileManagement";

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
            mockUnixFileNode: ZoweUSSNode,
            mockFilesToCompare: null as any,
            mockDlUnixSpy: null as any,
            mockDlDsSpy: null as any,
        };
        newMocks.mockDsFileNode = dsMock.createDatasetSessionNode(newMocks.mockSession, newMocks.mockProfile) as any;
        newMocks.mockUnixFileNode = unixMock.createUSSNode(newMocks.mockSession, newMocks.mockProfile) as any;
        // newMocks.mockFilesToCompare = [newMocks.mockDsFileNode, newMocks.mockUnixFileNode];
        Object.defineProperty(globals, "filesToCompare", { value: newMocks.mockFilesToCompare, configurable: true });
        Object.defineProperty(dsActions, "downloadPs", { value: jest.fn(), configurable: true });
        newMocks.mockDlDsSpy = jest.spyOn(dsActions, "downloadPs");
        Object.defineProperty(unixActions, "downloadUnixFile", { value: jest.fn(), configurable: true });
        newMocks.mockDlUnixSpy = jest.spyOn(unixActions, "downloadUnixFile");
        return newMocks;
    }

    describe("CompareChosenFileContent method unit tests", () => {
        it("should pass with mockDlDsSpy spy called", async () => {
            const mocks = createGlobalMocks();
            const dsNode2 = mocks.mockDsFileNode;
            dsNode2.label = "newFile.txt";
            mocks.mockFilesToCompare = [mocks.mockDsFileNode, dsNode2];

            await LocalFileManagement.compareChosenFileContent();
            expect(mocks.mockDlDsSpy).toBeCalled();
            expect(mocks.mockDlUnixSpy).not.toBeCalled();
        });
    });
});
