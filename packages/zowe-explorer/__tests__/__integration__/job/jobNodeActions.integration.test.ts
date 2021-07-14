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
import { IProfileLoaded, Session, SessConstants } from "@zowe/imperative";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as sinon from "sinon";
import * as testConst from "../../../resources/testProfileData";
import * as vscode from "vscode";
import { ZosJobsProvider } from "../../../src/job/ZosJobsProvider";
import * as jobActions from "../../../src/job/actions";
import * as refreshActions from "../../../src/shared/refresh";
import { Job } from "../../../src/job/ZoweJobNode";
import { JOBS_SESSION_CONTEXT } from "../../../src/globals";

const TIMEOUT = 45000;
declare var it: Mocha.ITestDefinition;
// declare var describe: any;

const testProfile: IProfileLoaded = {
    name: testConst.profile.name,
    profile: testConst.profile,
    type: testConst.profile.type,
    message: "",
    failNotFound: false,
};

describe("jobNodeActions integration test", async () => {
    const expect = chai.expect;
    chai.use(chaiAsPromised);

    const session = new Session({
        type: SessConstants.AUTH_TYPE_BASIC,
        hostname: testConst.profile.host,
        port: testConst.profile.port,
        user: testConst.profile.user,
        password: testConst.profile.password,
        rejectUnauthorized: testConst.profile.rejectUnauthorized,
    });
    const sessionNode = new Job(
        testConst.profile.name,
        vscode.TreeItemCollapsibleState.Collapsed,
        null,
        session,
        null,
        null
    );
    sessionNode.contextValue = JOBS_SESSION_CONTEXT;
    const testTree = new ZosJobsProvider();
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

    const oldSettings = vscode.workspace.getConfiguration("Zowe-DS-Persistent");

    after(async () => {
        await vscode.workspace
            .getConfiguration()
            .update("Zowe-DS-Persistent", oldSettings, vscode.ConfigurationTarget.Global);
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
