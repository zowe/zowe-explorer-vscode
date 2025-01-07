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

import * as sharedUtils from "../../../src/shared/utils";
import * as globals from "../../../src/globals";
import { imperative } from "@zowe/cli";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import * as vscode from "vscode";
import * as path from "path";
import {
    createIProfile,
    createISessionWithoutCredentials,
    createISession,
    createFileResponse,
    createInstanceOfProfile,
    createTextDocument,
} from "../../../__mocks__/mockCreators/shared";
import { createDatasetSessionNode } from "../../../__mocks__/mockCreators/datasets";
import { ZoweUSSNode } from "../../../src/uss/ZoweUSSNode";
import { ZoweJobNode } from "../../../src/job/ZoweJobNode";
import { ZoweExplorerApiRegister } from "../../../src/ZoweExplorerApiRegister";
import { Profiles } from "../../../src/Profiles";
import * as utils from "../../../src/utils/ProfilesUtils";
import { Gui, IZoweDatasetTreeNode, IZoweTreeNode, IZoweUSSTreeNode, ProfilesCache, ZosEncoding } from "@zowe/zowe-explorer-api";
import { ZoweLogger } from "../../../src/utils/LoggerUtils";
import { LocalStorageKey, ZoweLocalStorage } from "../../../src/utils/ZoweLocalStorage";
import { LocalFileManagement } from "../../../src/utils/LocalFileManagement";

jest.mock("fs");

async function createGlobalMocks() {
    const newMocks = {
        session: createISession(),
        profileOne: createIProfile(),
        mockGetInstance: jest.fn(),
        mockProfileInstance: null,
        mockProfilesCache: null,
        mockExecuteCommand: jest.fn(),
        openTextDocument: jest.fn(),
        mockShowTextDocument: jest.fn(),
        mockTextDocument: { fileName: `/test/path/temp/_U_/sestest/test/node`, isDirty: true },
    };
    newMocks.mockProfilesCache = new ProfilesCache(imperative.Logger.getAppLogger());
    newMocks.mockProfileInstance = createInstanceOfProfile(createIProfile());
    Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });
    Object.defineProperty(Profiles, "CreateInstance", {
        value: () => newMocks.mockProfileInstance,
        configurable: true,
    });
    Object.defineProperty(Profiles, "getInstance", {
        value: () => newMocks.mockProfileInstance,
        configurable: true,
    });
    Object.defineProperty(vscode.commands, "executeCommand", {
        value: newMocks.mockExecuteCommand,
        configurable: true,
    });
    Object.defineProperty(vscode.workspace, "openTextDocument", {
        value: newMocks.openTextDocument,
        configurable: true,
    });
    Object.defineProperty(Gui, "showTextDocument", {
        value: newMocks.mockShowTextDocument,
        configurable: true,
    });

    Object.defineProperty(newMocks.mockProfilesCache, "getConfigInstance", {
        value: jest.fn(() => {
            return {
                usingTeamConfig: false,
            };
        }),
    });

    return newMocks;
}

describe("Shared Utils Unit Tests - Function node.concatChildNodes()", () => {
    it("Checks that concatChildNodes returns the proper array of children", async () => {
        const globalMocks = await createGlobalMocks();
        const rootNode = new ZoweUSSNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.session,
        });
        const childNode1 = new ZoweUSSNode({
            label: "child1",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: rootNode,
            session: globalMocks.session,
        });
        const childNode2 = new ZoweUSSNode({
            label: "child2",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: childNode1,
            session: globalMocks.session,
        });

        childNode1.children.push(childNode2);
        rootNode.children.push(childNode1);

        const returnedArray = sharedUtils.concatChildNodes([rootNode]);
        expect(returnedArray).toEqual([childNode2, childNode1, rootNode]);
    });
});

describe("syncSessionNode shared util function", () => {
    const serviceProfile = {
        name: "test",
        profile: {},
        type: "zosmf",
        message: "",
        failNotFound: true,
    };

    const sessionNode = createDatasetSessionNode(undefined, serviceProfile);

    it("should update a session and a profile in the provided node", async () => {
        const globalMocks = await createGlobalMocks();
        // given
        Object.defineProperty(globalMocks.mockProfilesCache, "loadNamedProfile", {
            value: jest.fn().mockReturnValue(createIProfile()),
        });
        const expectedSession = new imperative.Session({});
        const sessionForProfile = () => new imperative.Session({});
        // when
        await utils.syncSessionNode(Profiles.getInstance())(sessionForProfile)(sessionNode);
        expect(await sessionNode.getSession()).toEqual(expectedSession);
        expect(await sessionNode.getProfile()).toEqual(createIProfile());
    });
    it("should do nothing, if there is no profile from provided node in the file system", async () => {
        const profiles = createInstanceOfProfile(serviceProfile);
        profiles.loadNamedProfile = jest.fn(() =>
            jest.fn(() => {
                throw new Error(`There is no such profile with name: ${serviceProfile.name}`);
            })
        );
        profiles.getBaseProfile = jest.fn(() => undefined);
        // when
        const dummyFn = () => new imperative.Session({});
        await utils.syncSessionNode(profiles)(dummyFn)(sessionNode);
        // then
        const initialSession = sessionNode.getSession();
        const initialProfile = sessionNode.getProfile();
        expect(sessionNode.getSession()).toEqual(initialSession);
        expect(sessionNode.getProfile()).toEqual(initialProfile);
    });
});

describe("Positive testing", () => {
    it("should pass for ZoweDatasetTreeNode with ZoweDatasetNode node type", async () => {
        const dsNode = new ZoweDatasetNode({ label: "", collapsibleState: vscode.TreeItemCollapsibleState.None });
        const value = sharedUtils.isZoweDatasetTreeNode(dsNode);
        expect(value).toBeTruthy();
    });
    it("should pass for ZoweUSSTreeNode with ZoweUSSNode node type", async () => {
        const ussNode = new ZoweUSSNode({ label: "", collapsibleState: vscode.TreeItemCollapsibleState.None });
        const value = sharedUtils.isZoweUSSTreeNode(ussNode);
        expect(value).toBeTruthy();
    });
    it("should pass for ZoweJobTreeNode with ZoweJobNode node type", async () => {
        const jobNode = new ZoweJobNode({ label: "", collapsibleState: vscode.TreeItemCollapsibleState.None });
        const value = sharedUtils.isZoweJobTreeNode(jobNode);
        expect(value).toBeTruthy();
    });
});

