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

// tslint:disable:no-magic-numbers
import * as zowe from "@zowe/cli";
import { IProfileLoaded } from "@zowe/imperative";
import * as expect from "expect";
import * as vscode from "vscode";
import { DatasetTree } from "../../src/dataset/DatasetTree";
import { ZoweDatasetNode } from "../../src/dataset/ZoweDatasetNode";
import * as testConst from "../../resources/testProfileData";
import * as sinon from "sinon";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { DS_SESSION_CONTEXT } from "../../src/globals";

declare var it: any;

const testProfile: IProfileLoaded = {
    name: testConst.profile.name,
    profile: testConst.profile,
    type: testConst.profile.type,
    message: "",
    failNotFound: false
};

describe("DatasetTree Integration Tests", async () => {
    const TIMEOUT = 120000;
    chai.use(chaiAsPromised);
    // Uses loaded profile to create a zosmf session with Zowe
    const session = zowe.ZosmfSession.createBasicZosmfSession(testConst.profile);
    const sessNode = new ZoweDatasetNode(testConst.profile.name, vscode.TreeItemCollapsibleState.Expanded,
        null, session, undefined, undefined, testProfile);
    sessNode.contextValue = DS_SESSION_CONTEXT;
    const pattern = testConst.normalPattern.toUpperCase();
    sessNode.pattern = pattern + ".PUBLIC";
    const testTree = new DatasetTree();
    testTree.mSessionNodes.splice(-1, 0, sessNode);
    const oldSettings = vscode.workspace.getConfiguration("Zowe-DS-Persistent");

    after(async () => {
        await vscode.workspace.getConfiguration().update("Zowe-DS-Persistent", oldSettings, vscode.ConfigurationTarget.Global);
    });
    let sandbox;

    beforeEach(async () => {
        sandbox = sinon.createSandbox();
    });

    afterEach(async () => {
        sandbox.restore();
    });

    /*************************************************************************************************************
     * Creates a datasetTree and checks that its members are all initialized by the constructor
     *************************************************************************************************************/
    it("Tests that the dataset tree is defined", async () => {
        expect(testTree.mOnDidChangeTreeData).toBeDefined();
        expect(testTree.mSessionNodes).toBeDefined();
    });

    /*************************************************************************************************************
     * Calls getTreeItem with sample element and checks the return is vscode.TreeItem
     *************************************************************************************************************/
    it("Tests the getTreeItem method", async () => {
        const sampleElement = new ZoweDatasetNode("testValue", vscode.TreeItemCollapsibleState.None, null, null);
        chai.expect(testTree.getTreeItem(sampleElement)).to.be.instanceOf(vscode.TreeItem);
    });

    /*************************************************************************************************************
     * Creates sample list of ZoweNodes and checks that datasetTree.getChildren() returns correct array of children
     *************************************************************************************************************/
    it("Tests that getChildren returns valid list of elements", async () => {
        // Waiting until we populate rootChildren with what getChildren returns
        const rootChildren = await testTree.getChildren();
        const sessChildren = await testTree.getChildren(rootChildren[0]);
        const PDSChildren = await testTree.getChildren(sessChildren[2]);

        const sampleRChildren: ZoweDatasetNode[] = [
            new ZoweDatasetNode(pattern + ".PUBLIC.BIN", vscode.TreeItemCollapsibleState.None, sessNode, null),
            new ZoweDatasetNode(pattern + ".PUBLIC.TCLASSIC", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null),
            new ZoweDatasetNode(pattern + ".PUBLIC.TPDS", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null),
            new ZoweDatasetNode(pattern + ".PUBLIC.TPS", vscode.TreeItemCollapsibleState.None, sessNode, null),
        ];
        sampleRChildren[2].dirty = false; // Because getChildren was subsequently called.

        sampleRChildren[0].command = { command: "zowe.ZoweNode.openPS", title: "", arguments: [sampleRChildren[0]] };
        sampleRChildren[3].command = { command: "zowe.ZoweNode.openPS", title: "", arguments: [sampleRChildren[3]] };

        const samplePChildren: ZoweDatasetNode[] = [
            new ZoweDatasetNode("TCHILD1", vscode.TreeItemCollapsibleState.None, sampleRChildren[2], null),
            new ZoweDatasetNode("TCHILD2", vscode.TreeItemCollapsibleState.None, sampleRChildren[2], null),
        ];

        samplePChildren[0].command = { command: "zowe.ZoweNode.openPS", title: "", arguments: [samplePChildren[0]] };
        samplePChildren[1].command = { command: "zowe.ZoweNode.openPS", title: "", arguments: [samplePChildren[1]] };
        sampleRChildren[2].children = samplePChildren;

        // Checking that the rootChildren are what they are expected to be
        expect(rootChildren).toEqual(testTree.mSessionNodes);
        expect(sessChildren).toEqual(sampleRChildren);
        expect(PDSChildren).toEqual(samplePChildren);

    }).timeout(TIMEOUT);

    /*************************************************************************************************************
     * Testing refresh
     *************************************************************************************************************/
    it("Tests refresh", async () => {
        let eventFired = false;

        const listener = () => {
            eventFired = true;
        };

        // start listening
        const subscription = testTree.mOnDidChangeTreeData.event(listener);
        await testTree.refresh();

        expect(eventFired).toBe(true);

        subscription.dispose(); // stop listening
    }).timeout(TIMEOUT);

    /*************************************************************************************************************
     * Creates a rootNode and checks that a getParent() call returns null
     *************************************************************************************************************/
    it("Tests that getParent returns null when called on a rootNode", async () => {
        // Waiting until we populate rootChildren with what getChildren() returns
        const rootChildren = await testTree.getChildren();
        const parent = testTree.getParent(rootChildren[0]);

        // We expect parent to equal null because when we call getParent() on the rootNode
        // It should return null rather than itself
        expect(parent).toEqual(null);
    }).timeout(TIMEOUT);

    /*************************************************************************************************************
     * Creates a child with a rootNode as parent and checks that a getParent() call returns null.
     * Also creates a child with a non-rootNode parent and checks that getParent() returns the correct ZoweDatasetNode
     *************************************************************************************************************/
    it("Tests that getParent returns the correct ZoweDatasetNode when called on a non-rootNode ZoweDatasetNode", async () => {
        // Creating structure of files and folders under BRTVS99 profile
        const sampleChild1: ZoweDatasetNode = new ZoweDatasetNode(pattern + ".TPDS", vscode.TreeItemCollapsibleState.None, sessNode, null);
        const parent1 = testTree.getParent(sampleChild1);

        // It's expected that parent is null because when getParent() is called on a child
        // of the rootNode, it should return null
        expect(parent1).toBe(sessNode);

        const sampleChild2: ZoweDatasetNode = new ZoweDatasetNode(pattern + ".TPDS(TCHILD1)",
            vscode.TreeItemCollapsibleState.None, sampleChild1, null);
        const parent2 = testTree.getParent(sampleChild2);

        expect(parent2).toBe(sampleChild1);
    });

    /*************************************************************************************************************
     * Tests the deleteSession() function
     *************************************************************************************************************/
    it("Tests the deleteSession() function", async () => {
        const len = testTree.mSessionNodes.length;
        testTree.deleteSession(sessNode);
        expect(testTree.mSessionNodes.length).toEqual(len - 1);
    });

    /*************************************************************************************************************
     * Tests the deleteSession() function
     *************************************************************************************************************/
    it("Tests the addSession() function by adding the default history, deleting, then adding a passed session then deleting", async () => {
        for (const sess of testTree.mSessionNodes) {
            if (sess.contextValue === DS_SESSION_CONTEXT) {
                testTree.deleteSession(sess);
            }
        }
        const len = testTree.mSessionNodes.length;
        await testTree.addSession();
        expect(testTree.mSessionNodes.length).toBeGreaterThan(len);
        for (const sess of testTree.mSessionNodes) {
            if (sess.contextValue === DS_SESSION_CONTEXT) {
                testTree.deleteSession(sess);
            }
        }
        await testTree.addSession(testConst.profile.name);
        expect(testTree.mSessionNodes.length).toEqual(len + 1);
    }).timeout(TIMEOUT);

    describe("addFavorite()", () => {
        it("should add the selected data set to the treeView", async () => {
            const favoriteNode = new ZoweDatasetNode(pattern + ".TPDS", vscode.TreeItemCollapsibleState.Collapsed, sessNode, null);
            const len = testTree.mFavorites.length;
            await testTree.addFavorite(favoriteNode);
            const filtered = testTree.mFavorites.filter((temp) => temp.label ===
                `[${favoriteNode.getSessionNode().label}]: ${favoriteNode.label}`);
            expect(filtered.length).toEqual(1);
            expect(filtered[0].label).toContain(pattern + ".TPDS");
            // TODO confirm in settings.json too
            testTree.mFavorites = [];
        });

        it("should add a favorite search", async () => {
            await testTree.addFavorite(sessNode);
            const filtered = testTree.mFavorites.filter((temp) => temp.label === `[${sessNode.label}]: ${sessNode.pattern}`);
            expect(filtered.length).toEqual(1);
            expect(filtered[0].label).toContain(`[${sessNode.label}]: ${sessNode.pattern}`);
            testTree.mFavorites = [];
        });
    });

    describe("removeFavorite()", () => {
        it("should remove the selected favorite data set from the treeView", () => {
            const favoriteNode = new ZoweDatasetNode(pattern + ".TPDS",
                vscode.TreeItemCollapsibleState.Collapsed, sessNode, null);
            testTree.addFavorite(favoriteNode);
            const len = testTree.mFavorites.length;
            testTree.removeFavorite(testTree.mFavorites[len - 1]);
            expect(testTree.mFavorites.length).toEqual(len - 1);
        });

        it("should remove the selected favorite search from the treeView", () => {
            testTree.addFavorite(sessNode);
            const len = testTree.mFavorites.length;
            testTree.removeFavorite(testTree.mFavorites[len - 1]);
            expect(testTree.mFavorites.length).toEqual(len - 1);
        });
    });

    /*************************************************************************************************************
     * Recently-opened member function tests
     *************************************************************************************************************/
    it("Tests that addFileHistory adds a recently-opened file to the list", async () => {
        testTree.addFileHistory(`[${sessNode.getLabel()}]: ${pattern}.EXT.SAMPLE.PDS(TESTMEMB)`);
        const fileHistory = testTree.getFileHistory();
        expect(fileHistory[0]).toEqual(`[${sessNode.getLabel().toUpperCase()}]: ${pattern}.EXT.SAMPLE.PDS(TESTMEMB)`);
    });

    it("Tests that removeFileHistory removes a file from the file history list", async () => {
        testTree.removeFileHistory(`[${sessNode.getLabel()}]: ${pattern}.EXT.SAMPLE.PDS`);
        const patternIndex = testTree.getFileHistory().findIndex((file) => file === `[${sessNode.getLabel()}]: ${pattern}.EXT.SAMPLE.PDS(TESTMEMB)`);
        expect(patternIndex).toEqual(-1);
    });

    describe("Renaming a Data Set", () => {
        const expectChai = chai.expect;
        chai.use(chaiAsPromised);
        const beforeDataSetName = `${pattern}.RENAME.BEFORE.TEST`;
        const afterDataSetName = `${pattern}.RENAME.AFTER.TEST`;

        describe("Success Scenarios", () => {
            afterEach(async () => {
                await Promise.all([
                    zowe.Delete.dataSet(sessNode.getSession(), beforeDataSetName),
                    zowe.Delete.dataSet(sessNode.getSession(), afterDataSetName),
                ].map((p) => p.catch((err) => err)));
            });
            describe("Rename Sequential Data Set", () => {
                beforeEach(async () => {
                    await zowe.Create.dataSet(
                        sessNode.getSession(),
                        zowe.CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL,
                        beforeDataSetName
                    ).catch((err) => err);
                });
                it("should rename a data set", async () => {
                    let error;
                    let beforeList;
                    let afterList;

                    try {
                        const testNode = new ZoweDatasetNode(beforeDataSetName, vscode.TreeItemCollapsibleState.None, sessNode, session);
                        const inputBoxStub = sandbox.stub(vscode.window, "showInputBox");
                        inputBoxStub.returns(afterDataSetName);

                        await testTree.rename(testNode);
                        beforeList = await zowe.List.dataSet(sessNode.getSession(), beforeDataSetName);
                        afterList = await zowe.List.dataSet(sessNode.getSession(), afterDataSetName);
                    } catch (err) {
                        error = err;
                    }

                    expectChai(error).to.be.equal(undefined);

                    expectChai(beforeList.apiResponse.returnedRows).to.equal(0);
                    expectChai(afterList.apiResponse.returnedRows).to.equal(1);
                }).timeout(TIMEOUT);
                it("should rename a data set in uppercase when given lowercase name", async () => {
                    let error;
                    let beforeList;
                    let afterList;

                    const lowercaseAfterDataSetName = `${pattern}.RENAME.after.TEST`;

                    try {
                        const testNode = new ZoweDatasetNode(beforeDataSetName, vscode.TreeItemCollapsibleState.None, sessNode, session);
                        const inputBoxStub = sandbox.stub(vscode.window, "showInputBox");
                        inputBoxStub.returns(lowercaseAfterDataSetName);

                        await testTree.rename(testNode);
                        beforeList = await zowe.List.dataSet(sessNode.getSession(), beforeDataSetName);
                        afterList = await zowe.List.dataSet(sessNode.getSession(), afterDataSetName);
                    } catch (err) {
                        error = err;
                    }

                    expectChai(error).to.be.equal(undefined);

                    expectChai(beforeList.apiResponse.returnedRows).to.equal(0);
                    expectChai(afterList.apiResponse.returnedRows).to.equal(1);
                }).timeout(TIMEOUT);
            });
            describe("Rename Member", () => {
                beforeEach(async () => {
                    await zowe.Create.dataSet(
                        sessNode.getSession(),
                        zowe.CreateDataSetTypeEnum.DATA_SET_PARTITIONED,
                        beforeDataSetName
                    ).catch((err) => err);
                    await zowe.Upload.bufferToDataSet(
                        sessNode.getSession(),
                        new Buffer("abc"),
                        `${beforeDataSetName}(mem1)`
                    );
                });
                it("should rename a data set member", async () => {
                    let error;
                    let list;

                    try {
                        const parentNode = new ZoweDatasetNode(beforeDataSetName, vscode.TreeItemCollapsibleState.None, sessNode, session);
                        const childNode = new ZoweDatasetNode("mem1", vscode.TreeItemCollapsibleState.None, parentNode, session);
                        const inputBoxStub = sandbox.stub(vscode.window, "showInputBox");
                        inputBoxStub.returns("MEM2");

                        await testTree.rename(childNode);
                        list = await zowe.List.allMembers(sessNode.getSession(), beforeDataSetName);
                    } catch (err) {
                        error = err;
                    }

                    expectChai(error).to.be.equal(undefined);

                    expectChai(list.apiResponse.returnedRows).to.equal(1);
                    expectChai(list.apiResponse.items[0].member).to.equal("MEM2");
                }).timeout(TIMEOUT);
                it("should rename a data set member in uppercase when given lowercase", async () => {
                    let error;
                    let list;

                    try {
                        const parentNode = new ZoweDatasetNode(beforeDataSetName, vscode.TreeItemCollapsibleState.None, sessNode, session);
                        const childNode = new ZoweDatasetNode("mem1", vscode.TreeItemCollapsibleState.None, parentNode, session);
                        const inputBoxStub = sandbox.stub(vscode.window, "showInputBox");
                        inputBoxStub.returns("mem2");

                        await testTree.rename(childNode);
                        list = await zowe.List.allMembers(sessNode.getSession(), beforeDataSetName);
                    } catch (err) {
                        error = err;
                    }

                    expectChai(error).to.be.equal(undefined);

                    expectChai(list.apiResponse.returnedRows).to.equal(1);
                    expectChai(list.apiResponse.items[0].member).to.equal("MEM2");
                }).timeout(TIMEOUT);
            });
            describe("Rename Partitioned Data Set", () => {
                beforeEach(async () => {
                    await zowe.Create.dataSet(
                        sessNode.getSession(),
                        zowe.CreateDataSetTypeEnum.DATA_SET_PARTITIONED,
                        beforeDataSetName
                    ).catch((err) => err);
                });
                it("should rename a data set", async () => {
                    let error;
                    let beforeList;
                    let afterList;

                    try {
                        const testNode = new ZoweDatasetNode(beforeDataSetName, vscode.TreeItemCollapsibleState.None, sessNode, session);

                        const inputBoxStub = sandbox.stub(vscode.window, "showInputBox");
                        inputBoxStub.returns(afterDataSetName);

                        await testTree.rename(testNode);
                        beforeList = await zowe.List.dataSet(sessNode.getSession(), beforeDataSetName);
                        afterList = await zowe.List.dataSet(sessNode.getSession(), afterDataSetName);
                    } catch (err) {
                        error = err;
                    }

                    expectChai(error).to.be.equal(undefined);

                    expectChai(beforeList.apiResponse.returnedRows).to.equal(0);
                    expectChai(afterList.apiResponse.returnedRows).to.equal(1);
                }).timeout(TIMEOUT);
                it("should rename a data set in uppercase when given lowercase name", async () => {
                    let error;
                    let beforeList;
                    let afterList;

                    const lowercaseAfterDataSetName = `${pattern}.RENAME.after.TEST`;

                    try {
                        const testNode = new ZoweDatasetNode(beforeDataSetName, vscode.TreeItemCollapsibleState.None, sessNode, session);
                        const inputBoxStub = sandbox.stub(vscode.window, "showInputBox");
                        inputBoxStub.returns(lowercaseAfterDataSetName);

                        await testTree.rename(testNode);
                        beforeList = await zowe.List.dataSet(sessNode.getSession(), beforeDataSetName);
                        afterList = await zowe.List.dataSet(sessNode.getSession(), afterDataSetName);
                    } catch (err) {
                        error = err;
                    }

                    expectChai(error).to.be.equal(undefined);

                    expectChai(beforeList.apiResponse.returnedRows).to.equal(0);
                    expectChai(afterList.apiResponse.returnedRows).to.equal(1);
                }).timeout(TIMEOUT);
            });
        });
        describe("Failure Scenarios", () => {
            describe("Rename Sequential Data Set", () => {
                it("should throw an error if a missing data set name is provided", async () => {
                    let error;

                    try {
                        const testNode = new ZoweDatasetNode(beforeDataSetName, vscode.TreeItemCollapsibleState.None, sessNode, session);
                        const inputBoxStub = sandbox.stub(vscode.window, "showInputBox");
                        inputBoxStub.returns("MISSING.DATA.SET");

                        await testTree.rename(testNode);
                    } catch (err) {
                        error = err;
                    }

                    expectChai(error).not.to.be.equal(undefined);
                }).timeout(TIMEOUT);
            });
            describe("Rename Data Set Member", () => {
                it("should throw an error if a missing data set name is provided", async () => {
                    let error;

                    try {
                        const parentNode = new ZoweDatasetNode(beforeDataSetName, vscode.TreeItemCollapsibleState.None, sessNode, session);
                        const childNode = new ZoweDatasetNode("mem1", vscode.TreeItemCollapsibleState.None, parentNode, session);
                        const inputBoxStub = sandbox.stub(vscode.window, "showInputBox");
                        inputBoxStub.returns("MEM2");

                        await testTree.rename(childNode);
                    } catch (err) {
                        error = err;
                    }

                    expectChai(error).not.to.be.equal(undefined);
                }).timeout(TIMEOUT);
            });
        });
    });
});
