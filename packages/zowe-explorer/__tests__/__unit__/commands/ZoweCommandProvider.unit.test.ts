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
import { Gui, imperative, ProfilesCache, ZoweTreeNode } from "@zowe/zowe-explorer-api";
import { createIProfile, createISession } from "../../__mocks__/mockCreators/shared";
import { ZoweCommandProvider } from "../../../src/commands/ZoweCommandProvider";
import { Profiles } from "../../../src/configuration/Profiles";
import { ZoweDatasetNode } from "../../../src/trees/dataset/ZoweDatasetNode";
import { SharedContext } from "../../../src/trees/shared/SharedContext";
import { createIJobFile } from "../../__mocks__/mockCreators/jobs";
import { ZoweLogger } from "../../../src/tools/ZoweLogger";
import { SettingsConfig } from "../../../src/configuration/SettingsConfig";
import { Constants } from "../../../src/configuration/Constants";

vi.mock("../../../src/tools/ZoweLocalStorage");

const globalMocks = {
    testSession: createISession(),
    testProfile: createIProfile(),
    mockIJobFile: createIJobFile(),
};
describe("ZoweCommandProvider Unit Tests", () => {
    describe("function refreshElement", () => {
        it("should refresh the tree data", () => {
            const testNode = new (ZoweTreeNode as any)("test", vscode.TreeItemCollapsibleState.None, undefined);
            Object.defineProperty(ZoweCommandProvider.prototype, "mOnDidChangeTreeData", {
                value: {
                    fire: vi.fn(),
                },
                configurable: true,
            });
            expect(ZoweCommandProvider.prototype.refreshElement(testNode)).toEqual(undefined);
        });
    });
    describe("function checkCurrentProfile", () => {
        const testNode: any = new ZoweDatasetNode({
            label: "test",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: globalMocks.testSession,
        });
        testNode.setProfileToChoice(globalMocks.testProfile);
        testNode.contextValue = "session server";

        beforeEach(async () => {
            vi.spyOn(ProfilesCache.prototype, "refresh").mockImplementation((() => undefined) as any);
            const profilesInstance = await Profiles.createInstance(undefined as any);
            Object.defineProperty(profilesInstance, "log", {
                value: {
                    error: vi.fn(),
                },
            });
            vi.spyOn(ZoweCommandProvider.prototype, "refresh").mockImplementationOnce(() => {});
            vi.spyOn(SharedContext, "isSessionNotFav").mockReturnValue(true);
        });
        it("should check current profile and perform the case when status is 'active'", async () => {
            vi.spyOn(SettingsConfig, "getDirectValue").mockReturnValueOnce(true);
            const profileStatus = { name: "test", status: "active" };
            vi.spyOn(Profiles, "getInstance").mockReturnValue({
                checkCurrentProfile: vi.fn().mockResolvedValue(profileStatus),
                loadNamedProfile: vi.fn().mockReturnValue(globalMocks.testProfile),
            } as any);
            await expect(ZoweCommandProvider.prototype.checkCurrentProfile(testNode)).resolves.toEqual(profileStatus);
        });
        it("should check current profile and perform the case when status is 'unverified'", async () => {
            vi.spyOn(SettingsConfig, "getDirectValue").mockReturnValueOnce(true);
            const profileStatus = { name: "test", status: "unverified" };
            vi.spyOn(Profiles, "getInstance").mockReturnValue({
                checkCurrentProfile: vi.fn().mockResolvedValue(profileStatus),
                loadNamedProfile: vi.fn().mockReturnValue(globalMocks.testProfile),
            } as any);

            await expect(ZoweCommandProvider.prototype.checkCurrentProfile(testNode)).resolves.toEqual(profileStatus);
        });
        it("should check current profile and perform the case when status is 'inactive'", async () => {
            vi.spyOn(SettingsConfig, "getDirectValue").mockReturnValueOnce(true);
            Object.defineProperty(ZoweCommandProvider, "mOnDidChangeTreeData", {
                value: {
                    debug: vi.fn(),
                },
                configurable: true,
            });
            const profileStatus = { name: "test", status: "inactive" };
            vi.spyOn(Profiles, "getInstance").mockReturnValue({
                checkCurrentProfile: vi.fn().mockResolvedValue(profileStatus),
                loadNamedProfile: vi.fn().mockReturnValue(globalMocks.testProfile),
                showProfileInactiveMsg: vi.fn(),
            } as any);
            const profileInactive = vi.spyOn(Profiles.getInstance(), "showProfileInactiveMsg");
            await expect(ZoweCommandProvider.prototype.checkCurrentProfile(testNode)).resolves.toEqual(profileStatus);
            expect(profileInactive).toHaveBeenCalledWith(globalMocks.testProfile.name);
        });
    });

    describe("integrated terminals", () => {
        beforeEach(() => {
            // Simulate that the setting is enabled : )
            vi.spyOn(SettingsConfig, "getDirectValue").mockImplementation(
                (setting) => setting === Constants.SETTINGS_COMMANDS_INTEGRATED_TERMINALS
            );
        });

        describe("function issueCommand", () => {
            const testError = new imperative.ImperativeError({
                msg: "test-msg",
                causeErrors: "test-causeErrors",
                additionalDetails: "test-additionalDetails",
            });
            const mockCmdProvider: any = {
                useIntegratedTerminals: true,
                terminalName: "test-terminal",
                pseudoTerminal: {},
                formatCommandLine: (cmd: string) => "test-" + cmd,
                history: { getSearchHistory: () => ["old-cmd-01", "old-cmd-02"], addSearchHistory: vi.fn() },
                runCommand: vi.fn().mockRejectedValue(testError),
            };
            const testProfile: any = { name: "test", profile: { user: "firstName", password: "12345" } };
            const showInformationMessage = vi.fn();
            Object.defineProperty(vscode.window, "showInformationMessage", { value: showInformationMessage });

            it("should not create a terminal if the profile or the command is undefined", async () => {
                const createTerminal = vi.fn().mockReturnValue({ show: vi.fn() });
                Object.defineProperty(vscode.window, "createTerminal", { value: createTerminal, configurable: true });
                await ZoweCommandProvider.prototype.issueCommand.call(mockCmdProvider, null, "test");
                await ZoweCommandProvider.prototype.issueCommand.call(mockCmdProvider, undefined, "test");
                await ZoweCommandProvider.prototype.issueCommand.call(mockCmdProvider, testProfile, null);
                await ZoweCommandProvider.prototype.issueCommand.call(mockCmdProvider, testProfile, undefined);
                expect(createTerminal).not.toHaveBeenCalled();
            });

            it("should not create a terminal if user escapes the input box and useIntegratedTerminals is false", async () => {
                vi.spyOn(SettingsConfig, "getDirectValue").mockImplementation(
                    (setting) => setting !== Constants.SETTINGS_COMMANDS_INTEGRATED_TERMINALS
                );
                const createTerminal = vi.fn().mockReturnValue({ show: vi.fn() });
                Object.defineProperty(vscode.window, "createTerminal", { value: createTerminal, configurable: true });
                await ZoweCommandProvider.prototype.issueCommand.call(mockCmdProvider, testProfile, "");
                expect(createTerminal).not.toHaveBeenCalled();
                expect(showInformationMessage.mock.calls.length).toBe(1);
            });

            it("should create an integrated terminal", async () => {
                const createTerminal = vi.fn().mockReturnValue({ show: vi.fn() });
                Object.defineProperty(vscode.window, "createTerminal", { value: createTerminal, configurable: true });

                await ZoweCommandProvider.prototype.issueCommand.call(mockCmdProvider, testProfile, "test");
                expect(createTerminal).toHaveBeenCalled();

                // Test errorHandling on callback
                const pty = createTerminal.mock.calls[0][0].pty;
                const errorOutput = await pty.processCmd();

                expect(errorOutput).toContain("Unable to perform this operation due to the following problem.");
                expect(errorOutput).toContain("test-msg");
                expect(errorOutput).toContain("Response From Service");
                expect(errorOutput).toContain("test-causeErrors");
                expect(errorOutput).toContain("Diagnostic Information");
                expect(errorOutput).toContain("test-additionalDetails");
            });
        });

        describe("function selectServiceProfile", () => {
            it("should select the specified profile", async () => {
                const mockCmdProvider: any = {
                    dialogs: { selectProfile: "select profile" },
                };

                vi.spyOn(Gui, "showQuickPick").mockResolvedValue("prof02" as any);
                const selected = await ZoweCommandProvider.prototype.selectServiceProfile.call(
                    mockCmdProvider,
                    [{ name: "prof01" }, { name: "prof02" }],
                    "test"
                );

                expect(selected).toEqual({ name: "prof02" });
            });
            it("should handle operation cancelled", async () => {
                const mockCmdProvider: any = {
                    dialogs: { selectProfile: "select profile" },
                    operationCancelled: "Operation cancelled",
                };

                vi.spyOn(Gui, "showQuickPick").mockResolvedValue(undefined);
                const spyMessage = vi.spyOn(ZoweLogger, "info").mockImplementation(vi.fn());
                const selected = await ZoweCommandProvider.prototype.selectServiceProfile.call(
                    mockCmdProvider,
                    [{ name: "prof01" }, { name: "prof02" }],
                    "test"
                );

                expect(spyMessage).toHaveBeenCalledWith(mockCmdProvider.operationCancelled);
                expect(selected).toBeUndefined();
            });
        });
    });
});
