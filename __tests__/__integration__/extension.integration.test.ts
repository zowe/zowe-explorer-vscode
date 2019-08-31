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
import * as zowe from "@brightside/core";
import { Logger, CliProfileManager } from "@brightside/imperative";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as extension from "../../src/extension";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as sinon from "sinon";
import * as testConst from "../../resources/testProfileData";
import * as vscode from "vscode";
import { DatasetTree, createDatasetTree } from "../../src/DatasetTree";
import { ZoweNode } from "../../src/ZoweNode";
import { USSTree } from "../../src/USSTree";
import { ZoweUSSNode } from "../../src/ZoweUSSNode";

const TIMEOUT = 45000;
declare var it: Mocha.ITestDefinition;
// declare var describe: any;

describe("Extension Integration Tests", () => {
    const expect = chai.expect;
    chai.use(chaiAsPromised);

    const session = zowe.ZosmfSession.createBasicZosmfSession(testConst.profile);
    const sessionNode = new ZoweNode(testConst.profile.name, vscode.TreeItemCollapsibleState.Expanded, null, session);
    sessionNode.contextValue = "session";
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

    const oldSettings = vscode.workspace.getConfiguration("Zowe-Persistent-Favorites");

    after(async () => {
        await vscode.workspace.getConfiguration().update("Zowe-Persistent-Favorites", oldSettings, vscode.ConfigurationTarget.Global);
    });

    describe("TreeView", () => {
        it("should create the TreeView", async () => {
            // Initialize dataset provider
            const datasetProvider = new DatasetTree();

            // Create the TreeView using datasetProvider to create tree structure
            const testTreeView = vscode.window.createTreeView("zowe.explorer", {treeDataProvider: datasetProvider});

            const allNodes = await getAllNodes(datasetProvider.mSessionNodes);
            for (const node of allNodes) {
                // For each node, select that node in TreeView by calling reveal()
                await testTreeView.reveal(node);
                // Test that the node is successfully selected
                expect(node).to.deep.equal(testTreeView.selection[0]);
            }
            testTreeView.dispose();
        }).timeout(TIMEOUT);
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
            const stub = sandbox.stub(vscode.window, "showQuickPick");
            stub.returns(profileNamesList[0]);

            await extension.addSession(testTree);
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

            await extension.createFile(sessionNode, testTree);

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

            await extension.createFile(sessionNode, testTree);

            const showErrorStub = sandbox.spy(vscode.window, "showErrorMessage");
            await expect(extension.createFile(sessionNode, testTree)).to.eventually.be.rejectedWith(Error);
            const gotCalled = showErrorStub.called;
            expect(gotCalled).to.equal(true);
        }).timeout(TIMEOUT);

        it("should create a member when zowe.createMember is invoked", async () => {
            const testFileName = "MEMBER";
            const inputBoxStub = sandbox.stub(vscode.window, "showInputBox");
            inputBoxStub.returns(testFileName);

            const testParentName = pattern + ".EXT.SAMPLE.PDS";
            const testParentNode = new ZoweNode(testParentName, vscode.TreeItemCollapsibleState.Collapsed, sessionNode, session);
            await extension.createMember(testParentNode, testTree);

            const allMembers = await zowe.List.allMembers(session, testParentName);

            expect(allMembers.apiResponse.items[0].member).to.deep.equal(testFileName);
        }).timeout(TIMEOUT);
    });

    describe("Deactivate", () => {
        it("should clean up the local files when deactivate is invoked", async () => {
            try {
                fs.mkdirSync(extension.BRIGHTTEMPFOLDER);
                fs.mkdirSync(extension.DS_DIR);
            } catch (err) {
                // if operation failed, wait a second and try again
                await new Promise((resolve) => setTimeout(resolve, 1000));
                fs.mkdirSync(extension.DS_DIR);
            }
            fs.closeSync(fs.openSync(path.join(extension.DS_DIR, "file1"), "w"));
            fs.closeSync(fs.openSync(path.join(extension.DS_DIR, "file2"), "w"));
            await extension.deactivate();
            expect(fs.existsSync(path.join(extension.DS_DIR, "file1"))).to.equal(false);
            expect(fs.existsSync(path.join(extension.DS_DIR, "file2"))).to.equal(false);
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
            const testNode = new ZoweNode(dataSetName, vscode.TreeItemCollapsibleState.None, sessionNode, session);

            // Mock user selecting first option from list
            const quickPickStub = sandbox.stub(vscode.window, "showQuickPick");
            quickPickStub.returns("Yes");
            await extension.deleteDataset(testNode, testTree);

            const response = await zowe.List.dataSet(session, dataSetName);

            expect(response.apiResponse.items).to.deep.equal([]);
        }).timeout(TIMEOUT);
        it("should not delete a data set if user did not verify", async () => {
            await zowe.Create.dataSet(sessionNode.getSession(), zowe.CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL, dataSetName);
            const testNode = new ZoweNode(dataSetName, vscode.TreeItemCollapsibleState.None, sessionNode, session);

            // Mock user selecting second option from list
            const quickPickStub = sandbox.stub(vscode.window, "showQuickPick");
            quickPickStub.returns("No");
            await extension.deleteDataset(testNode, testTree);

            const response = await zowe.List.dataSet(session, dataSetName);

            // Check that dataset was not deleted
            expect(response.apiResponse.items.filter((entry) => {
                return (entry.dsname === dataSetName.toUpperCase());
            }).length).to.greaterThan(0);
        }).timeout(TIMEOUT);
        it("should delete a data set if user cancelled", async () => {
            await zowe.Create.dataSet(sessionNode.getSession(), zowe.CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL, dataSetName);
            const testNode = new ZoweNode(dataSetName, vscode.TreeItemCollapsibleState.None, sessionNode, session);

            // Mock user not selecting any option from list
            const quickPickStub = sandbox.stub(vscode.window, "showQuickPick");
            quickPickStub.returns(undefined);
            await extension.deleteDataset(testNode, testTree);

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

            await extension.enterPattern(sessionNode, testTree);

            expect(testTree.mSessionNodes[1].pattern).to.equal(pattern);
            expect(testTree.mSessionNodes[1].tooltip).to.equal(pattern);
            expect(testTree.mSessionNodes[1].collapsibleState).to.equal(vscode.TreeItemCollapsibleState.Expanded);

            const testTreeView = vscode.window.createTreeView("zowe.explorer", {treeDataProvider: testTree});

            const childrenFromTree = await sessionNode.getChildren();
            childrenFromTree.unshift(...(await childrenFromTree[0].getChildren()));

            await testTreeView.reveal(childrenFromTree[0]);
            expect(childrenFromTree[0]).to.deep.equal(testTreeView.selection[0]);

        }).timeout(TIMEOUT);

        it("should match data sets for multiple patterns", async () => {
            const inputBoxStub = sandbox.stub(vscode.window, "showInputBox");
            const search = testConst.orPattern;
            inputBoxStub.returns(search);

            await extension.enterPattern(sessionNode, testTree);

            expect(testTree.mSessionNodes[1].pattern).to.equal(search.toUpperCase());
            expect(testTree.mSessionNodes[1].tooltip).to.equal(search.toUpperCase());
            expect(testTree.mSessionNodes[1].collapsibleState).to.equal(vscode.TreeItemCollapsibleState.Expanded);

            const testTreeView = vscode.window.createTreeView("zowe.explorer", {treeDataProvider: testTree});

            const sessionChildren = await sessionNode.getChildren();
            const childrenFromTree = await getAllNodes(sessionChildren);

            for (const child of childrenFromTree) {
                await testTreeView.reveal(child);
                expect(child).to.deep.equal(testTreeView.selection[0]);
            }
        }).timeout(TIMEOUT);

        it("should pop up a message if the user doesn't enter a pattern", async () => {
            const inputBoxStub = sandbox.stub(vscode.window, "showInputBox");
            inputBoxStub.returns("");

            const showInfoStub = sandbox.spy(vscode.window, "showInformationMessage");
            await extension.enterPattern(sessionNode, testTree);
            const gotCalled = showInfoStub.calledWith("You must enter a pattern.");
            expect(gotCalled).to.equal(true);
        }).timeout(TIMEOUT);

        it("should work when called from a saved search", async () => {
            const searchPattern = pattern + ".search";
            const favoriteSearch = new ZoweNode("[" + testConst.profile.name + "]: " + searchPattern,
                vscode.TreeItemCollapsibleState.None, testTree.mFavoriteSession, null);
            favoriteSearch.contextValue = "sessionf";
            await extension.enterPattern(favoriteSearch, testTree);

            expect(testTree.mSessionNodes[1].pattern).to.equal(searchPattern.toUpperCase());
            expect(testTree.mSessionNodes[1].tooltip).to.equal(searchPattern.toUpperCase());
            expect(testTree.mSessionNodes[1].collapsibleState).to.equal(vscode.TreeItemCollapsibleState.Expanded);

            const testTreeView = vscode.window.createTreeView("zowe.explorer", {treeDataProvider: testTree});

            const childrenFromTree = await sessionNode.getChildren();
            expect(childrenFromTree[0].children).to.deep.equal([]);

            // reset tree
            const inputBoxStub = sandbox.stub(vscode.window, "showInputBox");
            inputBoxStub.returns(pattern);
            await extension.enterPattern(sessionNode, testTree);
        }).timeout(TIMEOUT);
    });

    describe("Opening a PS", () => {
        it("should open a PS", async () => {
            const node = new ZoweNode(pattern + ".EXT.PS", vscode.TreeItemCollapsibleState.None, sessionNode, null);
            await extension.openPS(node);
            expect(path.relative(vscode.window.activeTextEditor.document.fileName,
                extension.getDocumentFilePath(pattern + ".EXT.PS", node))).to.equal("");
            expect(fs.existsSync(extension.getDocumentFilePath(pattern + ".EXT.PS", node))).to.equal(true);
        }).timeout(TIMEOUT);

        it("should display an error message when openPS is passed an invalid node", async () => {
            const node = new ZoweNode(pattern + ".GARBAGE", vscode.TreeItemCollapsibleState.None, sessionNode, null);
            const errorMessageStub = sandbox.spy(vscode.window, "showErrorMessage");
            await expect(extension.openPS(node)).to.eventually.be.rejectedWith(Error);

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
            await extension.openPS(children[1]);

            const changedData = "PS Upload Test";

            fs.writeFileSync(path.join(extension.BRIGHTTEMPFOLDER, children[1].label + "[" + profiles[1].label + "]"), changedData);

            // Upload file
            const doc = await vscode.workspace.openTextDocument(path.join(extension.BRIGHTTEMPFOLDER,
                children[1].label + "[" + profiles[1].label + "]"));
            await extension.saveFile(doc, testTree);

            // Download file
            await extension.openPS(children[1]);

            expect(doc.getText().trim()).to.deep.equal("PS Upload Test");

            // Change contents back
            const originalData = "";
            fs.writeFileSync(path.join(path.join(extension.BRIGHTTEMPFOLDER, children[1].label)), originalData);
        }).timeout(TIMEOUT);

        it("should download, change, and re-upload a PDS member", async () => {
            // Test for PS under HLQ
            const profiles = await testTree.getChildren();
            profiles[1].dirty = true;
            const children = await profiles[1].getChildren();
            children[0].dirty = true;

            // Test for member under PO
            const childrenMembers = await testTree.getChildren(children[0]);
            await extension.openPS(childrenMembers[0]);

            const changedData2 = "PO Member Upload Test";

            fs.writeFileSync(path.join(extension.BRIGHTTEMPFOLDER, children[0].label + "(" + childrenMembers[0].label + ")"), changedData2);

            // Upload file
            const doc2 = await vscode.workspace.openTextDocument(path.join(extension.BRIGHTTEMPFOLDER, children[0].label +
                "(" + childrenMembers[0].label + ")"));
            extension.saveFile(doc2, testTree);

            // Download file
            await extension.openPS(childrenMembers[0]);

            expect(doc2.getText().trim()).to.deep.equal("PO Member Upload Test");

            // Change contents back
            const originalData2 = "";
            fs.writeFileSync(path.join(extension.BRIGHTTEMPFOLDER, children[0].label + "(" + childrenMembers[0].label + ")"), originalData2);
        }).timeout(TIMEOUT);

        // TODO add tests for saving data set from favorites
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

            expect(extension.BRIGHTTEMPFOLDER).to.equal(`${testingPath}/temp`);

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

            expect(extension.BRIGHTTEMPFOLDER).to.equal(`${providedPathTwo}/temp`);

            // Remove directory for subsequent tests
            extension.cleanDir(providedPathOne);
            extension.cleanDir(providedPathTwo);
        }).timeout(TIMEOUT);

        it("should assign default temp folder, if preference is empty", async () => {
            const expectedDefaultTemp = path.join(__dirname, "..", "..", "..", "resources", "temp");
            await vscode.workspace.getConfiguration().update("Zowe-Temp-Folder-Location",
                { folderPath: "" }, vscode.ConfigurationTarget.Global);
            expect(extension.BRIGHTTEMPFOLDER).to.equal(expectedDefaultTemp);
        }).timeout(TIMEOUT);
    });

    describe("Initializing Favorites", () => {
        it("should work when provided an empty Favorites list", async () => {
            const log = Logger.getAppLogger();
            await vscode.workspace.getConfiguration().update("Zowe-Persistent-Favorites",
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
            await vscode.workspace.getConfiguration().update("Zowe-Persistent-Favorites",
                { persistence: true, favorites }, vscode.ConfigurationTarget.Global);
            const testTree3 = await createDatasetTree(log);
            const favoritesArray = [`[${profileName}]: ${pattern}.EXT.PDS`,
                                    `[${profileName}]: ${pattern}.EXT.PS`,
                                    `[${profileName}]: ${pattern}.EXT.SAMPLE.PDS`,
                                    `[${profileName}]: ${pattern}.EXT`];
            expect(testTree3.mFavorites.map((node) => node.label)).to.deep.equal(favoritesArray);
        }).timeout(TIMEOUT);

        it("should show an error message when provided an invalid Favorites list", async () => {
            const log = Logger.getAppLogger();
            const corruptedFavorite = pattern + ".EXT.ABCDEFGHI.PS[profileName]{ds}";
            const favorites = [pattern + ".EXT.PDS[profileName]{pds}", corruptedFavorite];
            await vscode.workspace.getConfiguration().update("Zowe-Persistent-Favorites",
                { persistence: true, favorites }, vscode.ConfigurationTarget.Global);

            const showErrorStub = sandbox.spy(vscode.window, "showErrorMessage");
            await createDatasetTree(log);
            const gotCalled = showErrorStub.calledWith("Favorites file corrupted: " + corruptedFavorite);
            expect(gotCalled).to.equal(true);
        }).timeout(TIMEOUT);

        it("should show an error message and still load other valid-profile favorites when given a favorite with invalid profile name", async () => {
            const profileName = testConst.profile.name;
            // Reset testTree's favorites to be empty
            testTree.mFavorites = [];
            // Then, update
            const favorites = [`[${profileName}]: ${pattern}.EXT.PDS{pds}`,
                               `[${profileName}]: ${pattern}.EXT.PS{ds}`,
                               `['badProfileName']: ${pattern}.EXT.PS{ds}`,
                               `[${profileName}]: ${pattern}.EXT.SAMPLE.PDS{pds}`,
                               `[${profileName}]: ${pattern}.EXT{session}`];
            await vscode.workspace.getConfiguration().update("Zowe-Persistent-Favorites",
                { persistence: true, favorites }, vscode.ConfigurationTarget.Global);
            const showErrorStub = sandbox.spy(vscode.window, "showErrorMessage");
            await extension.initializeFavorites(testTree);
            const favoritesArray = [`[${profileName}]: ${pattern}.EXT.PDS`,
                                    `[${profileName}]: ${pattern}.EXT.PS`,
                                    `[${profileName}]: ${pattern}.EXT.SAMPLE.PDS`,
                                    `[${profileName}]: ${pattern}.EXT`];
            const gotCalledOnce = showErrorStub.calledOnce;
            expect(testTree.mFavorites.map((node) => node.label)).to.deep.equal(favoritesArray);
            expect(gotCalledOnce).to.equal(true);
        }).timeout(TIMEOUT);
    });
});

