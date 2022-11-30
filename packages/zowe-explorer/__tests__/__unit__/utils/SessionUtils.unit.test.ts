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
import { removeSession } from "../../../src/utils/SessionUtils";
import { createDatasetSessionNode, createDatasetTree } from "../../../__mocks__/mockCreators/datasets";
import {
    createIProfile,
    createISession,
    createPersistentConfig,
    createTreeView,
} from "../../../__mocks__/mockCreators/shared";

describe("SessionUtils removeSession Unit Tests", () => {
    function createBlockMocks() {
        const newMocks = {
            session: createISession(),
            imperativeProfile: createIProfile(),
            treeView: createTreeView(),
            testDatasetTree: null,
            datasetSessionNode: null,
            mockGetConfiguration: jest.fn(),
        };
        newMocks.datasetSessionNode = createDatasetSessionNode(newMocks.session, newMocks.imperativeProfile);
        newMocks.testDatasetTree = createDatasetTree(newMocks.datasetSessionNode, newMocks.treeView);
        newMocks.testDatasetTree.addFileHistory("[profile1]: TEST.NODE");
        Object.defineProperty(vscode.window, "createTreeView", { value: jest.fn(), configurable: true });
        Object.defineProperty(vscode, "ConfigurationTarget", { value: jest.fn(), configurable: true });
        newMocks.mockGetConfiguration.mockReturnValue(createPersistentConfig());
        Object.defineProperty(vscode.workspace, "getConfiguration", {
            value: newMocks.mockGetConfiguration,
            configurable: true,
        });

        return newMocks;
    }
    it("should remove session from treeView", async () => {
        const blockMocks = createBlockMocks();
        const originalLength = blockMocks.testDatasetTree.mSessionNodes.length;
        await removeSession(blockMocks.testDatasetTree, blockMocks.imperativeProfile.name);
        expect(blockMocks.testDatasetTree.mSessionNodes.length).toEqual(originalLength - 1);
    });
    it("should not find session in treeView", async () => {
        const blockMocks = createBlockMocks();
        const originalLength = blockMocks.testDatasetTree.mSessionNodes.length;
        await removeSession(blockMocks.testDatasetTree, "fake");
        expect(blockMocks.testDatasetTree.mSessionNodes.length).toEqual(originalLength);
    });
});
