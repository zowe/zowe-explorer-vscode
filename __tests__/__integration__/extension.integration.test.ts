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
import { Logger, CliProfileManager, IProfileLoaded } from "@zowe/imperative";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as extension from "../../src/extension";
import * as dsActions from "../../src/dataset/actions";
import * as ussActions from "../../src/uss/actions";
import * as sharedUtils from "../../src/shared/utils";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as sinon from "sinon";
import * as testConst from "../../resources/testProfileData";
import * as vscode from "vscode";
import * as utils from "../../src/utils";
import { DatasetTree, createDatasetTree } from "../../src/dataset/DatasetTree";
import { ZoweDatasetNode } from "../../src/dataset/ZoweDatasetNode";
import { USSTree } from "../../src/uss/USSTree";
import { ZoweUSSNode } from "../../src/uss/ZoweUSSNode";
import { IZoweTreeNode } from "../../src/api/IZoweTreeNode";
import { USS_DIR, DS_SESSION_CONTEXT, DS_DIR, ZOWETEMPFOLDER, FAV_SUFFIX, DS_PDS_CONTEXT,
    DS_MEMBER_CONTEXT, DS_DS_CONTEXT, USS_SESSION_CONTEXT, FAVORITE_CONTEXT, FAV_PROFILE_CONTEXT } from "../../src/globals";

const TIMEOUT = 45000;
declare var it: Mocha.ITestDefinition;
// declare var describe: any;

const testProfile: IProfileLoaded = {
    name: testConst.profile.name,
    profile: testConst.profile,
    type: testConst.profile.type,
    message: "",
    failNotFound: false
};

