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

import * as vscode from "vscode";
import { Gui, ProfilesCache } from "@zowe/zowe-explorer-api";
import { Profiles } from "../../../src/Profiles";
import { TsoCommandHandler } from "../../../src/command/TsoCommandHandler";
import { imperative } from "@zowe/cli";
import { createInstanceOfProfile, createIProfile } from "../../../__mocks__/mockCreators/shared";
import { ZoweLogger } from "../../../src/utils/LoggerUtils";

describe("TsoCommandHandler extended testing", () => {
    // Idea is borrowed from: https://github.com/kulshekhar/ts-jest/blob/master/src/util/testing.ts
    const mocked = <T extends (...args: any[]) => any>(fn: T): jest.Mock<ReturnType<T>> => fn as any;
    const newMocks = {
        imperativeProfile: createIProfile(),
        profileInstance: null,
        mockProfilesCache: new ProfilesCache(imperative.Logger.getAppLogger()),
    };
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: jest.fn() });
    Object.defineProperty(vscode.window, "createOutputChannel", { value: jest.fn() });
    Object.defineProperty(imperative.ProfileInfo, "profAttrsToProfLoaded", { value: () => ({ profile: {} }) });
    newMocks.profileInstance = createInstanceOfProfile(newMocks.imperativeProfile);
    Object.defineProperty(Profiles, "selectTsoProfile", { value: () => "dummy" });
    Object.defineProperty(Profiles, "getInstance", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });
    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn().mockReturnValue(newMocks.profileInstance),
        configurable: true,
    });

    describe("getTsoParams", () => {
        it("should work with teamConfig", async () => {
            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn(() => ({
                    getCliProfileManager: () => null,
                    getProfileInfo: jest.fn().mockReturnValue({
                        usingTeamConfig: true,
                        getAllProfiles: jest.fn().mockReturnValue(["dummy"]),
                        mergeArgsForProfile: jest.fn().mockReturnValue({
                            knownArgs: [{ argName: "account", argValue: "TEST" }],
                        }),
                    } as any),
                })),
            });
            const result = await (TsoCommandHandler.getInstance() as any).getTsoParams();
            expect(result.account).toEqual("TEST");
        });

        it("should work with teamConfig and prompt if account is empty", async () => {
            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        getCliProfileManager: () => null,
                        getProfileInfo: jest.fn().mockReturnValue({
                            usingTeamConfig: true,
                            getAllProfiles: jest.fn().mockReturnValue(["dummy"]),
                            mergeArgsForProfile: jest.fn().mockReturnValue({
                                knownArgs: [{ argName: "account", argValue: "" }],
                            }),
                        } as any),
                    };
                }),
            });
            const spyBox = jest.spyOn(Gui, "showInputBox").mockResolvedValue("TEST1");

            const result = await (TsoCommandHandler.getInstance() as any).getTsoParams();
            expect(spyBox).toHaveBeenCalled();
            expect(result.account).toEqual("TEST1");
        });
    });
});
