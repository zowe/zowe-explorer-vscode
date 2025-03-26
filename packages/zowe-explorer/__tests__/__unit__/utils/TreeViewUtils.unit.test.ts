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
import { IconGenerator } from "../../../src/icons/IconGenerator";

describe("TreeViewUtils Unit Tests", () => {
    function createGlobalMocks(): { [key: string]: any } {
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
    it("should remove session from treeView", async () => {
        const globalMocks = createGlobalMocks();
        const originalLength = globalMocks.testDatasetTree.mSessionNodes.length;
        await TreeViewUtils.removeSession(globalMocks.testDatasetTree, globalMocks.imperativeProfile.name);
        expect(globalMocks.testDatasetTree.mSessionNodes.length).toEqual(originalLength - 1);
    });
    it("should not find session in treeView", async () => {
        const globalMocks = createGlobalMocks();
        const originalLength = globalMocks.testDatasetTree.mSessionNodes.length;
        await TreeViewUtils.removeSession(globalMocks.testDatasetTree, "fake");
        expect(globalMocks.testDatasetTree.mSessionNodes.length).toEqual(originalLength);
    });
    it("should not run treeProvider.removeFileHistory when job is returned for type", async () => {
        const globalMocks = createGlobalMocks();
        jest.spyOn(globalMocks.testDatasetTree, "getTreeType").mockReturnValue(PersistenceSchemaEnum.Job);
        await TreeViewUtils.removeSession(globalMocks.testDatasetTree, "SESTEST");
        expect(globalMocks.testDatasetTree.removeFileHistory).toHaveBeenCalledTimes(0);
    });
    it("should run treeProvider.removeFileHistory", async () => {
        const globalMocks = createGlobalMocks();
        jest.spyOn(globalMocks.testDatasetTree, "getTreeType").mockReturnValue(PersistenceSchemaEnum.USS);
        jest.spyOn(globalMocks.testDatasetTree, "getFileHistory").mockReturnValue(["[SESTEST]: /u/test/test.txt"]);
        await TreeViewUtils.removeSession(globalMocks.testDatasetTree, "SESTEST");
        expect(globalMocks.testDatasetTree.removeFileHistory).toHaveBeenCalledTimes(1);
    });

    describe("updateNodeIcon", () => {
        it("should update the icon for a node", () => {
            const globalMocks = createGlobalMocks();
            const fireSpy = jest.spyOn(globalMocks.testDatasetTree.mOnDidChangeTreeData, "fire");
            const node = new ZoweDatasetNode({
                label: "TEST.NODE",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                contextOverride: Constants.DS_DS_CONTEXT,
                profile: createIProfile(),
                parentNode: createDatasetSessionNode(createISession(), createIProfile()),
            });
            TreeViewUtils.updateNodeIcon(node, globalMocks.testDatasetTree);
            expect(fireSpy).toHaveBeenCalledWith(node);
        });

        it("should not update the icon for a node when the new icon is not found", () => {
            const globalMocks = createGlobalMocks();
            const fireSpy = jest.spyOn(globalMocks.testDatasetTree.mOnDidChangeTreeData, "fire");
            const node = new ZoweDatasetNode({
                label: "TEST.NODE",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                contextOverride: Constants.DS_DS_CONTEXT,
                profile: createIProfile(),
                parentNode: createDatasetSessionNode(createISession(), createIProfile()),
            });
            // the cast in the mock below (undefined as `any`) is necessary because `noExplicitReturns` is not enabled.
            // it represents the scenario where `pop` is called on an empty icons array in the original function
            const getIconByNodeMock = jest.spyOn(IconGenerator, "getIconByNode").mockReturnValue(undefined as any);
            TreeViewUtils.updateNodeIcon(node, globalMocks.testDatasetTree);
            expect(getIconByNodeMock).toHaveBeenCalledTimes(1);
            expect(getIconByNodeMock).toHaveBeenCalledWith(node);
            expect(fireSpy).not.toHaveBeenCalled();
        });
    });

    describe("errorForUnsavedResource", () => {
        function getglobalMocks() {
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
            const globalMocks = getglobalMocks();

            const textDocumentsMock = jest.replaceProperty(vscode.workspace, "textDocuments", [
                {
                    fileName: ussNode.resourceUri?.fsPath as any,
                    uri: ussNode.resourceUri,
                    isDirty: true,
                } as any,
            ]);

            expect(await TreeViewUtils.errorForUnsavedResource(ussNode)).toBe(true);
            expect(globalMocks.errorMessage).toHaveBeenCalledWith(
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
            const globalMocks = getglobalMocks();

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
            expect(globalMocks.errorMessage).toHaveBeenCalledWith(
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
            const globalMocks = getglobalMocks();

            const textDocumentsMock = jest.replaceProperty(vscode.workspace, "textDocuments", [
                {
                    fileName: ps.resourceUri?.fsPath as any,
                    uri: ps.resourceUri,
                    isDirty: true,
                } as any,
            ]);

            expect(await TreeViewUtils.errorForUnsavedResource(ps)).toBe(true);
            expect(globalMocks.errorMessage).toHaveBeenCalledWith(
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
            const globalMocks = getglobalMocks();

            const textDocumentsMock = jest.replaceProperty(vscode.workspace, "textDocuments", [
                {
                    fileName: ps.resourceUri?.fsPath as any,
                    uri: ps.resourceUri,
                    isDirty: false,
                } as any,
            ]);

            expect(await TreeViewUtils.errorForUnsavedResource(ps)).toBe(false);
            expect(globalMocks.errorMessage).not.toHaveBeenCalled();
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
            const globalMocks = getglobalMocks();

            const textDocumentsMock = jest.replaceProperty(vscode.workspace, "textDocuments", [
                {
                    fileName: pdsMember.resourceUri?.fsPath as any,
                    uri: pdsMember.resourceUri,
                    isDirty: true,
                } as any,
            ]);

            expect(await TreeViewUtils.errorForUnsavedResource(pds)).toBe(true);
            expect(globalMocks.errorMessage).toHaveBeenCalledWith(
                "Unable to rename TEST.PDS because you have unsaved changes in this data set. " + "Please save your work and try again.",
                { vsCodeOpts: { modal: true } }
            );
            textDocumentsMock.restore();
        });
    });
});
