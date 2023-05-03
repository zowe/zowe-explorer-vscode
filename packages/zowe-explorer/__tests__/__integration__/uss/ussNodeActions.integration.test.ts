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

import { Create, Delete, imperative, List, ZosmfSession } from "@zowe/cli";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as sinon from "sinon";
import * as testConst from "../../../resources/testProfileData";
import * as vscode from "vscode";
import { USSTree } from "../../../src/uss/USSTree";
import { ZoweUSSNode } from "../../../src/uss/ZoweUSSNode";
import * as globals from "../../../src/globals";

const TIMEOUT = 45000;
declare let it: Mocha.TestFunction;
// declare var describe: any;

const testProfile: imperative.IProfileLoaded = {
    name: testConst.profile.name,
    profile: testConst.profile,
    type: testConst.profile.type,
    message: "",
    failNotFound: false,
};

describe("ussNodeActions integration test", async () => {
    const expect = chai.expect;
    chai.use(chaiAsPromised);

    const cmdArgs: imperative.ICommandArguments = {
        $0: "zowe",
        _: [""],
        host: testProfile.profile.host,
        port: testProfile.profile.port,
        basePath: testProfile.profile.basePath,
        rejectUnauthorized: testProfile.profile.rejectUnauthorized,
        user: testProfile.profile.user,
        password: testProfile.profile.password,
    };
    const sessCfg = ZosmfSession.createSessCfgFromArgs(cmdArgs);
    imperative.ConnectionPropsForSessCfg.resolveSessCfgProps(sessCfg, cmdArgs);
    const session = new imperative.Session(sessCfg);
    const sessionNode = new ZoweUSSNode(
        testConst.profile.name,
        vscode.TreeItemCollapsibleState.Expanded,
        null,
        session,
        null,
        false,
        testProfile.name
    );
    sessionNode.contextValue = globals.DS_SESSION_CONTEXT;
    const testTree = new USSTree();
    testTree.mSessionNodes.push(sessionNode);

    let sandbox;

    beforeEach(async function () {
        this.timeout(TIMEOUT);
        sandbox = sinon.createSandbox();
    });

    afterEach(async function () {
        this.timeout(TIMEOUT);
        sandbox.restore();
    });

    const oldSettings = vscode.workspace.getConfiguration(globals.SETTINGS_USS_HISTORY);

    after(async () => {
        await vscode.workspace.getConfiguration().update(globals.SETTINGS_USS_HISTORY, oldSettings, vscode.ConfigurationTarget.Global);
    });

    describe("Initialize USS Favorites", async () => {
        it("should still create favorite nodes when given a favorite with invalid profile name", async () => {
            const profileName = testConst.profile.name;
            // Reset testTree's favorites to be empty
            testTree.mFavorites = [];
            // Then, update favorites in settings
            const favorites = [
                `[${profileName}]: /u/tester1{directory}`,
                `[${profileName}]: /u/tester1/testfile1{textfile}`,
                `[badProfileName]: /u/tester1{directory}`,
                `[${profileName}]: /u/tester2{directory}`,
                `[${profileName}]: /u/tester2/testfile2{textfile}`,
            ];
            await vscode.workspace
                .getConfiguration()
                .update(globals.SETTINGS_USS_HISTORY, { persistence: true, favorites }, vscode.ConfigurationTarget.Global);
            await testTree.initializeFavorites(imperative.Logger.getAppLogger());
            const initializedFavProfileLabels = [`${profileName}`, "badProfileName"];
            const goodProfileFavLabels = ["tester1", "testfile1", "tester2", "testfile2"];
            const badProfileFavLabels = ["tester1"];
            // Profile nodes for both valid and invalid profiles should be created in mFavorites. (Error checking happens on expand.)
            expect(testTree.mFavorites.map((favProfileNode) => favProfileNode.label)).to.deep.equal(initializedFavProfileLabels);
            // Favorite item nodes should be created for favorite profile nodes of both valid and valid profiles.
            expect(testTree.mFavorites[0].children.map((node) => node.label)).to.deep.equal(goodProfileFavLabels);
            expect(testTree.mFavorites[1].children.map((node) => node.label)).to.deep.equal(badProfileFavLabels);
        }).timeout(TIMEOUT);
    });
    describe("Rename USS File", async () => {
        const path = testConst.ussPattern;
        const beforeFileName = `${path}/filetest1`;
        const afterFileName = `${path}/filetest1rename`;

        afterEach(async () => {
            await Promise.all(
                [Delete.ussFile(sessionNode.getSession(), beforeFileName), Delete.ussFile(sessionNode.getSession(), afterFileName)].map((p) =>
                    p.catch((err) => err)
                )
            );
        });
        beforeEach(async () => {
            await Create.uss(sessionNode.getSession(), beforeFileName, "file").catch((err) => err);
        });

        it("should rename a uss file", async () => {
            let error;
            let list;
            const beforeNameBase = beforeFileName.split("/").pop();
            const afterNameBase = afterFileName.split("/").pop();

            try {
                const testFolder = new ZoweUSSNode(
                    path,
                    vscode.TreeItemCollapsibleState.Expanded,
                    sessionNode,
                    session,
                    null,
                    false,
                    testProfile.name
                );
                const testNode = new ZoweUSSNode(
                    beforeNameBase,
                    vscode.TreeItemCollapsibleState.None,
                    testFolder,
                    session,
                    testFolder.label as string,
                    false,
                    testProfile.name
                );
                const inputBoxStub = sandbox.stub(vscode.window, "showInputBox");
                inputBoxStub.returns(afterNameBase);

                await testTree.rename(testNode);
                list = await List.fileList(sessionNode.getSession(), path);
                list = list.apiResponse.items ? list.apiResponse.items.map((entry) => entry.name) : [];
            } catch (err) {
                error = err;
            }

            expect(error).to.be.equal(undefined);
            expect(list).not.to.contain(beforeNameBase);
            expect(list).to.contain(afterNameBase);
        }).timeout(TIMEOUT);
    });
});
