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
import * as sinon from "sinon";
import * as vscode from "vscode";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as testConst from "../../../resources/testProfileData";

import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import { TsoCommandHandler } from "../../../src/command/TsoCommandHandler";

const TIMEOUT = 45000;
declare let it: Mocha.TestFunction;

describe("tsoCommands integration test", async () => {
    const testProfile: imperative.IProfileLoaded = {
        name: testConst.profile.name,
        profile: testConst.profile,
        type: testConst.profile.type,
        message: "",
        failNotFound: false,
    };
    const tsoProfile = testConst.tsoProfile;

    const expect = chai.expect;
    chai.use(chaiAsPromised);
    const TEST_CMD = "/PROFILE";
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
    const testNode = new ZoweDatasetNode("BRTVS99.DDIR", vscode.TreeItemCollapsibleState.Collapsed, null, session, undefined, undefined, testProfile);

    let sandbox;

    beforeEach(async function () {
        this.timeout(TIMEOUT);
        sandbox = sinon.createSandbox();
    });

    afterEach(async function () {
        this.timeout(TIMEOUT);
        sandbox.restore();
    });

    describe("Submit an TSO command", async () => {
        it("should submit a command", async () => {
            const stubresolve = sandbox.stub(vscode.window, "showQuickPick");
            stubresolve.returns(tsoProfile);
            const spy = sandbox.spy(vscode.window, "createOutputChannel");
            await TsoCommandHandler.getInstance().issueTsoCommand(session, TEST_CMD, testNode);

            const gotCalled = spy.calledWith("Zowe TSO Command");
            expect(gotCalled).to.equal(true);
        }).timeout(TIMEOUT);
    });
});
