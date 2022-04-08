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

import * as vscode from "vscode";
import { ProfilesCache, ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import { Profiles } from "../../../src/Profiles";
import { TsoCommandHandler } from "../../../src/command/TsoCommandHandler";
import { ProfileInfo } from "@zowe/imperative";
import * as globals from "../../../src/globals";

describe("TsoCommandHandler extended testing", () => {
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: jest.fn() });
    Object.defineProperty(vscode.window, "createOutputChannel", { value: jest.fn() });
    Object.defineProperty(ProfileInfo, "profAttrsToProfLoaded", { value: () => ({ profile: {} }) });
    Object.defineProperty(Profiles, "selectTsoProfile", { value: () => "dummy" });

    describe("getTsoParms", () => {
        it("should work with teamConfig", async () => {
            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn(() => ({ getCliProfileManager: () => null })),
            });

            jest.spyOn(globals.PROFILESCACHE, "getProfileInfo").mockReturnValue({
                usingTeamConfig: true,
                getAllProfiles: jest.fn().mockReturnValue(["dummy"]),
                mergeArgsForProfile: jest.fn().mockReturnValue({
                    knownArgs: [{ argName: "account", argValue: "TEST" }],
                }),
            } as any);

            const result = await (TsoCommandHandler.getInstance() as any).getTsoParams();
            expect(result.account).toEqual("TEST");
        });

        it("should work with teamConfig and prompt if account is empty", async () => {
            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn(() => ({ getCliProfileManager: () => null })),
            });

            jest.spyOn(globals.PROFILESCACHE, "getProfileInfo").mockReturnValue({
                usingTeamConfig: true,
                getAllProfiles: jest.fn().mockReturnValue(["dummy"]),
                mergeArgsForProfile: jest.fn().mockReturnValue({
                    knownArgs: [{ argName: "account", argValue: "" }],
                }),
            } as any);

            const spyBox = jest.spyOn(ZoweVsCodeExtension, "inputBox").mockResolvedValue("TEST1");

            const result = await (TsoCommandHandler.getInstance() as any).getTsoParams();
            expect(spyBox).toHaveBeenCalled();
            expect(result.account).toEqual("TEST1");
        });
    });
});