describe("Negative testing for ZoweDatasetTreeNode", () => {
    it("should fail with ZoweUSSNode node type", async () => {
        const ussNode = new ZoweUSSNode({ label: "", collapsibleState: vscode.TreeItemCollapsibleState.None });
        const value = sharedUtils.isZoweDatasetTreeNode(ussNode);
        expect(value).toBeFalsy();
    });
    it("should fail with ZoweJobNode node type", async () => {
        const jobNode = new ZoweJobNode({ label: "", collapsibleState: vscode.TreeItemCollapsibleState.None });
        const value = sharedUtils.isZoweDatasetTreeNode(jobNode);
        expect(value).toBeFalsy();
    });
});

describe("Negative testing for ZoweUSSTreeNode", () => {
    it("should fail with ZoweDatasetNode node type", async () => {
        const dsNode = new ZoweDatasetNode({ label: "", collapsibleState: vscode.TreeItemCollapsibleState.None });
        const value = sharedUtils.isZoweUSSTreeNode(dsNode);
        expect(value).toBeFalsy();
    });
    it("should fail with ZoweJobNode node type", async () => {
        const jobNode = new ZoweJobNode({ label: "", collapsibleState: vscode.TreeItemCollapsibleState.None });
        const value = sharedUtils.isZoweUSSTreeNode(jobNode);
        expect(value).toBeFalsy();
    });
});

describe("Negative testing for ZoweJobTreeNode", () => {
    it("should fail with ZoweDatasetNode node type", async () => {
        const dsNode = new ZoweDatasetNode({ label: "", collapsibleState: vscode.TreeItemCollapsibleState.None });
        const value = sharedUtils.isZoweJobTreeNode(dsNode);
        expect(value).toBeFalsy();
    });
    it("should fail with ZoweUSSNode node type", async () => {
        const ussNode = new ZoweUSSNode({ label: "", collapsibleState: vscode.TreeItemCollapsibleState.None });
        const value = sharedUtils.isZoweJobTreeNode(ussNode);
        expect(value).toBeFalsy();
    });
});

describe("Test uploadContent", () => {
    it("should test with uss node that new API method is called if it exists", async () => {
        const putContent = jest.fn();
        ZoweExplorerApiRegister.getUssApi = jest.fn<any, Parameters<typeof ZoweExplorerApiRegister.getUssApi>>(
            (profile: imperative.IProfileLoaded) => {
                return {
                    putContent,
                };
            }
        );

        await sharedUtils.uploadContent(
            new ZoweUSSNode({ label: "", collapsibleState: vscode.TreeItemCollapsibleState.None }),
            {
                fileName: "whatever",
            } as any,
            null,
            {
                profile: {
                    encoding: 123,
                },
            } as any
        );
        expect(ZoweExplorerApiRegister.getUssApi(null).putContent).toBeCalledWith("whatever", null, expect.objectContaining({ encoding: 123 }));
    });

    it("should test with uss node that old API method is called", async () => {
        const putContents = jest.fn();
        ZoweExplorerApiRegister.getUssApi = jest.fn<any, Parameters<typeof ZoweExplorerApiRegister.getUssApi>>(
            (profile: imperative.IProfileLoaded) => {
                return {
                    putContents,
                };
            }
        );

        await sharedUtils.uploadContent(
            new ZoweUSSNode({ label: "", collapsibleState: vscode.TreeItemCollapsibleState.None }),
            {
                fileName: "whatever",
            } as any,
            null,
            {
                profile: {
                    encoding: 123,
                },
            } as any
        );
        expect(ZoweExplorerApiRegister.getUssApi(null).putContents).toBeCalled();
    });

    it("should test with data set node that old API method is called", async () => {
        const putContents = jest.fn();
        ZoweExplorerApiRegister.getMvsApi = jest.fn<any, Parameters<typeof ZoweExplorerApiRegister.getMvsApi>>(
            (profile: imperative.IProfileLoaded) => {
                return {
                    putContents,
                };
            }
        );

        const session = createISessionWithoutCredentials();
        const imperativeProfile = createIProfile();
        const codepage = 285;
        imperativeProfile.profile.encoding = codepage;
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        await sharedUtils.uploadContent(
            datasetSessionNode,
            {
                fileName: "whatever",
            } as any,
            null,
            {
                profile: {
                    encoding: codepage,
                },
            } as any
        );
        expect(ZoweExplorerApiRegister.getMvsApi(null).putContents).toBeCalledWith("whatever", null, expect.objectContaining({ encoding: codepage }));
    });

    it("should test with missing node that uploadContent throws error", async () => {
        await expect(
            sharedUtils.uploadContent(
                null,
                {
                    fileName: "whatever",
                } as any,
                null
            )
        ).rejects.toThrow("Could not find whatever in tree");
    });
});

