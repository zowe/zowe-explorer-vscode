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

import { imperative, ZosmfSession } from "@zowe/cli";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as sinon from "sinon";
import * as testConst from "../../../resources/testProfileData";
import * as vscode from "vscode";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import { DatasetTree } from "../../../src/dataset/DatasetTree";
import * as refreshActions from "../../../src/shared/refresh";
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

describe("dsNodeActions integration test", async () => {
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
    const sessionNode = new ZoweDatasetNode(
        testConst.profile.name,
        vscode.TreeItemCollapsibleState.Collapsed,
        null,
        session,
        undefined,
        undefined,
        testProfile
    );
    sessionNode.contextValue = globals.DS_SESSION_CONTEXT;
    const pattern = testConst.normalPattern.toUpperCase();
    sessionNode.pattern = pattern;
    const testTree = new DatasetTree();
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

    const oldSettings = vscode.workspace.getConfiguration(globals.SETTINGS_DS_HISTORY);

    after(async () => {
        await vscode.workspace.getConfiguration().update(globals.SETTINGS_DS_HISTORY, oldSettings, vscode.ConfigurationTarget.Global);
    });

    describe("Refresh ALL", async () => {
        it("It should call the RefreshALL function", async () => {
            let eventFired = false;

            const listener = () => {
                eventFired = true;
            };

            const subscription = testTree.mOnDidChangeTreeData.event(listener);
            await refreshActions.refreshAll(testTree);

            expect(eventFired).equals(true);
            // expect(eventFired).toBe(true);

            subscription.dispose();
        }).timeout(TIMEOUT);
    });
});