/*************************************************************************************************************
 * Returns array of all subnodes of given node
 *************************************************************************************************************/
async function getAllNodes(nodes: ZoweNode[]) {
    let allNodes = new Array<ZoweNode>();

    for (const node of nodes) {
        allNodes = allNodes.concat(await getAllNodes(await node.getChildren()));
        allNodes.push(node);
    }

    return allNodes;
}

describe("Extension Integration Tests - USS", () => {
    const expect = chai.expect;
    chai.use(chaiAsPromised);

    const session = zowe.ZosmfSession.createBasicZosmfSession(testConst.profile);
    const ussSessionNode = new ZoweUSSNode(
        testConst.profile.name,
        vscode.TreeItemCollapsibleState.Expanded,
        null,
        session,
        null,
        false,
        testConst.profile.name);
    ussSessionNode.contextValue = "uss_session";
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

            // Create the TreeView using ussFileProvider to create tree structure
            const ussTestTreeView = vscode.window.createTreeView("zowe.uss.explorer", {treeDataProvider: ussFileProvider});

            const nonFavorites = ussFileProvider.mSessionNodes.filter((node) => node.contextValue !== "favorite" );
            const allNodes = await getAllUSSNodes(nonFavorites);
            for (const node of allNodes) {
                // For each node, select that node in TreeView by calling reveal()
                await ussTestTreeView.reveal(node);
                // Test that the node is successfully selected
                expect(node).to.deep.equal(ussTestTreeView.selection[0]);
            }
            ussTestTreeView.dispose();
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
            const stub = sandbox.stub(vscode.window, "showQuickPick");
            stub.returns(profileNamesList[0]);

            await extension.addUSSSession(ussTestTree);
            expect(ussTestTree.mSessionNodes[ussTestTree.mSessionNodes.length - 1].label).to.equal(profileNamesList[0]);
        }).timeout(TIMEOUT);
    });

    describe("Deactivate", () => {
        it("should clean up the local files when deactivate is invoked", async () => {
            try {
                fs.mkdirSync(extension.BRIGHTTEMPFOLDER);
                fs.mkdirSync(extension.USS_DIR);
            } catch (err) {
                // if operation failed, wait a second and try again
                await new Promise((resolve) => setTimeout(resolve, 1000));
                fs.mkdirSync(extension.USS_DIR);
            }
            fs.closeSync(fs.openSync(path.join(extension.USS_DIR, "file1"), "w"));
            fs.closeSync(fs.openSync(path.join(extension.USS_DIR, "file2"), "w"));
            await extension.deactivate();
            expect(fs.existsSync(path.join(extension.USS_DIR, "file1"))).to.equal(false);
            expect(fs.existsSync(path.join(extension.USS_DIR, "file2"))).to.equal(false);
        }).timeout(TIMEOUT);
    });

    describe("Enter USS Pattern", () => {
        it("should output path that match the user-provided path", async () => {
            const inputBoxStub1 = sandbox.stub(vscode.window, "showQuickPick");
            inputBoxStub1.returns(" -- Specify Filter -- ");
            const inputBoxStub2 = sandbox.stub(vscode.window, "showInputBox");
            inputBoxStub2.returns(fullUSSPath);

            await ussTestTree.ussFilterPrompt(ussSessionNode);

            expect(ussTestTree.mSessionNodes[0].fullPath).to.equal(fullUSSPath);
            expect(ussTestTree.mSessionNodes[0].tooltip).to.equal(fullUSSPath);
            expect(ussTestTree.mSessionNodes[0].collapsibleState).to.equal(vscode.TreeItemCollapsibleState.Expanded);

            const ussTestTreeView = vscode.window.createTreeView("zowe.uss.explorer", {treeDataProvider: ussTestTree});

            const childrenFromTree = await ussSessionNode.getChildren();
            childrenFromTree.unshift(...(await childrenFromTree[0].getChildren()));

            for (const child of childrenFromTree) {
                await ussTestTreeView.reveal(child);
                expect(child).to.deep.equal(ussTestTreeView.selection[0]);
            }
        }).timeout(TIMEOUT);

        it("should pop up a message if the user doesn't enter a USS path", async () => {
            const inputBoxStub1 = sandbox.stub(vscode.window, "showQuickPick");
            inputBoxStub1.returns(" -- Specify Filter -- ");
            const inputBoxStub2 = sandbox.stub(vscode.window, "showInputBox");
            inputBoxStub2.returns("");

            const showInfoStub2 = sandbox.spy(vscode.window, "showInformationMessage");
            await ussTestTree.ussFilterPrompt(ussSessionNode);
            const gotCalled = showInfoStub2.calledWith("You must enter a path.");
            expect(gotCalled).to.equal(true);
        }).timeout(TIMEOUT);
    });

    describe("Saving a USS File", () => {

        it("should download, change, and re-upload a file", async () => {
            const changedData = "File Upload Test "+ Math.random().toString(36).slice(2);

            const rootChildren = await ussTestTree.getChildren();
            rootChildren[0].dirty = true;
            const sessChildren1 = await ussTestTree.getChildren(rootChildren[0]);
            sessChildren1[3].dirty = true;
            const sessChildren2 = await ussTestTree.getChildren(sessChildren1[3]);
            sessChildren2[2].dirty = true;
            const dirChildren = await ussTestTree.getChildren(sessChildren2[2]);
            const localPath = path.join(extension.USS_DIR, "/",  testConst.profile.name,
            dirChildren[0].fullPath);

            await extension.openUSS(dirChildren[0]);
            const doc = await vscode.workspace.openTextDocument(localPath);

            const originalData = doc.getText().trim();

            // write new data
            fs.writeFileSync(localPath, changedData);

            // Upload file
            await extension.saveUSSFile(doc, ussTestTree);
            await fs.unlinkSync(localPath);

            // Download file
            await extension.openUSS(dirChildren[0]);

            // Change contents back
            fs.writeFileSync(localPath, originalData);
            await extension.saveUSSFile(doc, ussTestTree);
        }).timeout(TIMEOUT);
    });
});

/*************************************************************************************************************
 * Returns array of all subnodes of given node
 *************************************************************************************************************/
async function getAllUSSNodes(nodes: ZoweUSSNode[]) {
    let allNodes = new Array<ZoweUSSNode>();

    for (const node of nodes) {
        allNodes = allNodes.concat(await getAllUSSNodes(await node.getChildren()));
        allNodes.push(node);
    }

    return allNodes;
}