describe("Test force upload", () => {
    async function createBlockMocks() {
        const newVariables = {
            dsNode: new ZoweDatasetNode({ label: "", collapsibleState: vscode.TreeItemCollapsibleState.None }),
            ussNode: new ZoweUSSNode({ label: "", collapsibleState: vscode.TreeItemCollapsibleState.None }),
            showInformationMessage: jest.fn(),
            showWarningMessage: jest.fn(),
            showErrorMessage: jest.fn(),
            getMvsApi: jest.fn(),
            getUssApi: jest.fn(),
            withProgress: jest.fn(),
            fileResponse: createFileResponse([{ etag: null }]),
            ProgressLocation: jest.fn().mockImplementation(() => {
                return {
                    Notification: 15,
                };
            }),
            mockDoc: createTextDocument("mocDoc"),
        };

        Object.defineProperty(vscode.window, "showInformationMessage", {
            value: newVariables.showInformationMessage,
            configurable: true,
        });
        Object.defineProperty(vscode.window, "showWarningMessage", {
            value: newVariables.showWarningMessage,
            configurable: true,
        });
        Object.defineProperty(vscode.window, "showErrorMessage", {
            value: newVariables.showErrorMessage,
            configurable: true,
        });
        Object.defineProperty(ZoweExplorerApiRegister, "getMvsApi", {
            value: newVariables.getMvsApi,
            configurable: true,
        });
        Object.defineProperty(ZoweExplorerApiRegister, "getUssApi", {
            value: newVariables.getUssApi,
            configurable: true,
        });
        Object.defineProperty(vscode.window, "withProgress", { value: newVariables.withProgress, configurable: true });
        Object.defineProperty(vscode.window, "activeTextEditor", { value: { edit: jest.fn() }, configurable: true });
        Object.defineProperty(vscode, "Position", {
            value: jest.fn(() => {
                return {};
            }),
            configurable: true,
        });
        Object.defineProperty(vscode, "Range", {
            value: jest.fn(() => {
                return {};
            }),
            configurable: true,
        });
        Object.defineProperty(vscode, "ProgressLocation", { value: newVariables.ProgressLocation, configurable: true });
        jest.spyOn(LocalFileManagement, "storeFileInfo").mockImplementation();
        jest.spyOn(LocalFileManagement, "deleteFileInfo").mockImplementation();

        return newVariables;
    }

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should successfully call upload for a USS file if user clicks 'Yes'", async () => {
        const blockMocks = await createBlockMocks();
        blockMocks.showInformationMessage.mockResolvedValueOnce("Yes");
        blockMocks.withProgress.mockResolvedValueOnce(blockMocks.fileResponse);
        await sharedUtils.willForceUpload(blockMocks.ussNode, blockMocks.mockDoc, null);
        expect(blockMocks.withProgress).toBeCalledWith(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Saving file...",
            },
            expect.any(Function)
        );
        expect(blockMocks.showInformationMessage.mock.calls[1][0]).toBe(blockMocks.fileResponse.commandResponse);
    });

    it("should successfully call upload for a data set if user clicks 'Yes'", async () => {
        const blockMocks = await createBlockMocks();
        blockMocks.showInformationMessage.mockResolvedValueOnce("Yes");
        blockMocks.withProgress.mockResolvedValueOnce(blockMocks.fileResponse);
        await sharedUtils.willForceUpload(blockMocks.dsNode, blockMocks.mockDoc, null);
        expect(blockMocks.withProgress).toBeCalledWith(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Saving data set...",
            },
            expect.any(Function)
        );
        expect(blockMocks.showInformationMessage.mock.calls[1][0]).toBe(blockMocks.fileResponse.commandResponse);
    });

    it("should cancel upload if user clicks 'No'", async () => {
        const blockMocks = await createBlockMocks();
        blockMocks.showInformationMessage.mockResolvedValueOnce("No");
        await sharedUtils.willForceUpload(blockMocks.dsNode, blockMocks.mockDoc, null);
        expect(blockMocks.showInformationMessage.mock.calls[1][0]).toBe("Upload cancelled.");
    });

    it("should display specific message if Theia is detected", async () => {
        const blockMocks = await createBlockMocks();
        Object.defineProperty(globals, "ISTHEIA", { value: true });
        blockMocks.showInformationMessage.mockResolvedValueOnce("No");
        await sharedUtils.willForceUpload(blockMocks.dsNode, blockMocks.mockDoc, null);
        expect(blockMocks.showWarningMessage.mock.calls[0][0]).toBe(
            "A merge conflict has been detected. Since you are running inside Theia editor, a merge conflict resolution is not available yet."
        );
    });

    it("should show error message if file fails to upload", async () => {
        const blockMocks = await createBlockMocks();
        blockMocks.showInformationMessage.mockResolvedValueOnce("Yes");
        blockMocks.withProgress.mockResolvedValueOnce({ ...blockMocks.fileResponse, success: false });
        await sharedUtils.willForceUpload(blockMocks.ussNode, blockMocks.mockDoc, null);
        expect(blockMocks.withProgress).toBeCalledWith(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Saving file...",
            },
            expect.any(Function)
        );
        expect(blockMocks.showErrorMessage.mock.calls[0][0]).toBe(blockMocks.fileResponse.commandResponse);
    });

    it("should show error message if upload throws an error", async () => {
        const blockMocks = await createBlockMocks();
        blockMocks.showInformationMessage.mockResolvedValueOnce("Yes");
        const testError = new Error("Task failed successfully");
        blockMocks.withProgress.mockRejectedValueOnce(testError);
        await sharedUtils.willForceUpload(blockMocks.ussNode, blockMocks.mockDoc, null, { name: "fakeProfile" } as any);
        expect(blockMocks.withProgress).toBeCalledWith(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Saving file...",
            },
            expect.any(Function)
        );
        expect(blockMocks.showErrorMessage.mock.calls[0][0]).toBe(`Error: ${testError.message}`);
    });
});

describe("Shared Utils Unit Tests - Function filterTreeByString", () => {
    it("Testing that filterTreeByString returns the correct array", async () => {
        const qpItems = [
            new utils.FilterItem({ text: "[sestest]: HLQ.PROD2.STUFF1" }),
            new utils.FilterItem({ text: "[sestest]: HLQ.PROD3.STUFF2(TESTMEMB)" }),
            new utils.FilterItem({ text: "[sestest]: /test/tree/abc" }),
        ];

        let filteredValues = await sharedUtils.filterTreeByString("testmemb", qpItems);
        expect(filteredValues).toStrictEqual([qpItems[1]]);
        filteredValues = await sharedUtils.filterTreeByString("sestest", qpItems);
        expect(filteredValues).toStrictEqual(qpItems);
        filteredValues = await sharedUtils.filterTreeByString("HLQ.PROD2.STUFF1", qpItems);
        expect(filteredValues).toStrictEqual([qpItems[0]]);
        filteredValues = await sharedUtils.filterTreeByString("HLQ.*.STUFF*", qpItems);
        expect(filteredValues).toStrictEqual([qpItems[0], qpItems[1]]);
        filteredValues = await sharedUtils.filterTreeByString("/test/tree/abc", qpItems);
        expect(filteredValues).toStrictEqual([qpItems[2]]);
        filteredValues = await sharedUtils.filterTreeByString("*/abc", qpItems);
        expect(filteredValues).toStrictEqual([qpItems[2]]);
    });
});

