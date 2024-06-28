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
import { PersistenceSchemaEnum } from "@zowe/zowe-explorer-api";
import { createDatasetSessionNode, createDatasetTree } from "../../__mocks__/mockCreators/datasets";
import { createIProfile, createISession, createPersistentConfig, createTreeView } from "../../__mocks__/mockCreators/shared";
import { ZoweLocalStorage } from "../../../src/tools/ZoweLocalStorage";
import { TreeViewUtils } from "../../../src/utils/TreeViewUtils";
import { Constants } from "../../../src/configuration/Constants";

describe("TreeViewUtils Unit Tests", () => {
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
        Object.defineProperty(vscode.window, "createTreeView", {
            value: jest.fn().mockReturnValue({ onDidCollapseElement: jest.fn() }),
            configurable: true,
        });
        newMocks.testDatasetTree = createDatasetTree(newMocks.datasetSessionNode, newMocks.treeView);
        newMocks.testDatasetTree.addFileHistory("[profile1]: TEST.NODE");
        Object.defineProperty(ZoweLocalStorage, "storage", {
            value: createPersistentConfig(),
            configurable: true,
        });

        return newMocks;
    }
    it("refreshIconOnCollapse - generated listener function works as intended", () => {
        const testTreeProvider = { mOnDidChangeTreeData: { fire: jest.fn() } } as any;
        const listenerFn = TreeViewUtils.refreshIconOnCollapse(
            [(node): boolean => (node.contextValue as any).includes(Constants.DS_PDS_CONTEXT) as boolean],
            testTreeProvider
        );
        const element = { label: "somenode", contextValue: Constants.DS_PDS_CONTEXT } as any;
        listenerFn({ element });
        expect(testTreeProvider.mOnDidChangeTreeData.fire).toHaveBeenCalledWith(element);
    });
    it("should remove session from treeView", async () => {
        const blockMocks = createBlockMocks();
        const originalLength = blockMocks.testDatasetTree.mSessionNodes.length;
        await TreeViewUtils.removeSession(blockMocks.testDatasetTree, blockMocks.imperativeProfile.name);
        expect(blockMocks.testDatasetTree.mSessionNodes.length).toEqual(originalLength - 1);
    });
    it("should not find session in treeView", async () => {
        const blockMocks = createBlockMocks();
        const originalLength = blockMocks.testDatasetTree.mSessionNodes.length;
        await TreeViewUtils.removeSession(blockMocks.testDatasetTree, "fake");
        expect(blockMocks.testDatasetTree.mSessionNodes.length).toEqual(originalLength);
    });
    it("should not run treeProvider.removeFileHistory when job is returned for type", async () => {
        const blockMocks = createBlockMocks();
        jest.spyOn(blockMocks.testDatasetTree, "getTreeType").mockReturnValue(PersistenceSchemaEnum.Job);
        await TreeViewUtils.removeSession(blockMocks.testDatasetTree, "SESTEST");
        expect(blockMocks.testDatasetTree.removeFileHistory).toHaveBeenCalledTimes(0);
    });
    it("should run treeProvider.removeFileHistory", async () => {
        const blockMocks = createBlockMocks();
        jest.spyOn(blockMocks.testDatasetTree, "getTreeType").mockReturnValue(PersistenceSchemaEnum.USS);
        jest.spyOn(blockMocks.testDatasetTree, "getFileHistory").mockReturnValue(["[SESTEST]: /u/test/test.txt"]);
        await TreeViewUtils.removeSession(blockMocks.testDatasetTree, "SESTEST");
        expect(blockMocks.testDatasetTree.removeFileHistory).toHaveBeenCalledTimes(1);
    });
});
