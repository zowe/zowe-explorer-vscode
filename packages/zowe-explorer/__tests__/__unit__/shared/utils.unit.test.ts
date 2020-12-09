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

import * as sharedUtils from "../../../src/shared/utils";
import * as globals from "../../../src/globals";
import { IProfileLoaded, Logger } from "@zowe/imperative";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import * as vscode from "vscode";
import * as path from "path";
import {
    createIProfile,
    createISessionWithoutCredentials,
    createISession,
    createFileResponse,
} from "../../../__mocks__/mockCreators/shared";
import { createDatasetSessionNode } from "../../../__mocks__/mockCreators/datasets";
import { ZoweUSSNode } from "../../../src/uss/ZoweUSSNode";
import { Job } from "../../../src/job/ZoweJobNode";
import { ZoweExplorerApiRegister } from "../../../src/ZoweExplorerApiRegister";
import { Profiles } from "../../../src/Profiles";
import * as utils from "../../../src/utils/ProfilesUtils";

jest.mock("path");

async function createGlobalMocks() {
    const newVariables = {
        session: createISession(),
        profileOne: createIProfile(),
        mockGetInstance: jest.fn(),
    };
    await Profiles.createInstance(Logger.getAppLogger());

    return newVariables;
}

describe("Shared Utils Unit Tests - Function node.concatChildNodes()", () => {
    it("Checks that concatChildNodes returns the proper array of children", async () => {
        const globalMocks = await createGlobalMocks();
        const rootNode = new ZoweUSSNode(
            "root",
            vscode.TreeItemCollapsibleState.Collapsed,
            null,
            globalMocks.session,
            null,
            false,
            null,
            undefined
        );
        const childNode1 = new ZoweUSSNode(
            "child1",
            vscode.TreeItemCollapsibleState.Collapsed,
            rootNode,
            globalMocks.session,
            null,
            false,
            null,
            undefined
        );
        const childNode2 = new ZoweUSSNode(
            "child2",
            vscode.TreeItemCollapsibleState.Collapsed,
            childNode1,
            globalMocks.session,
            null,
            false,
            null,
            undefined
        );

        childNode1.children.push(childNode2);
        rootNode.children.push(childNode1);

        const returnedArray = sharedUtils.concatChildNodes([rootNode]);
        expect(returnedArray).toEqual([childNode2, childNode1, rootNode]);
    });
});

describe("Shared Utils Unit Tests - Function node.labelRefresh()", () => {
    it("Checks that labelRefresh subtly alters the label", async () => {
        const globalMocks = await createGlobalMocks();
        const rootNode = new ZoweUSSNode(
            "gappy",
            vscode.TreeItemCollapsibleState.Collapsed,
            null,
            globalMocks.session,
            null,
            false,
            null,
            undefined
        );
        expect(rootNode.label === "gappy");
        sharedUtils.labelRefresh(rootNode);
        expect(rootNode.label === "gappy ");
        sharedUtils.labelRefresh(rootNode);
        expect(rootNode.label === "gappy");
    });
});

describe("Shared Utils Unit Tests - Function refreshTree()", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            log: Logger.getAppLogger(),
            imperativeProfile: createIProfile(),
            testDatasetSessionNode: null,
        };
        newMocks.testDatasetSessionNode = createDatasetSessionNode(globalMocks.session, newMocks.imperativeProfile);
        return newMocks;
    }
    it("should pass in appropriate profile type when getting all profiles to compare with session node", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        globalMocks.mockGetInstance.mockReturnValue(blockMocks.imperativeProfile);
        const getProfilesSpy = jest.spyOn(Profiles.getInstance(), "getProfiles");

        sharedUtils.refreshTree(blockMocks.testDatasetSessionNode);

        expect(getProfilesSpy).toBeCalledWith(globalMocks.profileOne.type);
    });
});

describe("Positive testing", () => {
    it("should pass for ZoweDatasetTreeNode with ZoweDatasetNode node type", async () => {
        const dsNode = new ZoweDatasetNode(null, null, null, null);
        const value = sharedUtils.isZoweDatasetTreeNode(dsNode);
        expect(value).toBeTruthy();
    });
    it("should pass for ZoweUSSTreeNode with ZoweUSSNode node type", async () => {
        const ussNode = new ZoweUSSNode(null, null, null, null, null);
        const value = sharedUtils.isZoweUSSTreeNode(ussNode);
        expect(value).toBeTruthy();
    });
    it("should pass for  ZoweJobTreeNode with Job node type", async () => {
        const jobNode = new Job(null, null, null, null, null, null);
        const value = sharedUtils.isZoweJobTreeNode(jobNode);
        expect(value).toBeTruthy();
    });
});

