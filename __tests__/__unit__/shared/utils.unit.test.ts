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

import * as utils from "../../../src/utils";
import * as sharedUtils from "../../../src/shared/utils";
import * as globals from "../../../src/globals";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import * as vscode from "vscode";
import * as path from "path";
import {
    generateIProfile,
    generateISessionWithoutCredentials
} from "../../../__mocks__/generators/shared";
import { generateDatasetSessionNode } from "../../../__mocks__/generators/datasets";

describe("Add filterTreeByString Tests", () => {
    afterEach(() => jest.clearAllMocks());
    afterAll(() => jest.restoreAllMocks());

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

describe("Add getDocumentFilePath Tests", () => {
    function generateEnvironmentalMocks() {
        const session = generateISessionWithoutCredentials();
        const imperativeProfile = generateIProfile();
        const datasetSessionNode = generateDatasetSessionNode(session, imperativeProfile);

        return {
            session,
            imperativeProfile,
            datasetSessionNode
        };
    }

    afterEach(() => jest.clearAllMocks());
    afterAll(() => jest.restoreAllMocks());

    it("Testing that the add Suffix for datasets works", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        globals.defineGlobals("/test/path/");

        let node = new ZoweDatasetNode("AUSER.TEST.JCL(member)", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.JCL(member).jcl"));
        node = new ZoweDatasetNode("AUSER.TEST.ASM(member)", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.ASM(member).asm"));
        node = new ZoweDatasetNode("AUSER.COBOL.TEST(member)", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.COBOL.TEST(member).cbl"));
        node = new ZoweDatasetNode("AUSER.PROD.PLI(member)", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.PROD.PLI(member).pli"));
        node = new ZoweDatasetNode("AUSER.PROD.PLX(member)", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.PROD.PLX(member).pli"));
        node = new ZoweDatasetNode("AUSER.PROD.SH(member)", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.PROD.SH(member).sh"));
        node = new ZoweDatasetNode("AUSER.REXX.EXEC(member)", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.REXX.EXEC(member).rexx"));
        node = new ZoweDatasetNode("AUSER.TEST.XML(member)", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.XML(member).xml"));

        node = new ZoweDatasetNode("AUSER.TEST.XML", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.XML.xml"));
        node = new ZoweDatasetNode("AUSER.TEST.TXML", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.TXML"));
        node = new ZoweDatasetNode("AUSER.XML.TGML", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.XML.TGML.xml"));
        node = new ZoweDatasetNode("AUSER.XML.ASM", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.XML.ASM.asm"));
        node = new ZoweDatasetNode("AUSER", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER"));
        node = new ZoweDatasetNode("AUSER.XML.TEST(member)", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.XML.TEST(member).xml"));
        node = new ZoweDatasetNode("XML.AUSER.TEST(member)", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "XML.AUSER.TEST(member)"));
        node = new ZoweDatasetNode("AUSER.COBOL.PL1.XML.TEST(member)", vscode.TreeItemCollapsibleState.None,
            environmentalMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.COBOL.PL1.XML.TEST(member).xml"));
        node = new ZoweDatasetNode("AUSER.COBOL.PL1.XML.ASSEMBLER.TEST(member)", vscode.TreeItemCollapsibleState.None,
            environmentalMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.COBOL.PL1.XML.ASSEMBLER.TEST(member).asm"));
        node = new ZoweDatasetNode("AUSER.TEST.COPYBOOK", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.COPYBOOK.cpy"));
        node = new ZoweDatasetNode("AUSER.TEST.PLINC", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toBe(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.PLINC.inc"));
        node = new ZoweDatasetNode("AUSER.TEST.SPFLOG1", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label, node)).toEqual(path.join(path.sep,
            "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.SPFLOG1.log"));
    });
});
