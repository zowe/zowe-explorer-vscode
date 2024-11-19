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

import { TreeViewUtils } from "../../../src/utils/TreeViewUtils";
import * as globals from "../../../src/globals";
import * as vscode from "vscode";
import { Gui } from "@zowe/zowe-explorer-api";
import { Profiles } from "../../../src/Profiles";
import { ZoweUSSNode } from "../../../src/uss/ZoweUSSNode";
import { createIProfile, createISession } from "../../../__mocks__/mockCreators/shared";
import { createUSSSessionNode } from "../../../__mocks__/mockCreators/uss";
import { createDatasetSessionNode } from "../../../__mocks__/mockCreators/datasets";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";

describe("TreeViewUtils Unit Tests", () => {
    it("refreshIconOnCollapse - generated listener function works as intended", () => {
        const testTreeProvider = { mOnDidChangeTreeData: { fire: jest.fn() } } as any;
        const listenerFn = TreeViewUtils.refreshIconOnCollapse(
            [(node): boolean => (node.contextValue as any).includes(globals.DS_PDS_CONTEXT) as boolean],
            testTreeProvider
        );
        const element = { label: "somenode", contextValue: globals.DS_PDS_CONTEXT } as any;
        listenerFn({ element });
        expect(testTreeProvider.mOnDidChangeTreeData.fire).toHaveBeenCalledWith(element);
    });

    describe("errorForUnsavedResource", () => {
        function getBlockMocks(): Record<string, jest.SpyInstance> {
            return {
                errorMessage: jest.spyOn(Gui, "errorMessage").mockClear(),
                profilesInstance: jest.spyOn(Profiles, "getInstance").mockReturnValue({
                    loadNamedProfile: jest.fn().mockReturnValue(createIProfile()),
                    checkCurrentProfile: jest.fn(),
                } as any),
            };
        }
        it("prompts for an unsaved USS file", async () => {
            const ussNode = new ZoweUSSNode({
                label: "testFile.txt",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                profile: createIProfile(),
                parentNode: createUSSSessionNode(createISession(), createIProfile()),
            });
            const blockMocks = getBlockMocks();

            const textDocumentsMock = jest.replaceProperty(vscode.workspace, "textDocuments", [
                {
                    fileName: ussNode.getUSSDocumentFilePath() as any,
                    uri: vscode.Uri.file(ussNode.getUSSDocumentFilePath()),
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
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                profile: createIProfile(),
                parentNode: createUSSSessionNode(createISession(), createIProfile()),
            });
            const blockMocks = getBlockMocks();

            const ussNode = new ZoweUSSNode({
                label: "testFile.txt",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                profile: createIProfile(),
                parentNode: ussFolder,
            });

            const textDocumentsMock = jest.replaceProperty(vscode.workspace, "textDocuments", [
                {
                    fileName: ussNode.getUSSDocumentFilePath(),
                    uri: vscode.Uri.file(ussNode.getUSSDocumentFilePath()),
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
                contextOverride: globals.DS_DS_CONTEXT,
                profile: createIProfile(),
                parentNode: createDatasetSessionNode(createISession(), createIProfile()),
            });
            const blockMocks = getBlockMocks();

            const textDocumentsMock = jest.replaceProperty(vscode.workspace, "textDocuments", [
                {
                    fileName: ps.getDsDocumentFilePath(),
                    uri: vscode.Uri.file(ps.getDsDocumentFilePath()),
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
                contextOverride: globals.DS_DS_CONTEXT,
                profile: createIProfile(),
                parentNode: createDatasetSessionNode(createISession(), createIProfile()),
            });
            const blockMocks = getBlockMocks();

            const textDocumentsMock = jest.replaceProperty(vscode.workspace, "textDocuments", [
                {
                    fileName: ps.getDsDocumentFilePath(),
                    uri: vscode.Uri.file(ps.getDsDocumentFilePath()),
                    isDirty: false,
                } as any,
            ]);

            expect(await TreeViewUtils.errorForUnsavedResource(ps)).toBe(false);
            expect(blockMocks.errorMessage).not.toHaveBeenCalled();
            textDocumentsMock.restore();
        });

        it("prompts for an unsaved PDS member", async () => {
            const pds = new ZoweDatasetNode({
                label: "TEST.PDS.JCL",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                contextOverride: globals.DS_PDS_CONTEXT,
                profile: createIProfile(),
                parentNode: createDatasetSessionNode(createISession(), createIProfile()),
            });

            const pdsMember = new ZoweDatasetNode({
                label: "MEMB",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                contextOverride: globals.DS_MEMBER_CONTEXT,
                profile: createIProfile(),
                parentNode: pds,
            });
            const blockMocks = getBlockMocks();

            const textDocumentsMock = jest.replaceProperty(vscode.workspace, "textDocuments", [
                {
                    fileName: pdsMember.getDsDocumentFilePath(),
                    uri: vscode.Uri.file(pdsMember.getDsDocumentFilePath()),
                    isDirty: true,
                } as any,
            ]);

            expect(await TreeViewUtils.errorForUnsavedResource(pds)).toBe(true);
            expect(blockMocks.errorMessage).toHaveBeenCalledWith(
                "Unable to rename TEST.PDS.JCL because you have unsaved changes in this data set. " + "Please save your work and try again.",
                { vsCodeOpts: { modal: true } }
            );
            textDocumentsMock.restore();
        });
    });
});