describe("Negative testing for ZoweDatasetTreeNode", () => {
    it("should fail with ZoweUSSNode node type", async () => {
        const ussNode = new ZoweUSSNode(null, null, null, null, null);
        const value = sharedUtils.isZoweDatasetTreeNode(ussNode);
        expect(value).toBeFalsy();
    });
    it("should fail with Job node type", async () => {
        const jobNode = new Job(null, null, null, null, null, null);
        const value = sharedUtils.isZoweDatasetTreeNode(jobNode);
        expect(value).toBeFalsy();
    });
});

describe("Negative testing for ZoweUSSTreeNode", () => {
    it("should fail with ZoweDatasetNode node type", async () => {
        const dsNode = new ZoweDatasetNode(null, null, null, null);
        const value = sharedUtils.isZoweUSSTreeNode(dsNode);
        expect(value).toBeFalsy();
    });
    it("should fail with Job node type", async () => {
        const jobNode = new Job(null, null, null, null, null, null);
        const value = sharedUtils.isZoweUSSTreeNode(jobNode);
        expect(value).toBeFalsy();
    });
});

describe("Negative testing for ZoweJobTreeNode", () => {
    it("should fail with ZoweDatasetNode node type", async () => {
        const dsNode = new ZoweDatasetNode(null, null, null, null);
        const value = sharedUtils.isZoweJobTreeNode(dsNode);
        expect(value).toBeFalsy();
    });
    it("should fail with ZoweUSSNode node type", async () => {
        const ussNode = new ZoweUSSNode(null, null, null, null, null);
        const value = sharedUtils.isZoweJobTreeNode(ussNode);
        expect(value).toBeFalsy();
    });
});