describe("Shared Utils Unit Tests - Function getDocumentFilePath", () => {
    let blockMocks;
    function createBlockMocks() {
        const session = createISessionWithoutCredentials();
        const imperativeProfile = createIProfile();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);

        return {
            session,
            imperativeProfile,
            datasetSessionNode,
        };
    }

    it("Testing that the add Suffix for datasets works", async () => {
        blockMocks = createBlockMocks();
        globals.defineGlobals("/test/path/");

        let node = new ZoweDatasetNode({
            label: "AUSER.TEST.JCL(member)",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.JCL(member).jcl")
        );
        node = new ZoweDatasetNode({
            label: "AUSER.TEST.ASM(member)",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.ASM(member).asm")
        );
        node = new ZoweDatasetNode({
            label: "AUSER.COBOL.TEST(member)",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.COBOL.TEST(member).cbl")
        );
        node = new ZoweDatasetNode({
            label: "AUSER.PROD.PLI(member)",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.PROD.PLI(member).pli")
        );
        node = new ZoweDatasetNode({
            label: "AUSER.PROD.PLX(member)",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.PROD.PLX(member).pli")
        );
        node = new ZoweDatasetNode({
            label: "AUSER.PROD.SH(member)",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.PROD.SH(member).sh")
        );
        node = new ZoweDatasetNode({
            label: "AUSER.REXX.EXEC(member)",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.REXX.EXEC(member).rexx")
        );
        node = new ZoweDatasetNode({
            label: "AUSER.TEST.XML(member)",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.XML(member).xml")
        );

        node = new ZoweDatasetNode({
            label: "AUSER.TEST.XML",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.XML.xml")
        );
        node = new ZoweDatasetNode({
            label: "AUSER.TEST.TXML",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.TXML")
        );
        node = new ZoweDatasetNode({
            label: "AUSER.XML.TGML",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.XML.TGML.xml")
        );
        node = new ZoweDatasetNode({
            label: "AUSER.XML.ASM",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.XML.ASM.asm")
        );
        node = new ZoweDatasetNode({
            label: "AUSER",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER")
        );
        node = new ZoweDatasetNode({
            label: "AUSER.XML.TEST(member)",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.XML.TEST(member).xml")
        );
        node = new ZoweDatasetNode({
            label: "XML.AUSER.TEST(member)",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "XML.AUSER.TEST(member)")
        );
        node = new ZoweDatasetNode({
            label: "AUSER.COBOL.PL1.XML.TEST(member)",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.COBOL.PL1.XML.TEST(member).xml")
        );
        node = new ZoweDatasetNode({
            label: "AUSER.COBOL.PL1.XML.ASSEMBLER.TEST(member)",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.COBOL.PL1.XML.ASSEMBLER.TEST(member).asm")
        );
        node = new ZoweDatasetNode({
            label: "AUSER.TEST.COPYBOOK",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.COPYBOOK.cpy")
        );
        node = new ZoweDatasetNode({
            label: "AUSER.TEST.PLINC",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.PLINC.inc")
        );
        node = new ZoweDatasetNode({
            label: "AUSER.TEST.SPFLOG1",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toEqual(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.SPFLOG1.log")
        );
    });
});

describe("Shared Utils Unit Tests - Function getSelectedNodeList", () => {
    it("Testing that getSelectedNodeList returns the correct array when single node is selected", async () => {
        const selectedNodes = [];
        const aNode = createTestNode();
        selectedNodes.push(aNode);
        const nodeList = sharedUtils.getSelectedNodeList(aNode, selectedNodes);

        expect(nodeList).toEqual(selectedNodes);
    });

    it("Testing that getSelectedNodeList returns the correct array when single node is selected via quickKeys", async () => {
        const selectedNodes = undefined;
        const aNode = createTestNode();
        const nodeList = sharedUtils.getSelectedNodeList(aNode, selectedNodes);

        expect(nodeList[0]).toEqual(aNode);
    });

    it("Testing that getSelectedNodeList returns the correct array when multiple node is selected", async () => {
        const selectedNodes = [];
        const aNode = createTestNode();
        selectedNodes.push(aNode);
        const bNode = createTestNode();
        selectedNodes.push(bNode);
        const nodeList = sharedUtils.getSelectedNodeList(aNode, selectedNodes);

        expect(nodeList).toEqual(selectedNodes);
    });

    function createTestNode() {
        const node = new ZoweDatasetNode({ label: "testLabel", collapsibleState: vscode.TreeItemCollapsibleState.Collapsed });
        return node;
    }
});

describe("Shared utils unit tests - function sortTreeItems", () => {
    it("prioritizes context value when sorting", () => {
        const toSort = [
            { label: "A", contextValue: "some_context" },
            { label: "Z", contextValue: "some_other_context" },
            { label: "Y", contextValue: "some_context" },
            { label: "X", contextValue: "some_context" },
            { label: "W", contextValue: "some_other_context" },
            { label: "V", contextValue: "some_context" },
            { label: "U", contextValue: "some_other_context" },
            { label: "T", contextValue: "some_other_context" },
            { label: "B", contextValue: "some_other_context" },
        ];
        sharedUtils.sortTreeItems(toSort, "some_context");
        expect(toSort).toStrictEqual([
            { label: "A", contextValue: "some_context" },
            { label: "V", contextValue: "some_context" },
            { label: "X", contextValue: "some_context" },
            { label: "Y", contextValue: "some_context" },
            { label: "B", contextValue: "some_other_context" },
            { label: "T", contextValue: "some_other_context" },
            { label: "U", contextValue: "some_other_context" },
            { label: "W", contextValue: "some_other_context" },
            { label: "Z", contextValue: "some_other_context" },
        ]);
    });
});

describe("Shared utils unit tests - function compareFileContent", () => {
    beforeEach(() => {
        jest.spyOn(LocalFileManagement, "storeFileInfo").mockImplementation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should test with uss node that getContents is called", async () => {
        const getContents = jest.fn();
        ZoweExplorerApiRegister.getUssApi = jest.fn<any, Parameters<typeof ZoweExplorerApiRegister.getUssApi>>(
            (profile: imperative.IProfileLoaded) => {
                return {
                    getContents,
                };
            }
        );

        await sharedUtils.compareFileContent(
            {
                fileName: "whatever",
                getText: jest.fn().mockReturnValue(""),
            } as any,
            new ZoweUSSNode({
                label: "",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                profile: {
                    profile: {
                        encoding: 123,
                    },
                } as any,
            }),
            null
        );
        expect(ZoweExplorerApiRegister.getUssApi(null).getContents).toBeCalledWith("", expect.objectContaining({ encoding: 123 }));
    });

    it("should test with data set node that getContents is called", async () => {
        const getContents = jest.fn();
        ZoweExplorerApiRegister.getMvsApi = jest.fn<any, Parameters<typeof ZoweExplorerApiRegister.getMvsApi>>(
            (profile: imperative.IProfileLoaded) => {
                return {
                    getContents,
                };
            }
        );
        jest.spyOn(LocalFileManagement, "storeFileInfo").mockImplementation();

        const session = createISessionWithoutCredentials();
        const imperativeProfile = createIProfile();
        const codepage = 285;
        imperativeProfile.profile.encoding = codepage;
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: jest.fn().mockReturnValue(imperativeProfile),
                };
            }),
        });
        await sharedUtils.compareFileContent(
            {
                fileName: "whatever",
                getText: jest.fn().mockReturnValue(""),
            } as any,
            datasetSessionNode,
            null,
            {
                profile: {
                    encoding: codepage,
                },
            } as any
        );
        expect(ZoweExplorerApiRegister.getMvsApi(null).getContents).toBeCalledWith(null, expect.objectContaining({ encoding: codepage }));
    });

    it("should test with missing node that compareFileContent throws error", async () => {
        await expect(
            sharedUtils.compareFileContent(
                {
                    fileName: "whatever",
                    uri: { fsPath: "whatever" },
                } as any,
                null,
                null
            )
        ).rejects.toThrow("Could not find whatever in tree");
    });
});

describe("Shared utils unit tests - function updateOpenFiles", () => {
    const someTree = { openFiles: {} };
    const testDsPath = path.join("~", "temp", "_D_", "dsname");
    const testUssPath = path.join("~", "temp", "_U_", "fspath");

    beforeAll(() => {
        globals.defineGlobals("~");
    });

    it("sets a file entry to null in the openFiles record", () => {
        const deleteFileInfoSpy = jest.spyOn(LocalFileManagement, "deleteFileInfo").mockImplementation();
        sharedUtils.updateOpenFiles(someTree as any, testDsPath, null);
        expect(someTree.openFiles[testDsPath]).toBeNull();
        expect(deleteFileInfoSpy).toHaveBeenCalledTimes(1);
    });

    it("sets a file entry to a valid node in the openFiles record", () => {
        const storeFileInfoSpy = jest.spyOn(LocalFileManagement, "storeFileInfo").mockImplementation();
        sharedUtils.updateOpenFiles(someTree as any, testDsPath, { label: "testDsLabel" } as IZoweTreeNode);
        sharedUtils.updateOpenFiles(someTree as any, testUssPath, { label: "testUssLabel" } as IZoweTreeNode);
        expect(someTree.openFiles[testDsPath].label).toBe("testDsLabel");
        expect(someTree.openFiles[testUssPath].label).toBe("testUssLabel");
        expect(storeFileInfoSpy).toHaveBeenCalledTimes(2);
    });

    it("does nothing if openFiles is not defined", () => {
        someTree.openFiles = undefined as any;
        sharedUtils.updateOpenFiles(someTree as any, testDsPath, null);
        expect(someTree.openFiles).toBeUndefined();
    });
});

describe("Shared utils unit tests - function promptForEncoding", () => {
    const binaryEncoding: ZosEncoding = { kind: "binary" };
    const textEncoding: ZosEncoding = { kind: "text" };
    const otherEncoding: ZosEncoding = { kind: "other", codepage: "IBM-1047" };

    function createBlockMocks() {
        const showInputBox = jest.spyOn(Gui, "showInputBox").mockResolvedValue(undefined);
        const showQuickPick = jest.spyOn(Gui, "showQuickPick").mockResolvedValue(undefined);
        const localStorageGet = jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue(undefined);
        const localStorageSet = jest.spyOn(ZoweLocalStorage, "setValue").mockReturnValue(undefined);

        return {
            profile: createIProfile(),
            session: createISession(),
            showInputBox,
            showQuickPick,
            localStorageGet,
            localStorageSet,
        };
    }

    afterEach(() => {
        jest.resetAllMocks();
    });

    it("prompts for text encoding for USS file", async () => {
        const blockMocks = createBlockMocks();
        const node = new ZoweUSSNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentPath: "/root",
        });
        blockMocks.showQuickPick.mockImplementationOnce(async (items) => items[0]);
        const encoding = await sharedUtils.promptForEncoding(node);
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect(encoding).toEqual(textEncoding);
    });

    it("prompts for binary encoding for USS file", async () => {
        const blockMocks = createBlockMocks();
        const node = new ZoweUSSNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentPath: "/root",
        });
        blockMocks.showQuickPick.mockImplementationOnce(async (items) => items[1]);
        const encoding = await sharedUtils.promptForEncoding(node);
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect(encoding).toEqual(binaryEncoding);
    });

    it("prompts for other encoding for USS file and returns codepage", async () => {
        const blockMocks = createBlockMocks();
        const node = new ZoweUSSNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentPath: "/root",
        });
        blockMocks.showQuickPick.mockImplementationOnce(async (items) => items[2]);
        blockMocks.showInputBox.mockResolvedValueOnce("IBM-1047");
        const encoding = await sharedUtils.promptForEncoding(node);
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect(blockMocks.showInputBox).toHaveBeenCalled();
        expect(encoding).toEqual(otherEncoding);
    });

    it("prompts for other encoding for USS file and returns undefined", async () => {
        const blockMocks = createBlockMocks();
        const node = new ZoweUSSNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentPath: "/root",
        });
        blockMocks.showQuickPick.mockImplementationOnce(async (items) => items[2]);
        blockMocks.showInputBox.mockResolvedValueOnce(undefined);
        const encoding = await sharedUtils.promptForEncoding(node);
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect(blockMocks.showInputBox).toHaveBeenCalled();
        expect(encoding).toBeUndefined();
    });

    it("prompts for encoding for tagged USS file", async () => {
        const blockMocks = createBlockMocks();
        const node = new ZoweUSSNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentPath: "/root",
        });
        node.setEncoding(binaryEncoding);
        await sharedUtils.promptForEncoding(node, "IBM-1047");
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect(await blockMocks.showQuickPick.mock.calls[0][0][0]).toEqual({ label: "IBM-1047", description: "USS file tag" });
        expect(blockMocks.showQuickPick.mock.calls[0][1]).toEqual(expect.objectContaining({ placeHolder: "Current encoding is Binary" }));
    });

    it("prompts for encoding for tagged USS binary file", async () => {
        const blockMocks = createBlockMocks();
        const node = new ZoweUSSNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentPath: "/root",
        });
        node.setEncoding(binaryEncoding);
        blockMocks.showQuickPick.mockImplementationOnce(async (items) => items[0]);
        const encoding = await sharedUtils.promptForEncoding(node, "binary");
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect(await blockMocks.showQuickPick.mock.calls[0][0][0]).toEqual({ label: "binary", description: "USS file tag" });
        expect(encoding).toEqual({ kind: "binary" });
    });

    it("prompts for encoding for USS file when profile contains encoding", async () => {
        const blockMocks = createBlockMocks();
        (blockMocks.profile.profile as any).encoding = "IBM-1047";
        const node = new ZoweUSSNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentPath: "/root",
        });
        node.setEncoding(textEncoding);
        await sharedUtils.promptForEncoding(node);
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect(await blockMocks.showQuickPick.mock.calls[0][0][0]).toEqual({
            label: "IBM-1047",
            description: `From profile ${blockMocks.profile.name}`,
        });
        expect(blockMocks.showQuickPick.mock.calls[0][1]).toEqual(expect.objectContaining({ placeHolder: "Current encoding is EBCDIC" }));
    });

    it("prompts for encoding for USS file and shows recent values", async () => {
        const blockMocks = createBlockMocks();
        const node = new ZoweUSSNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentPath: "/root",
        });
        node.setEncoding(otherEncoding);
        const encodingHistory = ["IBM-123", "IBM-456", "IBM-789"];
        blockMocks.localStorageGet.mockReturnValueOnce(encodingHistory);
        blockMocks.showQuickPick.mockImplementationOnce(async (items) => items[3]);
        const encoding = await sharedUtils.promptForEncoding(node);
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect((await blockMocks.showQuickPick.mock.calls[0][0]).slice(3)).toEqual(encodingHistory.map((x) => ({ label: x })));
        expect(blockMocks.showQuickPick.mock.calls[0][1]).toEqual(expect.objectContaining({ placeHolder: "Current encoding is IBM-1047" }));
        expect(encoding).toEqual({ ...otherEncoding, codepage: encodingHistory[0] });
    });

    it("remembers cached encoding for USS node", async () => {
        const blockMocks = createBlockMocks();
        const node = new ZoweUSSNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentPath: "/root",
        });
        node.setEncoding(binaryEncoding);
        delete node.encoding; // Reset encoding property so that cache is used
        await sharedUtils.promptForEncoding(node);
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect(blockMocks.showQuickPick.mock.calls[0][1]).toEqual(expect.objectContaining({ placeHolder: "Current encoding is Binary" }));
    });

    it("remembers cached encoding for data set node", async () => {
        const blockMocks = createBlockMocks();
        const node = new ZoweDatasetNode({
            label: "TEST.PS",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.profile,
        });
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: jest.fn().mockReturnValue(blockMocks.profile),
                };
            }),
        });
        node.setEncoding(textEncoding);
        delete node.encoding; // Reset encoding property so that cache is used
        await sharedUtils.promptForEncoding(node);
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect(blockMocks.showQuickPick.mock.calls[0][1]).toEqual(expect.objectContaining({ placeHolder: "Current encoding is EBCDIC" }));
    });

    it("remembers cached encoding for data set member node", async () => {
        const blockMocks = createBlockMocks();
        const parentNode = new ZoweDatasetNode({
            label: "TEST.PDS",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: blockMocks.session,
        });
        const node = new ZoweDatasetNode({
            label: "MEMBER",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            profile: blockMocks.profile,
            parentNode,
            contextOverride: globals.DS_MEMBER_CONTEXT,
        });
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: jest.fn().mockReturnValue(blockMocks.profile),
                };
            }),
        });
        node.setEncoding(otherEncoding);
        delete node.encoding; // Reset encoding property so that cache is used
        await sharedUtils.promptForEncoding(node);
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect(blockMocks.showQuickPick.mock.calls[0][1]).toEqual(expect.objectContaining({ placeHolder: "Current encoding is IBM-1047" }));
    });

    it("Prompts for other encoding for USS file and make sure new encoding is added to the beginning of the history", async () => {
        const blockMocks = createBlockMocks();
        const node = new ZoweUSSNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentPath: "/root",
        });
        node.setEncoding(otherEncoding);
        const encodingHistory = ["IBM-123", "IBM-456", "IBM-789"];
        blockMocks.localStorageGet.mockReturnValueOnce(encodingHistory);
        blockMocks.showQuickPick.mockImplementationOnce(async (items) => items[2]);
        blockMocks.showInputBox.mockResolvedValueOnce(otherEncoding.codepage); // "IBM-1047"
        await sharedUtils.promptForEncoding(node);
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect(blockMocks.showInputBox).toHaveBeenCalled();

        //spy on ZoweLocalStorage "zowe.encodingHistory"
        const setValueSpy = jest.spyOn(ZoweLocalStorage, "setValue");
        expect(setValueSpy).toBeCalledWith(LocalStorageKey.ENCODING_HISTORY, [otherEncoding.codepage].concat(encodingHistory));
    });

    it("Prompts for other encoding for USS file and supply an existing encoding and filter/move it to the front", async () => {
        const blockMocks = createBlockMocks();
        const node = new ZoweUSSNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentPath: "/root",
        });
        node.setEncoding(otherEncoding);
        const encodingHistory = ["IBM-123", "IBM-456", "IBM-789"];
        blockMocks.localStorageGet.mockReturnValueOnce(encodingHistory);
        blockMocks.showQuickPick.mockImplementationOnce(async (items) => items[2]);
        blockMocks.showInputBox.mockResolvedValueOnce(encodingHistory[2]);
        await sharedUtils.promptForEncoding(node);
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect(blockMocks.showInputBox).toHaveBeenCalled();

        //spy on ZoweLocalStorage "zowe.encodingHistory"
        const setValueSpy = jest.spyOn(ZoweLocalStorage, "setValue");
        encodingHistory.unshift(encodingHistory.splice(2, 1)[0]); // shift 3rd value to front to match with local storage
        expect(setValueSpy).toBeCalledWith(LocalStorageKey.ENCODING_HISTORY, encodingHistory);
    });

    it("Prompts for other encoding for USS file and add encoding in lowercase and expect to save it in upper case", async () => {
        const blockMocks = createBlockMocks();
        const node = new ZoweUSSNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentPath: "/root",
        });
        node.setEncoding(otherEncoding);
        const encodingHistory = ["IBM-123", "IBM-456", "IBM-789"];
        blockMocks.localStorageGet.mockReturnValueOnce(encodingHistory);
        blockMocks.showQuickPick.mockImplementationOnce(async (items) => items[2]);
        blockMocks.showInputBox.mockResolvedValueOnce("utf-8"); // add "utf-8" encoding in lowercase
        await sharedUtils.promptForEncoding(node);

        const setValueSpy = jest.spyOn(ZoweLocalStorage, "setValue");
        // receive added encoding in upper case (first entry)
        expect(setValueSpy).toBeCalledWith(LocalStorageKey.ENCODING_HISTORY, ["UTF-8", "IBM-123", "IBM-456", "IBM-789"]);
        expect(setValueSpy);
    });
});

