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
import { Gui, PersistenceSchemaEnum, ZoweScheme } from "@zowe/zowe-explorer-api";
import { createDatasetSessionNode, createDatasetTree } from "../../__mocks__/mockCreators/datasets";
import { createIProfile, createISession, createPersistentConfig, createTreeView } from "../../__mocks__/mockCreators/shared";
import { ZoweLocalStorage } from "../../../src/tools/ZoweLocalStorage";
import { TreeViewUtils } from "../../../src/utils/TreeViewUtils";
import { Constants } from "../../../src/configuration/Constants";
import { ZoweUSSNode } from "../../../src/trees/uss/ZoweUSSNode";
import { Profiles } from "../../../src/configuration/Profiles";
import { createUSSSessionNode } from "../../__mocks__/mockCreators/uss";
import { ZoweDatasetNode } from "../../../src/trees/dataset/ZoweDatasetNode";

describe("TreeViewUtils Unit Tests", () => {
    function createBlockMocks(): { [key: string]: any } {
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
        Object.defineProperty(ZoweLocalStorage, "globalState", {
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

    describe("errorForUnsavedResource", () => {
        function getBlockMocks() {
            return {
                errorMessage: jest.spyOn(Gui, "errorMessage").mockClear(),
                profilesInstance: jest.spyOn(Profiles, "getInstance").mockReturnValue({
                    checkCurrentProfile: jest.fn(),
                } as any),
            };
        }
        it("prompts for an unsaved USS file", async () => {
            const ussNode = new ZoweUSSNode({
                label: "testFile.txt",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                contextOverride: Constants.USS_TEXT_FILE_CONTEXT,
                profile: createIProfile(),
                parentNode: createUSSSessionNode(createISession(), createIProfile()),
            });
            ussNode.resourceUri = vscode.Uri.from({
                path: "/sestest/testFile.txt",
                scheme: ZoweScheme.USS,
            });
            (ussNode.resourceUri as any).fsPath = ussNode.resourceUri.path;
            const blockMocks = getBlockMocks();

            const textDocumentsMock = jest.replaceProperty(vscode.workspace, "textDocuments", [
                {
                    fileName: ussNode.resourceUri?.fsPath as any,
                    uri: ussNode.resourceUri,
                    isDirty: true,
                } as any,
            ]);

            expect(await TreeViewUtils.errorForUnsavedResource(ussNode)).toBe(true);
            expect(blockMocks.errorMessage).toHaveBeenCalledWith(
                "Unable to rename testFile.txt because you have unsaved changes in this file. " + "Please save your work and try again.",
                { vsCodeOpts: { modal: true } }
            );
            textDocumentsMock.restore();
        });

        it("prompts for an unsaved file in a USS directory", async () => {
            const ussFolder = new ZoweUSSNode({
                label: "folder",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                contextOverride: Constants.USS_DIR_CONTEXT,
                profile: createIProfile(),
                parentNode: createUSSSessionNode(createISession(), createIProfile()),
            });
            ussFolder.resourceUri = vscode.Uri.from({
                path: "/sestest/folder",
                scheme: ZoweScheme.USS,
            });
            (ussFolder.resourceUri as any).fsPath = ussFolder.resourceUri.path;
            const blockMocks = getBlockMocks();

            const ussNode = new ZoweUSSNode({
                label: "testFile.txt",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                contextOverride: Constants.USS_TEXT_FILE_CONTEXT,
                profile: createIProfile(),
                parentNode: ussFolder,
            });
            ussNode.resourceUri = vscode.Uri.from({
                path: "/sestest/folder/testFile.txt",
                scheme: ZoweScheme.USS,
            });
            (ussNode.resourceUri as any).fsPath = ussNode.resourceUri.path;

            const textDocumentsMock = jest.replaceProperty(vscode.workspace, "textDocuments", [
                {
                    fileName: ussNode.resourceUri?.fsPath as any,
                    uri: ussNode.resourceUri,
                    isDirty: true,
                } as any,
            ]);

            expect(await TreeViewUtils.errorForUnsavedResource(ussFolder)).toBe(true);
            expect(blockMocks.errorMessage).toHaveBeenCalledWith(
                "Unable to rename folder because you have unsaved changes in this directory. " + "Please save your work and try again.",
                { vsCodeOpts: { modal: true } }
            );
            textDocumentsMock.restore();
        });

        it("prompts for an unsaved data set", async () => {
            const ps = new ZoweDatasetNode({
                label: "TEST.PS",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                contextOverride: Constants.DS_DS_CONTEXT,
                profile: createIProfile(),
                parentNode: createDatasetSessionNode(createISession(), createIProfile()),
            });
            ps.resourceUri = vscode.Uri.from({
                path: "/sestest/TEST.PS",
                scheme: ZoweScheme.DS,
            });
            (ps.resourceUri as any).fsPath = ps.resourceUri.path;
            const blockMocks = getBlockMocks();

            const textDocumentsMock = jest.replaceProperty(vscode.workspace, "textDocuments", [
                {
                    fileName: ps.resourceUri?.fsPath as any,
                    uri: ps.resourceUri,
                    isDirty: true,
                } as any,
            ]);

            expect(await TreeViewUtils.errorForUnsavedResource(ps)).toBe(true);
            expect(blockMocks.errorMessage).toHaveBeenCalledWith(
                "Unable to rename TEST.PS because you have unsaved changes in this data set. " + "Please save your work and try again.",
                { vsCodeOpts: { modal: true } }
            );
            textDocumentsMock.restore();
        });

        it("doesn't prompt if no resources are unsaved in editor", async () => {
            const ps = new ZoweDatasetNode({
                label: "TEST.PS",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                contextOverride: Constants.DS_DS_CONTEXT,
                profile: createIProfile(),
                parentNode: createDatasetSessionNode(createISession(), createIProfile()),
            });
            ps.resourceUri = vscode.Uri.from({
                path: "/sestest/TEST.PS",
                scheme: ZoweScheme.DS,
            });
            (ps.resourceUri as any).fsPath = ps.resourceUri.path;
            const blockMocks = getBlockMocks();

            const textDocumentsMock = jest.replaceProperty(vscode.workspace, "textDocuments", [
                {
                    fileName: ps.resourceUri?.fsPath as any,
                    uri: ps.resourceUri,
                    isDirty: false,
                } as any,
            ]);

            expect(await TreeViewUtils.errorForUnsavedResource(ps)).toBe(false);
            expect(blockMocks.errorMessage).not.toHaveBeenCalled();
            textDocumentsMock.restore();
        });

        it("prompts for an unsaved PDS member", async () => {
            const pds = new ZoweDatasetNode({
                label: "TEST.PDS",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                contextOverride: Constants.DS_PDS_CONTEXT,
                profile: createIProfile(),
                parentNode: createDatasetSessionNode(createISession(), createIProfile()),
            });
            pds.resourceUri = vscode.Uri.from({
                path: "/sestest/TEST.PDS",
                scheme: ZoweScheme.DS,
            });
            (pds.resourceUri as any).fsPath = pds.resourceUri.path;

            const pdsMember = new ZoweDatasetNode({
                label: "MEMB",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                contextOverride: Constants.DS_MEMBER_CONTEXT,
                profile: createIProfile(),
                parentNode: createDatasetSessionNode(createISession(), createIProfile()),
            });
            pdsMember.resourceUri = vscode.Uri.from({
                path: "/sestest/TEST.PDS/MEMB",
                scheme: ZoweScheme.DS,
            });
            (pdsMember.resourceUri as any).fsPath = pdsMember.resourceUri.path;
            const blockMocks = getBlockMocks();

            const textDocumentsMock = jest.replaceProperty(vscode.workspace, "textDocuments", [
                {
                    fileName: pdsMember.resourceUri?.fsPath as any,
                    uri: pdsMember.resourceUri,
                    isDirty: true,
                } as any,
            ]);

            expect(await TreeViewUtils.errorForUnsavedResource(pds)).toBe(true);
            expect(blockMocks.errorMessage).toHaveBeenCalledWith(
                "Unable to rename TEST.PDS because you have unsaved changes in this data set. " + "Please save your work and try again.",
                { vsCodeOpts: { modal: true } }
            );
            textDocumentsMock.restore();
        });
    });
});