describe("Test uploadContents", () => {
    it("should test with uss node that new API method is called if it exists", async () => {
        const putContent = jest.fn();
        ZoweExplorerApiRegister.getUssApi = jest.fn<any, Parameters<typeof ZoweExplorerApiRegister.getUssApi>>(
            (profile: IProfileLoaded) => {
                return {
                    putContent,
                };
            }
        );

        await sharedUtils.uploadContent(
            new ZoweUSSNode(null, null, null, null, null),
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
        expect(ZoweExplorerApiRegister.getUssApi(null).putContent).toBeCalled();
    });

    it("should test with uss node that old API method is called", async () => {
        const putContents = jest.fn();
        ZoweExplorerApiRegister.getUssApi = jest.fn<any, Parameters<typeof ZoweExplorerApiRegister.getUssApi>>(
            (profile: IProfileLoaded) => {
                return {
                    putContents,
                };
            }
        );

        await sharedUtils.uploadContent(
            new ZoweUSSNode(null, null, null, null, null),
            {
                fileName: "whatever",
            } as any,
            null
        );
        expect(ZoweExplorerApiRegister.getUssApi(null).putContents).toBeCalled();
    });

    it("should test with data set node that old API method is called", async () => {
        const putContents = jest.fn();
        ZoweExplorerApiRegister.getMvsApi = jest.fn<any, Parameters<typeof ZoweExplorerApiRegister.getMvsApi>>(
            (profile: IProfileLoaded) => {
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
            null
        );
        expect(ZoweExplorerApiRegister.getMvsApi(null).putContents).toBeCalled();
    });
});

describe("Test force upload", () => {
    async function createBlockMocks() {
        const newVariables = {
            dsNode: new ZoweDatasetNode(null, null, null, null),
            ussNode: new ZoweUSSNode(null, null, null, null, null),
            showInformationMessage: jest.fn(),
            showWarningMessage: jest.fn(),
            getMvsApi: jest.fn(),
            getUssApi: jest.fn(),
            withProgress: jest.fn(),
            fileResponse: createFileResponse({ etag: null }),
            ProgressLocation: jest.fn().mockImplementation(() => {
                return {
                    Notification: 15,
                };
            }),
        };

        Object.defineProperty(vscode.window, "showInformationMessage", {
            value: newVariables.showInformationMessage,
            configurable: true,
        });
        Object.defineProperty(vscode.window, "showWarningMessage", {
            value: newVariables.showWarningMessage,
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
        Object.defineProperty(vscode, "ProgressLocation", { value: newVariables.ProgressLocation, configurable: true });

        return newVariables;
    }

    it("should successfully call upload for a USS file if user clicks 'Yes'", async () => {
        const blockMocks = await createBlockMocks();
        blockMocks.showInformationMessage.mockResolvedValueOnce("Yes");
        blockMocks.withProgress.mockResolvedValueOnce(blockMocks.fileResponse);
        await sharedUtils.willForceUpload(blockMocks.ussNode, null, null);
        expect(blockMocks.withProgress).toBeCalledWith(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Saving file...",
            },
            expect.any(Function)
        );
    });

    it("should successfully call upload for a data set if user clicks 'Yes'", async () => {
        const blockMocks = await createBlockMocks();
        blockMocks.showInformationMessage.mockResolvedValueOnce("Yes");
        blockMocks.withProgress.mockResolvedValueOnce(blockMocks.fileResponse);
        await sharedUtils.willForceUpload(blockMocks.dsNode, null, null);
        expect(blockMocks.withProgress).toBeCalledWith(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Saving data set...",
            },
            expect.any(Function)
        );
    });

    it("should cancel upload if user clicks 'No'", async () => {
        const blockMocks = await createBlockMocks();
        blockMocks.showInformationMessage.mockResolvedValueOnce("No");
        await sharedUtils.willForceUpload(blockMocks.dsNode, null, null);
        expect(blockMocks.showInformationMessage.mock.calls[1][0]).toBe("Upload cancelled.");
    });

    it("should display specific message if Theia is detected", async () => {
        const blockMocks = await createBlockMocks();
        Object.defineProperty(globals, "ISTHEIA", { value: true });
        blockMocks.showInformationMessage.mockResolvedValueOnce("No");
        await sharedUtils.willForceUpload(blockMocks.dsNode, null, null);
        expect(blockMocks.showWarningMessage.mock.calls[0][0]).toBe(
            "A merge conflict has been detected. Since you are running inside Theia editor, a merge conflict resolution is not available yet."
        );
    });
});

describe("Shared Utils Unit Tests - Function filterTreeByString", () => {
    it("Testing that filterTreeByString returns the correct array", async () => {
        const qpItems = [
            new utils.FilterItem("[sestest]: HLQ.PROD2.STUFF1"),
            new utils.FilterItem("[sestest]: HLQ.PROD3.STUFF2(TESTMEMB)"),
            new utils.FilterItem("[sestest]: /test/tree/abc"),
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

        let node = new ZoweDatasetNode(
            "AUSER.TEST.JCL(member)",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null
        );
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.JCL(member).jcl")
        );
        node = new ZoweDatasetNode(
            "AUSER.TEST.ASM(member)",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null
        );
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.ASM(member).asm")
        );
        node = new ZoweDatasetNode(
            "AUSER.COBOL.TEST(member)",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null
        );
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.COBOL.TEST(member).cbl")
        );
        node = new ZoweDatasetNode(
            "AUSER.PROD.PLI(member)",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null
        );
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.PROD.PLI(member).pli")
        );
        node = new ZoweDatasetNode(
            "AUSER.PROD.PLX(member)",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null
        );
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.PROD.PLX(member).pli")
        );
        node = new ZoweDatasetNode(
            "AUSER.PROD.SH(member)",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null
        );
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.PROD.SH(member).sh")
        );
        node = new ZoweDatasetNode(
            "AUSER.REXX.EXEC(member)",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null
        );
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.REXX.EXEC(member).rexx")
        );
        node = new ZoweDatasetNode(
            "AUSER.TEST.XML(member)",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null
        );
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.XML(member).xml")
        );

        node = new ZoweDatasetNode(
            "AUSER.TEST.XML",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null
        );
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.XML.xml")
        );
        node = new ZoweDatasetNode(
            "AUSER.TEST.TXML",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null
        );
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.TXML")
        );
        node = new ZoweDatasetNode(
            "AUSER.XML.TGML",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null
        );
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.XML.TGML.xml")
        );
        node = new ZoweDatasetNode(
            "AUSER.XML.ASM",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null
        );
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.XML.ASM.asm")
        );
        node = new ZoweDatasetNode("AUSER", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER")
        );
        node = new ZoweDatasetNode(
            "AUSER.XML.TEST(member)",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null
        );
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.XML.TEST(member).xml")
        );
        node = new ZoweDatasetNode(
            "XML.AUSER.TEST(member)",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null
        );
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "XML.AUSER.TEST(member)")
        );
        node = new ZoweDatasetNode(
            "AUSER.COBOL.PL1.XML.TEST(member)",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null
        );
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.COBOL.PL1.XML.TEST(member).xml")
        );
        node = new ZoweDatasetNode(
            "AUSER.COBOL.PL1.XML.ASSEMBLER.TEST(member)",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null
        );
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(
            path.join(
                path.sep,
                "test",
                "path",
                "temp",
                "_D_",
                "sestest",
                "AUSER.COBOL.PL1.XML.ASSEMBLER.TEST(member).asm"
            )
        );
        node = new ZoweDatasetNode(
            "AUSER.TEST.COPYBOOK",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null
        );
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.COPYBOOK.cpy")
        );
        node = new ZoweDatasetNode(
            "AUSER.TEST.PLINC",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null
        );
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.PLINC.inc")
        );
        node = new ZoweDatasetNode(
            "AUSER.TEST.SPFLOG1",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null
        );
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toEqual(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.SPFLOG1.log")
        );
    });
});
