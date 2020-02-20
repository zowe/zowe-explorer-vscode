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
import * as sinon from "sinon";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as testConst from "../../../resources/testProfileData";
import * as vscode from "vscode";

import { MvsCommandHandler } from "../../../src/command/MvsCommandHandler";


describe("mvsCommands integration test", async () => {
    const expect = chai.expect;
    chai.use(chaiAsPromised);
    const TEST_CMD = "/d iplinfo";
    const session = zowe.ZosmfSession.createBasicZosmfSession(testConst.profile);

    let sandbox;

    beforeEach(async () => {
        sandbox = sinon.createSandbox();
    });

    afterEach(async () => {
        sandbox.restore();
    });

    describe("Submit an MVS command", async () => {
        it("should submit a command", async () => {
            const spy = sandbox.spy( zowe.IssueCommand, "issueSimple");
            MvsCommandHandler.getInstance().issueMvsCommand(session, TEST_CMD);
            expect(spy.called).to.equal(true);
            expect(spy.args[0][1]).to.equal("d iplinfo");
        });
    });
});