describe("Shared utils unit tests - function confirmForUnsavedDoc", () => {
    it("returns false for boolean properties if data set node doesn't have getDsDocumentFilePath", async () => {
        const fakeNode = { pattern: "someuser.*" } as IZoweDatasetTreeNode;
        await expect(sharedUtils.confirmForUnsavedDoc(fakeNode)).resolves.toStrictEqual({
            actionConfirmed: false,
            isUnsaved: false,
        });
    });
    it("returns false for boolean properties if USS node doesn't have getUSSDocumentFilePath", async () => {
        const fakeNode = { openUSS: jest.fn() } as any as IZoweUSSTreeNode;
        await expect(sharedUtils.confirmForUnsavedDoc(fakeNode)).resolves.toStrictEqual({
            actionConfirmed: false,
            isUnsaved: false,
        });
    });
    it("calls warningMessage when the editor for a file is dirty", async () => {
        vscode.window.visibleTextEditors = [
            {
                document: {
                    fileName: "fakeNode",
                    uri: {
                        fsPath: "/fakeNode",
                        path: "/fakeNode",
                    } as any,
                    isDirty: true,
                } as any,
            } as vscode.TextEditor,
        ];
        const fakeNode = { openUSS: jest.fn(), getUSSDocumentFilePath: jest.fn().mockReturnValue("/fakeNode") } as any as IZoweUSSTreeNode;
        const warnMessageMock = jest.spyOn(Gui, "warningMessage").mockResolvedValue("Confirm");
        const result = await sharedUtils.confirmForUnsavedDoc(fakeNode);
        expect(result.actionConfirmed).toBe(true);
        expect(result.isUnsaved).toBe(true);
        expect(warnMessageMock).toHaveBeenCalled();
    });
});
describe("Shared utils unit tests - function initializeFileOpening", () => {
    it("successfully handles binary data sets that should be re-downloaded", async () => {
        const globalMocks = await createGlobalMocks();

        jest.spyOn(vscode.workspace, "openTextDocument").mockRejectedValue("Test error!");
        jest.spyOn(Gui, "errorMessage").mockResolvedValue("Re-download");

        // Creating a test node
        const rootNode = new ZoweDatasetNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
        });
        rootNode.contextValue = globals.DS_SESSION_CONTEXT;
        const testNode = new ZoweDatasetNode({
            label: "TEST.DS",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: rootNode,
            profile: globalMocks.profileOne,
        });

        await sharedUtils.initializeFileOpening(testNode, testNode.fullPath);
        expect(globalMocks.mockExecuteCommand).toHaveBeenCalledWith("zowe.ds.openWithEncoding", testNode, { kind: "binary" });
    });

    it("successfully handles binary data sets that should be previewed", async () => {
        const globalMocks = await createGlobalMocks();

        // Creating a test node
        const rootNode = new ZoweDatasetNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
        });
        rootNode.contextValue = globals.DS_SESSION_CONTEXT;
        const testNode = new ZoweDatasetNode({
            label: "TEST.DS",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: rootNode,
            profile: globalMocks.profileOne,
            encoding: { kind: "binary" },
        });

        await sharedUtils.initializeFileOpening(testNode, testNode.fullPath, true);
        expect(globalMocks.mockExecuteCommand).toHaveBeenCalledWith("vscode.open", { fsPath: "", path: "" });
    });

    it("successfully handles text data sets that should be previewed", async () => {
        const globalMocks = await createGlobalMocks();

        jest.spyOn(vscode.workspace, "openTextDocument").mockResolvedValue(globalMocks.mockTextDocument as vscode.TextDocument);

        // Creating a test node
        const rootNode = new ZoweDatasetNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
        });
        rootNode.contextValue = globals.DS_SESSION_CONTEXT;
        const testNode = new ZoweDatasetNode({
            label: "TEST.DS",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: rootNode,
            profile: globalMocks.profileOne,
        });

        await sharedUtils.initializeFileOpening(testNode, testNode.fullPath, true);
        expect(globalMocks.mockShowTextDocument).toBeCalledWith(globalMocks.mockTextDocument, { preview: true });
    });

    it("successfully handles text data sets that shouldn't be previewed", async () => {
        const globalMocks = await createGlobalMocks();

        jest.spyOn(vscode.workspace, "openTextDocument").mockResolvedValue(globalMocks.mockTextDocument as vscode.TextDocument);

        // Creating a test node
        const rootNode = new ZoweDatasetNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
        });
        rootNode.contextValue = globals.DS_SESSION_CONTEXT;
        const testNode = new ZoweDatasetNode({
            label: "TEST.DS",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: rootNode,
            profile: globalMocks.profileOne,
        });

        await sharedUtils.initializeFileOpening(testNode, testNode.fullPath, false);
        expect(globalMocks.mockShowTextDocument).toBeCalledWith(globalMocks.mockTextDocument, { preview: false });
    });

    it("successfully handles binary USS files that should be re-downloaded", async () => {
        const globalMocks = await createGlobalMocks();

        jest.spyOn(vscode.workspace, "openTextDocument").mockRejectedValue("Test error!");
        jest.spyOn(Gui, "errorMessage").mockResolvedValue("Re-download");

        // Creating a test node
        const rootNode = new ZoweUSSNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
        });
        rootNode.contextValue = globals.USS_SESSION_CONTEXT;
        const testNode = new ZoweUSSNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: rootNode,
            profile: globalMocks.profileOne,
        });
        testNode.fullPath = "test/testFile";

        await sharedUtils.initializeFileOpening(testNode, testNode.fullPath);
        expect(globalMocks.mockExecuteCommand).toHaveBeenCalledWith("zowe.uss.openWithEncoding", testNode, { kind: "binary" });
    });

    it("successfully handles binary USS files that should be previewed", async () => {
        const globalMocks = await createGlobalMocks();

        // Creating a test node
        const rootNode = new ZoweUSSNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
        });
        rootNode.contextValue = globals.USS_SESSION_CONTEXT;
        const testNode = new ZoweUSSNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: rootNode,
            profile: globalMocks.profileOne,
            encoding: { kind: "binary" },
        });
        testNode.fullPath = "test/testFile";

        await sharedUtils.initializeFileOpening(testNode, testNode.fullPath, true);
        expect(globalMocks.mockExecuteCommand).toHaveBeenCalledWith("vscode.open", { fsPath: testNode.fullPath, path: testNode.fullPath });
    });

    it("successfully handles text USS files that should be previewed", async () => {
        const globalMocks = await createGlobalMocks();

        jest.spyOn(vscode.workspace, "openTextDocument").mockResolvedValue(globalMocks.mockTextDocument as vscode.TextDocument);

        // Creating a test node
        const rootNode = new ZoweUSSNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
        });
        rootNode.contextValue = globals.USS_SESSION_CONTEXT;
        const testNode = new ZoweUSSNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: rootNode,
            profile: globalMocks.profileOne,
        });
        testNode.fullPath = "test/testFile";

        await sharedUtils.initializeFileOpening(testNode, testNode.fullPath, true);
        expect(globalMocks.mockShowTextDocument).toBeCalledWith(globalMocks.mockTextDocument, { preview: true });
    });

    it("successfully handles text USS files that shouldn't be previewed", async () => {
        const globalMocks = await createGlobalMocks();

        jest.spyOn(vscode.workspace, "openTextDocument").mockResolvedValue(globalMocks.mockTextDocument as vscode.TextDocument);

        // Creating a test node
        const rootNode = new ZoweUSSNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.session,
            profile: globalMocks.profileOne,
        });
        rootNode.contextValue = globals.USS_SESSION_CONTEXT;
        const testNode = new ZoweUSSNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: rootNode,
            profile: globalMocks.profileOne,
        });
        testNode.fullPath = "test/testFile";

        await sharedUtils.initializeFileOpening(testNode, testNode.fullPath, false);
        expect(globalMocks.mockShowTextDocument).toBeCalledWith(globalMocks.mockTextDocument, { preview: false });
    });
});

describe("Shared utils unit tests - function debounce", () => {
    beforeAll(() => {
        jest.useFakeTimers();
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    it("executes a function twice when time between calls is long", () => {
        const mockEventHandler = jest.fn();
        const debouncedFn = sharedUtils.debounce(mockEventHandler, 100);
        debouncedFn();
        jest.runAllTimers();
        debouncedFn();
        jest.runAllTimers();
        expect(mockEventHandler).toHaveBeenCalledTimes(2);
    });

    it("executes a function only once when time between calls is short", () => {
        const mockEventHandler = jest.fn();
        const debouncedFn = sharedUtils.debounce(mockEventHandler, 100);
        debouncedFn();
        jest.advanceTimersByTime(10);
        debouncedFn();
        jest.runAllTimers();
        expect(mockEventHandler).toHaveBeenCalledTimes(1);
    });
});
