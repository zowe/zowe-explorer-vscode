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

import * as sinon from "sinon";
import * as vscode from "vscode";
import { imperative } from "@zowe/cli";
import { Profiles } from "../../src/Profiles";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as testConst from "../../resources/testProfileData";

declare let it: Mocha.TestFunction;
const TIMEOUT = 45000;

const testProfile: imperative.IProfile = {
    type: "zosmf",
    host: "testHost",
    port: 1443,
    user: "testUser",
    password: "testPass",
    rejectUnauthorized: false,
    name: "testProfileIntegration", // @NOTE: This profile name must match an existing zowe profile in the ~/.zowe/profiles/zosmf folder
};

const testProfileLoaded: imperative.IProfileLoaded = {
    name: testConst.profile.name,
    profile: testConst.profile,
    type: testConst.profile.type,
    message: "",
    failNotFound: false,
};

describe("Create profiles integration tests", async () => {
    const expect = chai.expect;
    chai.use(chaiAsPromised);
    const profiles = Profiles.getInstance();
    let sandbox;

    beforeEach(async function () {
        this.timeout(TIMEOUT);
        sandbox = sinon.createSandbox();
    });

    afterEach(async function () {
        this.timeout(TIMEOUT);
        sandbox.restore();
    });

    it("Tests if profile is created successfully", async () => {
        const getProfType = sandbox.stub(profiles, "getProfileType");
        getProfType.returns("zosmf");
        const getUrlStub = sandbox.stub(profiles, "urlInfo");
        getUrlStub.returns({
            valid: true,
            protocol: "https",
            host: "testurl.com",
            port: 1001,
        });
        const showInputStub = sandbox.stub(vscode.window, "showInputBox");
        const returnVals = ["testUser", "testPass", "basePath", "encoding", "timeOut"];
        returnVals.forEach((value, index) => {
            showInputStub.onCall(index).returns(value);
        });
        const showQuickPickStub = sandbox.stub(vscode.window, "showQuickPick");
        showQuickPickStub.returns("True - Reject connections with self-signed certificates");
        const saveProfileStub = sandbox.stub(profiles, "saveProfile");
        saveProfileStub.returns(testProfile);

        const response = await profiles.createNewConnection("testProfileIntegration");
        expect(response).to.deep.equal("testProfileIntegration");
    }).timeout(TIMEOUT);

    it("Tests if operation is cancelled when URL input is empty", async () => {
        const showInfoSpy = sandbox.spy(vscode.window, "showInformationMessage");
        const getProfType = sandbox.stub(profiles, "getProfileType");
        getProfType.returns("zosmf");
        const getUrlStub = sandbox.stub(profiles, "urlInfo");
        getUrlStub.returns(undefined);

        const response = await profiles.createNewConnection("testProfileIntegration");
        expect(response).to.equal(undefined);
        const messageSent = showInfoSpy.calledWith("No valid value for z/OS URL. Operation Cancelled");
        expect(messageSent).to.equal(true);
    }).timeout(TIMEOUT);

    it("Tests if operation is cancelled when username input is empty", async () => {
        const showInfoSpy = sandbox.spy(vscode.window, "showInformationMessage");
        const getProfType = sandbox.stub(profiles, "getProfileType");
        getProfType.returns("zosmf");
        const getUrlStub = sandbox.stub(profiles, "urlInfo");
        getUrlStub.returns({
            valid: true,
            protocol: "https",
            host: "testurl.com",
            port: 1001,
        });
        const showInputStub = sandbox.stub(vscode.window, "showInputBox");
        showInputStub.returns(undefined);

        const response = await profiles.createNewConnection("testProfileIntegration");
        expect(response).to.equal(undefined);
        const messageSent = showInfoSpy.calledWith("Operation Cancelled");
        expect(messageSent).to.equal(true);
    }).timeout(TIMEOUT);

    it("Tests if operation is cancelled when password input is empty", async () => {
        const showInfoSpy = sandbox.spy(vscode.window, "showInformationMessage");
        const getProfType = sandbox.stub(profiles, "getProfileType");
        getProfType.returns("zosmf");
        const getUrlStub = sandbox.stub(profiles, "urlInfo");
        getUrlStub.returns({
            valid: true,
            protocol: "https",
            host: "testurl.com",
            port: 1001,
        });
        const showInputStub = sandbox.stub(vscode.window, "showInputBox");
        showInputStub.onCall(0).returns("testUser");
        showInputStub.onCall(1).returns(undefined);

        const response = await profiles.createNewConnection("testProfileIntegration");
        expect(response).to.equal(undefined);
        const messageSent = showInfoSpy.calledWith("Operation Cancelled");
        expect(messageSent).to.equal(true);
    }).timeout(TIMEOUT);

    it("Tests if operation is cancelled when rejectUnauthorized input is empty", async () => {
        const showInfoSpy = sandbox.spy(vscode.window, "showInformationMessage");
        const getProfType = sandbox.stub(profiles, "getProfileType");
        getProfType.returns("zosmf");
        const getUrlStub = sandbox.stub(profiles, "urlInfo");
        getUrlStub.returns({
            valid: true,
            protocol: "https",
            host: "testurl.com",
            port: 1001,
        });
        const showInputStub = sandbox.stub(vscode.window, "showInputBox");
        showInputStub.onCall(0).returns("testUser");
        showInputStub.onCall(1).returns("testPass");
        const showQuickPickStub = sandbox.stub(vscode.window, "showQuickPick");
        showQuickPickStub.returns(undefined);

        const response = await profiles.createNewConnection("testProfileIntegration");
        expect(response).to.equal(undefined);
        const messageSent = showInfoSpy.calledWith("Operation Cancelled");
        expect(messageSent).to.equal(true);
    }).timeout(TIMEOUT);

    it("Tests if operation is cancelled when username is already taken", async () => {
        const showErrorSpy = sandbox.spy(vscode.window, "showErrorMessage");
        await profiles.allProfiles.push(testProfileLoaded);
        const getProfType = sandbox.stub(profiles, "getProfileType");
        getProfType.returns("zosmf");
        const getUrlStub = sandbox.stub(profiles, "urlInfo");
        getUrlStub.returns({
            valid: true,
            protocol: "https",
            host: "testurl.com",
            port: 1001,
        });
        const showInputStub = sandbox.stub(vscode.window, "showInputBox");
        const returnVals = ["testUser", "testPass", "basePath", "encoding", "timeOut"];
        returnVals.forEach((value, index) => {
            showInputStub.onCall(index).returns(value);
        });
        const showQuickPickStub = sandbox.stub(vscode.window, "showQuickPick");
        showQuickPickStub.returns("True - Reject connections with self-signed certificates");

        const response = await profiles.createNewConnection(testConst.profile.name);
        expect(response).to.equal(undefined);
        const messageSent = showErrorSpy.calledWith("Profile name already exists. Please create a profile using a different name");
        expect(messageSent).to.equal(true);
    }).timeout(TIMEOUT);
});
