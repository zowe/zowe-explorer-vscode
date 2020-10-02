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

// import { Profiles } from "../../../src/Profiles";
import { DefaultProfileManager } from "../../../src/profiles/DefaultProfileManager";
import { createProfileManager } from "../../../__mocks__/mockCreators/profiles";
import { createISession, createISessionWithoutCredentials,
         createValidBaseProfile, createValidIProfile } from "../../../__mocks__/mockCreators/shared";
import { Logger, ConnectionPropsForSessCfg } from "@zowe/imperative";
import * as globals from "../../../src/globals";
import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import * as profileUtils from "../../../src/profiles/utils";

jest.mock("@zowe/imperative");

describe("Profiles Utils Unit Tests - Function validateHostInput", () => {
    it("Tests that validateHostInput succeeds with a host and port", async () => {
        const inputString = "https://www.test.com:123";

        const returnValue = await profileUtils.validateHostInput(inputString, "");

        expect(returnValue).toEqual(null);
    });

    it("Tests that validateHostInput succeeds with optional host and port", async () => {
        const inputString = "https://";

        const returnValue = await profileUtils.validateHostInput(inputString, "");

        expect(returnValue).toEqual(null);
    });

    it("Tests that validateHostInput returns an error message if the inputString is undefined", async () => {
        const inputString = undefined;

        const returnValue = await profileUtils.validateHostInput(inputString, "");

        expect(returnValue).toEqual("Please enter a valid host URL in the format 'url:port'.");
    });
});
