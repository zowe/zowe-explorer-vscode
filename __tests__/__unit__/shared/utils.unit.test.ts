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

import { ZoweUSSNode } from "../../../src/uss/ZoweUSSNode";
import * as vscode from "vscode";
import { Session, IProfileLoaded, Logger } from "@zowe/imperative";
import * as sharedUtils from "../../../src/shared/utils";
import { Profiles } from "../../../src/Profiles";

const session = new Session({
    user: "fake",
    password: "fake",
    hostname: "fake",
    protocol: "https",
    type: "basic",
});
const profileOne: IProfileLoaded = {
    name: "aProfile",
    profile: {},
    type: "zosmf",
    message: "",
    failNotFound: false
};

const mockLoadNamedProfile = jest.fn();

Profiles.createInstance(Logger.getAppLogger());

describe("Shared Utils Unit Tests - Function node.labelHack()", () => {
    mockLoadNamedProfile.mockReturnValue(profileOne);

    beforeEach(() => {
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName"}, {name: "secondName"}],
                    getDefaultProfile: {name: "firstName"},
                    loadNamedProfile: mockLoadNamedProfile
                };
            })
        });
    });

    afterAll(() => {
        jest.clearAllMocks();
    });

    it("Checks that labelHack subtly alters the label", async () => {
        const rootNode = new ZoweUSSNode(
            "gappy", vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, profileOne.name, undefined);
        expect(rootNode.label === "gappy");
        sharedUtils.labelHack(rootNode);
        expect(rootNode.label === "gappy ");
        sharedUtils.labelHack(rootNode);
        expect(rootNode.label === "gappy");
    });
});