describe("Extension Integration Tests", () => {
    const expect = chai.expect;
    chai.use(chaiAsPromised);

    const session = zowe.ZosmfSession.createBasicZosmfSession(testConst.profile);
    const sessionNode = new ZoweDatasetNode(testConst.profile.name, vscode.TreeItemCollapsibleState.Expanded, null,
        session, undefined, undefined, testProfile);
    sessionNode.contextValue = DS_SESSION_CONTEXT;
    const pattern = testConst.normalPattern.toUpperCase();
    sessionNode.pattern = pattern;
    const testTree = new DatasetTree();
    testTree.mSessionNodes.push(sessionNode);

    let sandbox;

    beforeEach(async function() {
        this.timeout(TIMEOUT);
        sandbox = sinon.createSandbox();
        await extension.cleanTempDir();
    });

    afterEach(async function() {
        this.timeout(TIMEOUT);
        const createTestFileName = pattern + ".EXT.CREATE.DATASET.TEST";
        try {
            await zowe.Delete.dataSet(session, createTestFileName);
        } catch (err) {
            // Do nothing
        }

        const deleteTestFileName = pattern + ".EXT.DELETE.DATASET.TEST";
        try {
            await zowe.Delete.dataSet(session, deleteTestFileName);
        } catch (err) {
            // Do nothing
        }
        sandbox.restore();
    });

    const oldSettings = vscode.workspace.getConfiguration("Zowe-DS-Persistent");

    after(async () => {
        await vscode.workspace.getConfiguration().update("Zowe-DS-Persistent", oldSettings, vscode.ConfigurationTarget.Global);
    });

    describe("Creating a Session", () => {
        it("should add a session", async () => {
            // Grab profiles
            const profileManager = await new CliProfileManager({
                profileRootDirectory: path.join(os.homedir(), ".zowe", "profiles"),
                type: "zosmf"
            });
            const profileNamesList = profileManager.getAllProfileNames().filter((profileName) =>
                // Find all cases where a profile is not already displayed
                !testTree.mSessionNodes.find((node) =>
                    node.label.toUpperCase() === profileName.toUpperCase()
                )
            );

            // Mock user selecting first profile from list
            const inputBoxStub1 = sandbox.stub(vscode.window, "showQuickPick");
            inputBoxStub1.returns(new utils.FilterDescriptor("\uFF0B " + "Create a New Connection to z/OS"));
            const stubresolve = sandbox.stub(utils, "resolveQuickPickHelper");
            stubresolve.returns(new utils.FilterItem(profileNamesList[0]));

            await testTree.createZoweSession(testTree);
            expect(testTree.mSessionNodes[testTree.mSessionNodes.length - 1].label).to.equal(profileNamesList[0]);
        }).timeout(TIMEOUT);
    });

    describe("Creating Data Sets and Members", () => {
        it("should create a data set when zowe.createFile is invoked", async () => {
            // Mock user selecting first option from list
            const testFileName = pattern + ".EXT.CREATE.DATASET.TEST";
            const quickPickStub = sandbox.stub(vscode.window, "showQuickPick");
            quickPickStub.returns("Data Set Sequential");

            const inputBoxStub = sandbox.stub(vscode.window, "showInputBox");
            inputBoxStub.returns(testFileName);

            await dsActions.createFile(sessionNode, testTree);

            // Data set should be created
            const response = await zowe.List.dataSet(sessionNode.getSession(), testFileName, {});
            expect(response.success).to.equal(true);
        }).timeout(TIMEOUT);

        it("should display an error message when creating a data set that already exists", async () => {
            // Mock user selecting first option from list
            const quickPickStub = sandbox.stub(vscode.window, "showQuickPick");
            quickPickStub.returns("Data Set Sequential");

            const testFileName = pattern + ".EXT.CREATE.DATASET.TEST";
            const inputBoxStub = sandbox.stub(vscode.window, "showInputBox");
            inputBoxStub.returns(testFileName);

            await dsActions.createFile(sessionNode, testTree);

            const showErrorStub = sandbox.spy(vscode.window, "showErrorMessage");
            await expect(dsActions.createFile(sessionNode, testTree)).to.eventually.be.rejectedWith(Error);
            const gotCalled = showErrorStub.called;
            expect(gotCalled).to.equal(true);
        }).timeout(TIMEOUT);

        it("should create a member when zowe.createMember is invoked", async () => {
            const testFileName = "MEMBER";
            const inputBoxStub = sandbox.stub(vscode.window, "showInputBox");
            inputBoxStub.returns(testFileName);

            const testParentName = pattern + ".EXT.SAMPLE.PDS";
            const testParentNode = new ZoweDatasetNode(testParentName, vscode.TreeItemCollapsibleState.Collapsed, sessionNode, session);
            await dsActions.createMember(testParentNode, testTree);

            const allMembers = await zowe.List.allMembers(session, testParentName);

            expect(allMembers.apiResponse.items[0].member).to.deep.equal(testFileName);
        }).timeout(TIMEOUT);
    });

    describe("Deactivate", () => {
        it("should clean up the local files when deactivate is invoked", async () => {
            try {
                fs.mkdirSync(ZOWETEMPFOLDER);
                fs.mkdirSync(DS_DIR);
            } catch (err) {
                // if operation failed, wait a second and try again
                await new Promise((resolve) => setTimeout(resolve, 1000));
                fs.mkdirSync(DS_DIR);
            }
            fs.closeSync(fs.openSync(path.join(DS_DIR, "file1"), "w"));
            fs.closeSync(fs.openSync(path.join(DS_DIR, "file2"), "w"));
            await extension.deactivate();
            expect(fs.existsSync(path.join(DS_DIR, "file1"))).to.equal(false);
            expect(fs.existsSync(path.join(DS_DIR, "file2"))).to.equal(false);
        }).timeout(TIMEOUT);
    });

    describe("Tests for Deleting Data Sets", () => {
        const dataSetName = pattern + ".EXT.DELETE.DATASET.TEST";
        beforeEach(async () => {
            try {
                await zowe.Delete.dataSet(sessionNode.getSession(), dataSetName);
                // tslint:disable-next-line: no-empty
            } catch { }
        });
        afterEach(async () => {
            try {
                await zowe.Delete.dataSet(sessionNode.getSession(), dataSetName);
                // tslint:disable-next-line: no-empty
            } catch { }
        });
        it("should delete a data set if user verified", async () => {
            await zowe.Create.dataSet(sessionNode.getSession(), zowe.CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL, dataSetName);
            const testNode = new ZoweDatasetNode(dataSetName, vscode.TreeItemCollapsibleState.None, sessionNode, session);

            // Mock user selecting first option from list
            const quickPickStub = sandbox.stub(vscode.window, "showQuickPick");
            quickPickStub.returns("Yes");
            await dsActions.deleteDataset(testNode, testTree);

            const response = await zowe.List.dataSet(session, dataSetName);

            expect(response.apiResponse.items).to.deep.equal([]);
        }).timeout(TIMEOUT);
        it("should not delete a data set if user did not verify", async () => {
            await zowe.Create.dataSet(sessionNode.getSession(), zowe.CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL, dataSetName);
            const testNode = new ZoweDatasetNode(dataSetName, vscode.TreeItemCollapsibleState.None, sessionNode, session);

            // Mock user selecting second option from list
            const quickPickStub = sandbox.stub(vscode.window, "showQuickPick");
            quickPickStub.returns("No");
            await dsActions.deleteDataset(testNode, testTree);

            const response = await zowe.List.dataSet(session, dataSetName);

            // Check that dataset was not deleted
            expect(response.apiResponse.items.filter((entry) => {
                return (entry.dsname === dataSetName.toUpperCase());
            }).length).to.greaterThan(0);
        }).timeout(TIMEOUT);
        it("should delete a data set if user cancelled", async () => {
            await zowe.Create.dataSet(sessionNode.getSession(), zowe.CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL, dataSetName);
            const testNode = new ZoweDatasetNode(dataSetName, vscode.TreeItemCollapsibleState.None, sessionNode, session);

            // Mock user not selecting any option from list
            const quickPickStub = sandbox.stub(vscode.window, "showQuickPick");
            quickPickStub.returns(undefined);
            await dsActions.deleteDataset(testNode, testTree);

            const response = await zowe.List.dataSet(session, dataSetName);

            // Check that dataset was not deleted
            expect(response.apiResponse.items.filter((entry) => {
                return (entry.dsname === dataSetName.toUpperCase());
            }).length).to.greaterThan(0);
        }).timeout(TIMEOUT);
    });

    describe("Enter Pattern", () => {
        it("should output data sets that match the user-provided pattern", async () => {
            const inputBoxStub = sandbox.stub(vscode.window, "showInputBox");
            inputBoxStub.returns(pattern);

            await dsActions.enterPattern(sessionNode, testTree);

            expect(testTree.mSessionNodes[1].pattern).to.equal(pattern);
            expect(testTree.mSessionNodes[1].tooltip).to.equal(pattern);
            expect(testTree.mSessionNodes[1].collapsibleState).to.equal(vscode.TreeItemCollapsibleState.Expanded);

            const childrenFromTree = await sessionNode.getChildren();
            childrenFromTree.unshift(...(await childrenFromTree[0].getChildren()));

            await testTree.getTreeView().reveal(childrenFromTree[0]);
            expect(childrenFromTree[0]).to.deep.equal(testTree.getTreeView().selection[0]);
        }).timeout(TIMEOUT);

        it("should match data sets for multiple patterns", async () => {
            const inputBoxStub = sandbox.stub(vscode.window, "showInputBox");
            const search = testConst.orPattern;
            inputBoxStub.returns(search);

            await dsActions.enterPattern(sessionNode, testTree);

            expect(testTree.mSessionNodes[1].pattern).to.equal(search.toUpperCase());
            expect(testTree.mSessionNodes[1].tooltip).to.equal(search.toUpperCase());
            expect(testTree.mSessionNodes[1].collapsibleState).to.equal(vscode.TreeItemCollapsibleState.Expanded);

            const sessionChildren = await sessionNode.getChildren();
            const childrenFromTree = await getAllNodes(sessionChildren);

            for (const child of childrenFromTree) {
                await testTree.getTreeView().reveal(child);
                expect(child).to.deep.equal(testTree.getTreeView().selection[0]);
            }
        }).timeout(TIMEOUT);

        it("should pop up a message if the user doesn't enter a pattern", async () => {
            const inputBoxStub = sandbox.stub(vscode.window, "showInputBox");
            inputBoxStub.returns("");

            const showInfoStub = sandbox.spy(vscode.window, "showInformationMessage");
            await dsActions.enterPattern(sessionNode, testTree);
            const gotCalled = showInfoStub.calledWith("You must enter a pattern.");
            expect(gotCalled).to.equal(true);
        }).timeout(TIMEOUT);

        it("should work when called from a saved search", async () => {
            const searchPattern = pattern + ".search";
            const favoriteSearch = new ZoweDatasetNode("[" + testConst.profile.name + "]: " + searchPattern,
                vscode.TreeItemCollapsibleState.None, testTree.mFavoriteSession, null);
            favoriteSearch.contextValue = DS_SESSION_CONTEXT + FAV_SUFFIX;
            await dsActions.enterPattern(favoriteSearch, testTree);

            expect(testTree.mSessionNodes[1].pattern).to.equal(searchPattern.toUpperCase());
            expect(testTree.mSessionNodes[1].tooltip).to.equal(searchPattern.toUpperCase());
            expect(testTree.mSessionNodes[1].collapsibleState).to.equal(vscode.TreeItemCollapsibleState.Expanded);

            const childrenFromTree = await sessionNode.getChildren();
            expect(childrenFromTree[0].children).to.deep.equal([]);

            // reset tree
            const inputBoxStub = sandbox.stub(vscode.window, "showInputBox");
            inputBoxStub.returns(pattern);

            await dsActions.enterPattern(sessionNode, testTree);
        }).timeout(TIMEOUT);
    });

    describe("Opening a PS", () => {
        it("should open a PS", async () => {
            const node = new ZoweDatasetNode(pattern + ".EXT.PS", vscode.TreeItemCollapsibleState.None, sessionNode, null);
            await dsActions.openPS(node, true, testTree);
            expect(path.relative(vscode.window.activeTextEditor.document.fileName,
                sharedUtils.getDocumentFilePath(pattern + ".EXT.PS", node))).to.equal("");
            expect(fs.existsSync(sharedUtils.getDocumentFilePath(pattern + ".EXT.PS", node))).to.equal(true);
        }).timeout(TIMEOUT);

        it("should display an error message when openPS is passed an invalid node", async () => {
            const node = new ZoweDatasetNode(pattern + ".GARBAGE", vscode.TreeItemCollapsibleState.None, sessionNode, null);
            const errorMessageStub = sandbox.spy(vscode.window, "showErrorMessage");
            await expect(dsActions.openPS(node, true)).to.eventually.be.rejectedWith(Error);

            const called = errorMessageStub.called;
            expect(called).to.equal(true);
        }).timeout(TIMEOUT);
    });

    describe("Saving a File", () => {
        it("should download, change, and re-upload a PS", async () => {
            // Test for PS under HLQ
            const profiles = await testTree.getChildren();
            profiles[1].dirty = true;
            const children = await profiles[1].getChildren();
            children[1].dirty = true;
            await dsActions.openPS(children[1], true);

            const changedData = "PS Upload Test";

            fs.writeFileSync(path.join(ZOWETEMPFOLDER, children[1].label + "[" + profiles[1].label + "]"), changedData);

            // Upload file
            const doc = await vscode.workspace.openTextDocument(path.join(ZOWETEMPFOLDER,
                children[1].label + "[" + profiles[1].label + "]"));
            await dsActions.saveFile(doc, testTree);

            // Download file
            await dsActions.openPS(children[1], true);

            expect(doc.getText().trim()).to.deep.equal("PS Upload Test");

            // Change contents back
            const originalData = "";
            fs.writeFileSync(path.join(path.join(ZOWETEMPFOLDER, children[1].label)), originalData);
        }).timeout(TIMEOUT);

        it("should download, change, and re-upload a PDS member", async () => {
            // Test for PS under HLQ
            const profiles = await testTree.getChildren();
            profiles[1].dirty = true;
            const children = await profiles[1].getChildren();
            children[0].dirty = true;

            // Test for member under PO
            const childrenMembers = await testTree.getChildren(children[0]);
            await dsActions.openPS(childrenMembers[0], true);

            const changedData2 = "PO Member Upload Test";

            fs.writeFileSync(path.join(ZOWETEMPFOLDER, children[0].label + "(" + childrenMembers[0].label + ")"), changedData2);

            // Upload file
            const doc2 = await vscode.workspace.openTextDocument(path.join(ZOWETEMPFOLDER, children[0].label +
                "(" + childrenMembers[0].label + ")"));
            dsActions.saveFile(doc2, testTree);

            // Download file
            await dsActions.openPS(childrenMembers[0], true);

            expect(doc2.getText().trim()).to.deep.equal("PO Member Upload Test");

            // Change contents back
            const originalData2 = "";
            fs.writeFileSync(path.join(ZOWETEMPFOLDER, children[0].label + "(" + childrenMembers[0].label + ")"), originalData2);
        }).timeout(TIMEOUT);

        // TODO add tests for saving data set from favorites
    });

    describe("Copying data sets", () => {
        beforeEach(() => {
            const favProfileNode = new ZoweDatasetNode(testConst.profile.name, vscode.TreeItemCollapsibleState.Expanded, null,
                session, FAV_PROFILE_CONTEXT, undefined, testProfile);
            testTree.mFavorites.push(favProfileNode);
        });
        afterEach(() => {
            testTree.mFavorites = [];
        });
        describe("Success Scenarios", () => {
            describe("Sequential > Sequential", () => {
                const fromDataSetName = `${pattern}.COPY.FROM.SET`;
                const toDataSetName = `${pattern}.COPY.TO.SET`;

                beforeEach(async () => {
                    await Promise.all([
                        zowe.Create.dataSet(
                            sessionNode.getSession(),
                            zowe.CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL,
                            fromDataSetName,
                        ),
                        zowe.Create.dataSet(
                            sessionNode.getSession(),
                            zowe.CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL,
                            toDataSetName,
                        ),
                    ].map((p) => p.catch((err) => err)));

                    await zowe.Upload.bufferToDataSet(sessionNode.getSession(), Buffer.from("1234"), fromDataSetName).catch((err) => err);
                });
                afterEach(async () => {
                    await Promise.all([
                        zowe.Delete.dataSet(sessionNode.getSession(), fromDataSetName),
                        zowe.Delete.dataSet(sessionNode.getSession(), toDataSetName),
                    ].map((p) => p.catch((err) => err)));
                });

                it("Should copy a data set", async () => {
                    let error;
                    let contents;

                    try {
                        const fromNode = new ZoweDatasetNode(fromDataSetName, vscode.TreeItemCollapsibleState.None, sessionNode, session);
                        const toNode = new ZoweDatasetNode(toDataSetName, vscode.TreeItemCollapsibleState.None, sessionNode, session);

                        await dsActions.copyDataSet(fromNode);
                        await dsActions.pasteDataSet(toNode, testTree);

                        contents = await zowe.Get.dataSet(sessionNode.getSession(), fromDataSetName);
                    } catch (err) {
                        error = err;
                    }

                    expect(error).to.be.equal(undefined);

                    expect(contents.toString()).to.equal("1234\n");
                }).timeout(TIMEOUT);
            });
            describe("Member > Member", () => {
                const dataSetName = `${pattern}.COPY.DATA.SET`;
                const fromMemberName = "file1";
                const toMemberName = "file2";

                beforeEach(async () => {
                    await zowe.Create.dataSet(
                        sessionNode.getSession(),
                        zowe.CreateDataSetTypeEnum.DATA_SET_PARTITIONED,
                        dataSetName,
                    ).catch((err) => err);

                    await zowe.Upload.bufferToDataSet(sessionNode.getSession(), Buffer.from("1234"), `${dataSetName}(${fromMemberName})`);
                });
                afterEach(async () => {
                    await zowe.Delete.dataSet(sessionNode.getSession(), dataSetName).catch((err) => err);
                });
                it("Should copy a data set", async () => {
                    let error;
                    let contents;

                    try {
                        const parentNode = new ZoweDatasetNode(dataSetName, vscode.TreeItemCollapsibleState.None, sessionNode, session);
                        const fromNode = new ZoweDatasetNode(fromMemberName, vscode.TreeItemCollapsibleState.None, parentNode, session);
                        parentNode.contextValue = DS_PDS_CONTEXT;
                        fromNode.contextValue = DS_MEMBER_CONTEXT;

                        const inputBoxStub = sandbox.stub(vscode.window, "showInputBox");
                        inputBoxStub.returns(toMemberName);

                        await dsActions.copyDataSet(fromNode);
                        await dsActions.pasteDataSet(parentNode, testTree);

                        contents = await zowe.Get.dataSet(sessionNode.getSession(), `${dataSetName}(${toMemberName})`);
                    } catch (err) {
                        error = err;
                    }

                    expect(error).to.be.equal(undefined);

                    expect(contents.toString()).to.equal("1234\n");
                }).timeout(TIMEOUT);
            });
            describe("Sequential > Member", () => {
                const fromDataSetName = `${pattern}.COPY.FROM.SET`;
                const toDataSetName = `${pattern}.COPY.TO.SET`;
                const toMemberName = "file2";

                beforeEach(async () => {
                    await Promise.all([
                        zowe.Create.dataSet(
                            sessionNode.getSession(),
                            zowe.CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL,
                            fromDataSetName,
                        ),
                        zowe.Create.dataSet(
                            sessionNode.getSession(),
                            zowe.CreateDataSetTypeEnum.DATA_SET_PARTITIONED,
                            toDataSetName,
                        ),
                    ].map((p) => p.catch((err) => err)));

                    await zowe.Upload.bufferToDataSet(sessionNode.getSession(), Buffer.from("1234"), fromDataSetName).catch((err) => err);
                });
                afterEach(async () => {
                    await Promise.all([
                        zowe.Delete.dataSet(sessionNode.getSession(), fromDataSetName),
                        zowe.Delete.dataSet(sessionNode.getSession(), toDataSetName),
                    ].map((p) => p.catch((err) => err)));
                });

                it("Should copy a data set", async () => {
                    let error;
                    let contents;

                    try {
                        const fromNode = new ZoweDatasetNode(fromDataSetName, vscode.TreeItemCollapsibleState.None, sessionNode, session);
                        const toNode = new ZoweDatasetNode(toDataSetName, vscode.TreeItemCollapsibleState.None, sessionNode, session);
                        fromNode.contextValue = DS_DS_CONTEXT;
                        toNode.contextValue = DS_PDS_CONTEXT;

                        const inputBoxStub = sandbox.stub(vscode.window, "showInputBox");
                        inputBoxStub.returns(toMemberName);

                        await dsActions.copyDataSet(fromNode);
                        await dsActions.pasteDataSet(toNode, testTree);

                        contents = await zowe.Get.dataSet(sessionNode.getSession(), `${toDataSetName}(${toMemberName})`);
                    } catch (err) {
                        error = err;
                    }

                    expect(error).to.be.equal(undefined);

                    expect(contents.toString()).to.equal("1234\n");
                }).timeout(TIMEOUT);
            });
            describe("Member > Sequential", () => {
                const fromDataSetName = `${pattern}.COPY.FROM.SET`;
                const toDataSetName = `${pattern}.COPY.TO.SET`;
                const fromMemberName = "file1";

                beforeEach(async () => {
                    await Promise.all([
                        zowe.Create.dataSet(
                            sessionNode.getSession(),
                            zowe.CreateDataSetTypeEnum.DATA_SET_PARTITIONED,
                            fromDataSetName,
                        ),
                        zowe.Create.dataSet(
                            sessionNode.getSession(),
                            zowe.CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL,
                            toDataSetName,
                        ),
                    ].map((p) => p.catch((err) => err)));

                    await zowe.Upload.bufferToDataSet(
                        sessionNode.getSession(),
                        Buffer.from("1234"),
                        `${fromDataSetName}(${fromMemberName})`,
                    ).catch((err) => err);
                });
                afterEach(async () => {
                    await Promise.all([
                        zowe.Delete.dataSet(sessionNode.getSession(), fromDataSetName),
                        zowe.Delete.dataSet(sessionNode.getSession(), toDataSetName),
                    ].map((p) => p.catch((err) => err)));
                });

                it("Should copy a data set", async () => {
                    let error;
                    let contents;

                    try {
                        const fromParentNode = new ZoweDatasetNode(fromDataSetName, vscode.TreeItemCollapsibleState.None, sessionNode, session);
                        const fromMemberNode = new ZoweDatasetNode(fromMemberName, vscode.TreeItemCollapsibleState.None, fromParentNode, session);
                        const toNode = new ZoweDatasetNode(toDataSetName, vscode.TreeItemCollapsibleState.None, sessionNode, session);
                        fromParentNode.contextValue = DS_PDS_CONTEXT;
                        fromMemberNode.contextValue = DS_MEMBER_CONTEXT;
                        toNode.contextValue = DS_DS_CONTEXT;

                        await dsActions.copyDataSet(fromMemberNode);
                        await dsActions.pasteDataSet(toNode, testTree);

                        contents = await zowe.Get.dataSet(sessionNode.getSession(), toDataSetName);
                    } catch (err) {
                        error = err;
                    }

                    expect(error).to.be.equal(undefined);

                    expect(contents.toString()).to.equal("1234\n");
                }).timeout(TIMEOUT);
            });
        });
    });

    describe("Migrating a data set", () => {
        describe("Success Scenarios", () => {
            describe("Migrate a sequential data set", () => {
                const dataSetName = `${pattern}.SDATA.MIGR`;

                beforeEach(async () => {
                    await zowe.Delete.dataSet(sessionNode.getSession(), dataSetName).catch((err) => err);
                    await zowe.Create.dataSet(sessionNode.getSession(), zowe.CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL, dataSetName);
                });

                afterEach(async () => {
                    await zowe.Delete.dataSet(sessionNode.getSession(), dataSetName).catch((err) => err);
                });

                it("Should send a migrate request", async () => {
                    let error;

                    try {
                        const node = new ZoweDatasetNode(dataSetName, vscode.TreeItemCollapsibleState.None, sessionNode, session);
                        node.contextValue = DS_DS_CONTEXT;

                        await dsActions.hMigrateDataSet(node);
                    } catch (err) {
                        error = err;
                    }
                    expect(error).to.be.equal(undefined);
                }).timeout(TIMEOUT);
            });
            describe("Migrate a partitioned data set", () => {
                const dataSetName = `${pattern}.PDATA.MIGR`;

                beforeEach(async () => {
                    await zowe.Delete.dataSet(sessionNode.getSession(), dataSetName).catch((err) => err);
                    await zowe.Create.dataSet(sessionNode.getSession(), zowe.CreateDataSetTypeEnum.DATA_SET_PARTITIONED,dataSetName);
                });

                afterEach(async () => {
                    await zowe.Delete.dataSet(sessionNode.getSession(), dataSetName).catch((err) => err);
                });

                it("Should send a migrate request", async () => {
                    let error;

                    try {
                        const node = new ZoweDatasetNode(dataSetName, vscode.TreeItemCollapsibleState.None, sessionNode, session);
                        node.contextValue = DS_DS_CONTEXT;

                        await dsActions.hMigrateDataSet(node);
                    } catch (err) {
                        error = err;
                    }
                    expect(error).to.be.equal(undefined);
                }).timeout(TIMEOUT);
            });
        });
        describe("Failure Scenarios", () => {
            describe("Migrate a sequential data set", () => {
                const dataSetName = `${pattern}.TEST.FAIL`;

                it("Should fail if data set doesn't exist", async () => {
                    let error;

                    try {
                        const node = new ZoweDatasetNode(dataSetName, vscode.TreeItemCollapsibleState.None, sessionNode, session);
                        node.contextValue = DS_DS_CONTEXT;

                        await dsActions.hMigrateDataSet(node);
                    } catch (err) {
                        error = err;
                    }
                    expect(error).to.not.equal(undefined);
                }).timeout(TIMEOUT);
            });
        });
    });

    describe("Recalling a data set", () => {
        describe("Success Scenarios", () => {
            describe("Recall a sequential data set", () => {
                const dataSetName = `${pattern}.SDATA.REC`;

                beforeEach(async () => {
                    await zowe.Delete.dataSet(sessionNode.getSession(), dataSetName).catch((err) => err);
                    await zowe.Create.dataSet(sessionNode.getSession(), zowe.CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL, dataSetName);
                });

                afterEach(async () => {
                    await zowe.Delete.dataSet(sessionNode.getSession(), dataSetName).catch((err) => err);
                });

                it("Should send a Recall request", async () => {
                    let error;

                    try {
                        const node = new ZoweDatasetNode(dataSetName, vscode.TreeItemCollapsibleState.None, sessionNode, session);
                        node.contextValue = DS_DS_CONTEXT;

                        await dsActions.hRecallDataSet(node);
                    } catch (err) {
                        error = err;
                    }
                    expect(error).to.be.equal(undefined);
                }).timeout(TIMEOUT);
            });
            describe("Recall a partitioned data set", () => {
                const dataSetName = `${pattern}.PDATA.REC`;

                beforeEach(async () => {
                    await zowe.Delete.dataSet(sessionNode.getSession(), dataSetName).catch((err) => err);
                    await zowe.Create.dataSet(sessionNode.getSession(), zowe.CreateDataSetTypeEnum.DATA_SET_PARTITIONED, dataSetName);
                });

                afterEach(async () => {
                    await zowe.Delete.dataSet(sessionNode.getSession(), dataSetName).catch((err) => err);
                });

                it("Should send a Recall request", async () => {
                    let error;

                    try {
                        const node = new ZoweDatasetNode(dataSetName, vscode.TreeItemCollapsibleState.None, sessionNode, session);
                        node.contextValue = DS_DS_CONTEXT;

                        await dsActions.hRecallDataSet(node);
                    } catch (err) {
                        error = err;
                    }
                    expect(error).to.be.equal(undefined);
                }).timeout(TIMEOUT);
            });
        });
        describe("Failure Scenarios", () => {
            describe("Recall a sequential data set", () => {
                const dataSetName = `${pattern}.TEST.FAIL`;

                it("Should fail if data set doesn't exist", async () => {
                    let error;

                    try {
                        const node = new ZoweDatasetNode(dataSetName, vscode.TreeItemCollapsibleState.None, sessionNode, session);
                        node.contextValue = DS_DS_CONTEXT;

                        await dsActions.hRecallDataSet(node);
                    } catch (err) {
                        error = err;
                    }
                    expect(error).to.not.equal(undefined);
                }).timeout(TIMEOUT);
            });
        });
    });

    describe("Updating Temp Folder", () => {
        // define paths
        const testingPath = path.join(__dirname, "..", "..", "..", "test");
        const providedPathOne = path.join(__dirname, "..", "..", "..", "test-folder-one");
        const providedPathTwo = path.join(__dirname, "..", "..", "..", "test-folder-two");

        // remove directories in case of previously failed tests
        extension.cleanDir(testingPath);
        extension.cleanDir(providedPathOne);
        extension.cleanDir(providedPathTwo);

        it("should assign the temp folder based on preference", async () => {
            // create target folder
            fs.mkdirSync(testingPath);
            await vscode.workspace.getConfiguration().update("Zowe-Temp-Folder-Location",
                { folderPath: `${testingPath}` }, vscode.ConfigurationTarget.Global);

            // expect(extension.ZOWETEMPFOLDER).to.equal(`${testingPath}/temp`);
            expect(ZOWETEMPFOLDER).to.equal(path.join(testingPath, "temp"));

            // Remove directory for subsequent tests
            extension.cleanDir(testingPath);
        }).timeout(TIMEOUT);

        it("should update temp folder on preference change", async () => {
            fs.mkdirSync(providedPathOne);
            fs.mkdirSync(providedPathTwo);

            // set first preference
            await vscode.workspace.getConfiguration().update("Zowe-Temp-Folder-Location",
                { folderPath: `${providedPathOne}` }, vscode.ConfigurationTarget.Global);

            // change preference and test for update
            await vscode.workspace.getConfiguration().update("Zowe-Temp-Folder-Location",
                { folderPath: `${providedPathTwo}` }, vscode.ConfigurationTarget.Global);

            // expect(extension.ZOWETEMPFOLDER).to.equal(`${providedPathTwo}/temp`);
            expect(ZOWETEMPFOLDER).to.equal(path.join(providedPathTwo, "temp"));

            // Remove directory for subsequent tests
            extension.cleanDir(providedPathOne);
            extension.cleanDir(providedPathTwo);
        }).timeout(TIMEOUT);

        it("should assign default temp folder, if preference is empty", async () => {
            const expectedDefaultTemp = path.join(__dirname, "..", "..", "..", "resources", "temp");
            await vscode.workspace.getConfiguration().update("Zowe-Temp-Folder-Location",
                { folderPath: "" }, vscode.ConfigurationTarget.Global);
            expect(ZOWETEMPFOLDER).to.equal(expectedDefaultTemp);
        }).timeout(TIMEOUT);
    });

    describe("Initializing Favorites", () => {
        it("should work when provided an empty Favorites list", async () => {
            const log = Logger.getAppLogger();
            await vscode.workspace.getConfiguration().update("Zowe-DS-Persistent",
                { persistence: true, favorites: [] }, vscode.ConfigurationTarget.Global);
            const testTree3 = await createDatasetTree(log);
            expect(testTree3.mFavorites).to.deep.equal([]);
        }).timeout(TIMEOUT);

        it("should work when provided a valid Favorites list", async () => {
            const log = Logger.getAppLogger();
            const profileName = testConst.profile.name;
            const favorites = [`[${profileName}]: ${pattern}.EXT.PDS{pds}`,
            `[${profileName}]: ${pattern}.EXT.PS{ds}`,
            `[${profileName}]: ${pattern}.EXT.SAMPLE.PDS{pds}`,
            `[${profileName}]: ${pattern}.EXT{session}`];
            await vscode.workspace.getConfiguration().update("Zowe-DS-Persistent",
                { persistence: true, favorites }, vscode.ConfigurationTarget.Global);
            const testTree3 = await createDatasetTree(log);
            const initializedFavLabels = [`${pattern}.EXT.PDS`,
            `${pattern}.EXT.PS`,
            `${pattern}.EXT.SAMPLE.PDS`,
            `${pattern}.EXT`];
            expect(testTree3.mFavorites[0].children.map((node) => node.label)).to.deep.equal(initializedFavLabels);
        }).timeout(TIMEOUT);

        it("should log a warn message when provided an invalid Favorites list", async () => {
            const log = Logger.getAppLogger();
            const corruptedFavorite = pattern + ".EXT.ABCDEFGHI.PS[profileName]{ds}";
            const favorites = [pattern + ".EXT.PDS[profileName]{pds}", corruptedFavorite];
            await vscode.workspace.getConfiguration().update("Zowe-DS-Persistent",
                { persistence: true, favorites }, vscode.ConfigurationTarget.Global);
            const logWarnStub = sandbox.spy(log, "warn");
            await createDatasetTree(log);
            expect(logWarnStub.gotCalledOnce);
        }).timeout(TIMEOUT);

        it("should still create favorite nodes when given a favorite with invalid profile name", async () => {
            const log = Logger.getAppLogger();
            const profileName = testConst.profile.name;
            // Reset testTree's favorites to be empty
            testTree.mFavorites = [];
            // Then, update favorites in settings
            const favorites = [`[${profileName}]: ${pattern}.EXT.PDS{pds}`,
            `[${profileName}]: ${pattern}.EXT.PS{ds}`,
            `[badProfileName]: ${pattern}.BAD.PROFILE.EXT.PS{ds}`,
            `[${profileName}]: ${pattern}.EXT.SAMPLE.PDS{pds}`,
            `[${profileName}]: ${pattern}.EXT{session}`];
            await vscode.workspace.getConfiguration().update("Zowe-DS-Persistent",
                { persistence: true, favorites }, vscode.ConfigurationTarget.Global);
            await testTree.initializeFavorites(log);
            const initializedFavProfileLabels = [`${profileName}`, "badProfileName"];
            const goodProfileFavLabels = [
            `${pattern}.EXT.PDS`,
            `${pattern}.EXT.PS`,
            `${pattern}.EXT.SAMPLE.PDS`,
            `${pattern}.EXT`];
            const badProfileFavLabels = [`${pattern}.BAD.PROFILE.EXT.PS`];
            // Profile nodes for both valid and invalid profiles should be created in mFavorites. (Error checking happens on expand.)
            expect(testTree.mFavorites.map((favProfileNode) => favProfileNode.label)).to.deep.equal(initializedFavProfileLabels);
            // Favorite item nodes should be created for favorite profile nodes of both valid and valid profiles.
            expect(testTree.mFavorites[0].children.map((node) => node.label)).to.deep.equal(goodProfileFavLabels);
            expect(testTree.mFavorites[1].children.map((node) => node.label)).to.deep.equal(badProfileFavLabels);
        }).timeout(TIMEOUT);
    });
});

