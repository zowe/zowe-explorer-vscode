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
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as sinon from "sinon";
import * as testConst from "../../../resources/testProfileData";
import * as vscode from "vscode";
import { ZosJobsProvider } from "../../../src/job/ZosJobsProvider";
import * as refreshActions from "../../../src/shared/refresh";
import { Job } from "../../../src/job/ZoweJobNode";
import { DS_SESSION_CONTEXT, JOBS_SESSION_CONTEXT } from "../../../src/globals";
import { DatasetTree } from "../../../src/dataset/DatasetTree";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import { createInstanceOfProfile } from "../../../__mocks__/mockCreators/shared";

const TIMEOUT = 45000;
declare var it: Mocha.ITestDefinition;

describe("jobNodeActions integration test", async () => {
    const expect = chai.expect;
    chai.use(chaiAsPromised);

    const session = zowe.ZosmfSession.createBasicZosmfSession(testConst.profile);
    const testProfileLoaded: IProfileLoaded = {
        name: testConst.profile.name,
        profile: testConst.profile,
        type: testConst.profile.type,
        message: "",
        failNotFound: false,
    };

    // Test Jobs session node & tree
    const jobSessionNode = new Job(
        testConst.profile.name,
        vscode.TreeItemCollapsibleState.Collapsed,
        null,
        session,
        null,
        null
    );
    jobSessionNode.contextValue = JOBS_SESSION_CONTEXT;
    const testJobsTree = new ZosJobsProvider();
    testJobsTree.mSessionNodes.push(jobSessionNode);

    // Test Dataset session node & tree
    const datasetSessionNode = new ZoweDatasetNode(
        testConst.profile.name,
        vscode.TreeItemCollapsibleState.Collapsed,
        null,
        session,
        undefined,
        undefined,
        testProfileLoaded
    );
    datasetSessionNode.contextValue = DS_SESSION_CONTEXT;
    const pattern = testConst.normalPattern.toUpperCase();
    datasetSessionNode.pattern = pattern;
    const testDatasetTree = new DatasetTree();
    testDatasetTree.mSessionNodes.push(datasetSessionNode);

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

    describe("refreshAll", async () => {
        it("It should call the refreshAll function on a Jobs tree", async () => {
            let eventFired = false;

            const listener = () => {
                eventFired = true;
            };

            const subscription = testJobsTree.mOnDidChangeTreeData.event(listener);
            await refreshActions.refreshAll(testJobsTree);

            expect(eventFired).equals(true);

            subscription.dispose();
        }).timeout(TIMEOUT);
    });

    describe("refreshAll", async () => {
        it("It should call the refreshAll function on a Dataset tree", async () => {
            let eventFired = false;

            const listener = () => {
                eventFired = true;
            };

            const subscription = testDatasetTree.mOnDidChangeTreeData.event(listener);
            await refreshActions.refreshAll(testDatasetTree);

            expect(eventFired).equals(true);

            subscription.dispose();
        }).timeout(TIMEOUT);
    });
});
