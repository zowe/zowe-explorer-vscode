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

import * as zowe from "@zowe/cli";
import * as imperative from "@zowe/imperative";
import * as sinon from "sinon";
import * as vscode from "vscode";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as testConst from "../../../resources/testProfileData";

import { MvsCommandHandler } from "../../../src/command/MvsCommandHandler";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";

const TIMEOUT = 45000;
declare var it: Mocha.TestFunction;

describe("mvsCommands integration test", async () => {
    const testProfile: imperative.IProfileLoaded = {
        name: testConst.profile.name,
        profile: testConst.profile,
        type: testConst.profile.type,
        message: "",
        failNotFound: false,
    };

    const expect = chai.expect;
    chai.use(chaiAsPromised);
    const TEST_CMD = "/D T";
    const session = zowe.ZosmfSession.createBasicZosmfSession(testConst.profile);
    const testNode = new ZoweDatasetNode(
        "BRTVS99.DDIR",
        vscode.TreeItemCollapsibleState.Collapsed,
        null,
        session,
        undefined,
        undefined,
        testProfile
    );

    let sandbox;

    beforeEach(async function () {
        this.timeout(TIMEOUT);
        sandbox = sinon.createSandbox();
    });

    afterEach(async function () {
        this.timeout(TIMEOUT);
        sandbox.restore();
    });

    describe("Submit an MVS command", async () => {
        it("should submit a command", async () => {
            const spy = sandbox.spy(vscode.window, "createOutputChannel");
            await MvsCommandHandler.getInstance().issueMvsCommand(session, TEST_CMD, testNode);
            const gotCalled = spy.calledWith("Zowe MVS Command");
            expect(gotCalled).to.equal(true);
        }).timeout(TIMEOUT);
    });
});