/*************************************************************************************************************
 * Returns array of all subnodes of given node
 *************************************************************************************************************/
async function getAllNodes(nodes: IZoweTreeNode[]) {
    let allNodes = new Array<IZoweTreeNode>();

    for (const node of nodes) {
        allNodes = allNodes.concat(await getAllNodes(await node.getChildren()));
        allNodes.push(node);
    }

    return allNodes;
}

describe("Extension Integration Tests - USS", () => {
    const expect = chai.expect;
    chai.use(chaiAsPromised);

    // Profiles.createInstance(Logger.getAppLogger());
    const session = zowe.ZosmfSession.createBasicZosmfSession(testConst.profile);
    const ussSessionNode = new ZoweUSSNode(
        testConst.profile.name,
        vscode.TreeItemCollapsibleState.Expanded,
        null,
        session,
        null,
        false,
        testConst.profile.name);
    ussSessionNode.contextValue = USS_SESSION_CONTEXT;
    const fullUSSPath = testConst.ussPattern;
    ussSessionNode.fullPath = fullUSSPath;
    const ussTestTree = new USSTree();
    ussTestTree.mSessionNodes.splice(-1, 0, ussSessionNode);

    let sandbox;

    beforeEach(async function() {
        this.timeout(TIMEOUT);
        sandbox = sinon.createSandbox();
        await extension.deactivate();
    });

    afterEach(async function() {
        this.timeout(TIMEOUT);
        sandbox.restore();
    });

    describe("TreeView", () => {
        it("should create the USS TreeView", async () => {
            // Initialize uss file provider
            const ussFileProvider = new USSTree();

            const nonFavorites = ussFileProvider.mSessionNodes.filter((node) => node.contextValue !== FAVORITE_CONTEXT);
            const allNodes = await getAllUSSNodes(nonFavorites);
            for (const node of allNodes) {
                // For each node, select that node in TreeView by calling reveal()
                await ussFileProvider.getTreeView().reveal(node);
                // Test that the node is successfully selected
                expect(node).to.deep.equal(ussFileProvider.getTreeView().selection[0]);
            }
        }).timeout(TIMEOUT);
    });

    describe("Creating a Session -USS", () => {
        it("should add a session", async () => {
            // Grab profiles
            const profileManager = await new CliProfileManager({
                profileRootDirectory: path.join(os.homedir(), ".zowe", "profiles"),
                type: "zosmf"
            });
            const profileNamesList = profileManager.getAllProfileNames().filter((profileName) =>
                // Find all cases where a profile is not already displayed
                !ussTestTree.mSessionNodes.find((node) =>
                    node.label.toUpperCase() === profileName.toUpperCase()
                )
            );

            // Mock user selecting first profile from list
            const inputBoxStub1 = sandbox.stub(vscode.window, "showQuickPick");
            inputBoxStub1.returns(new utils.FilterDescriptor("\uFF0B " + "Create a New Connection to z/OS"));
            const stubresolve = sandbox.stub(utils, "resolveQuickPickHelper");
            stubresolve.returns(new utils.FilterItem(profileNamesList[0]));

            await ussTestTree.createZoweSession(ussTestTree);
            expect(ussTestTree.mSessionNodes[ussTestTree.mSessionNodes.length - 1].label).to.equal(profileNamesList[0]);
        }).timeout(TIMEOUT);
    });

    describe("Deactivate", () => {
        it("should clean up the local files when deactivate is invoked", async () => {
            try {
                fs.mkdirSync(ZOWETEMPFOLDER);
                fs.mkdirSync(USS_DIR);
            } catch (err) {
                // if operation failed, wait a second and try again
                await new Promise((resolve) => setTimeout(resolve, 1000));
                fs.mkdirSync(USS_DIR);
            }
            fs.closeSync(fs.openSync(path.join(USS_DIR, "file1"), "w"));
            fs.closeSync(fs.openSync(path.join(USS_DIR, "file2"), "w"));
            await extension.deactivate();
            expect(fs.existsSync(path.join(USS_DIR, "file1"))).to.equal(false);
            expect(fs.existsSync(path.join(USS_DIR, "file2"))).to.equal(false);
        }).timeout(TIMEOUT);
    });

    describe("Enter USS Pattern", () => {
        it("should output path that match the user-provided path", async () => {
            const ussTestTree1 = new USSTree();
            ussTestTree1.mSessionNodes.splice(-1, 0, ussSessionNode);
            const inputBoxStub2 = sandbox.stub(vscode.window, "showInputBox");
            inputBoxStub2.returns(fullUSSPath);
            const stubresolve = sandbox.stub(utils, "resolveQuickPickHelper");
            stubresolve.returns(new utils.FilterItem(fullUSSPath));

            await ussTestTree1.filterPrompt(ussSessionNode);

            expect(ussTestTree1.mSessionNodes[0].fullPath).to.equal(fullUSSPath);
            expect(ussTestTree1.mSessionNodes[0].tooltip).to.equal(fullUSSPath);
            expect(ussTestTree1.mSessionNodes[0].collapsibleState).to.equal(vscode.TreeItemCollapsibleState.Expanded);

            const childrenFromTree = await ussSessionNode.getChildren();
            childrenFromTree.unshift(...(await childrenFromTree[0].getChildren()));

            for (const child of childrenFromTree) {
                await ussTestTree1.getTreeView().reveal(child);
                expect(child).to.deep.equal(ussTestTree1.getTreeView().selection[0]);
            }
        }).timeout(TIMEOUT);

        it("should pop up a message if the user doesn't enter a USS path", async () => {
            const inputBoxStub1 = sandbox.stub(vscode.window, "showQuickPick");
            inputBoxStub1.returns(new utils.FilterDescriptor("\uFF0B " + "Create a new filter"));
            const stubresolve = sandbox.stub(utils, "resolveQuickPickHelper");
            stubresolve.returns(new utils.FilterDescriptor("\uFF0B " + "Create a new filter"));
            const inputBoxStub2 = sandbox.stub(vscode.window, "showInputBox");
            inputBoxStub2.returns("");
            const showInfoStub2 = sandbox.spy(vscode.window, "showInformationMessage");
            await ussTestTree.filterPrompt(ussSessionNode);
            const gotCalled = showInfoStub2.calledWith("You must enter a path.");
            expect(gotCalled).to.equal(true);
        }).timeout(TIMEOUT);
    });

    describe("Saving a USS File", () => {
        // TODO Move to appropriate class
        it("should download, change, and re-upload a file", async () => {
            const changedData = "File Upload Test " + Math.random().toString(36).slice(2);

            const rootChildren = await ussTestTree.getChildren();
            rootChildren[0].dirty = true;
            const sessChildren1 = await ussTestTree.getChildren(rootChildren[0]);
            sessChildren1[3].dirty = true;
            const sessChildren2 = await ussTestTree.getChildren(sessChildren1[3]);
            sessChildren2[2].dirty = true;
            const dirChildren = await ussTestTree.getChildren(sessChildren2[2]);
            const localPath = path.join(USS_DIR, "/", testConst.profile.name,
                dirChildren[0].fullPath);

            await dirChildren[0].openUSS(false, true, ussTestTree);
            const doc = await vscode.workspace.openTextDocument(localPath);

            const originalData = doc.getText().trim();

            // write new data
            fs.writeFileSync(localPath, changedData);

            // Upload file
            await ussActions.saveUSSFile(doc, ussTestTree);
            await fs.unlinkSync(localPath);

            // Download file
            await dirChildren[0].openUSS(false, true, ussTestTree);

            // Change contents back
            fs.writeFileSync(localPath, originalData);
            await ussActions.saveUSSFile(doc, ussTestTree);
        }).timeout(TIMEOUT);
    });
});

describe("TreeView", () => {
    const expect = chai.expect;
    chai.use(chaiAsPromised);

    it("should create the TreeView", async () => {
        // Initialize dataset provider
        const datasetProvider = new DatasetTree();

        const allNodes = await getAllNodes(datasetProvider.mSessionNodes);
        for (const node of allNodes) {
            // For each node, select that node in TreeView by calling reveal()
            await datasetProvider.getTreeView().reveal(node);
            // Test that the node is successfully selected
            expect(node).to.deep.equal(datasetProvider.getTreeView().selection[0]);
        }
    }).timeout(TIMEOUT);
});

/*************************************************************************************************************
 * Returns array of all subnodes of given node
 *************************************************************************************************************/
async function getAllUSSNodes(nodes: IZoweTreeNode[]) {
    let allNodes = new Array<IZoweTreeNode>();

    for (const node of nodes) {
        allNodes = allNodes.concat(await getAllUSSNodes(await node.getChildren()));
        allNodes.push(node);
    }

    return allNodes;
}
