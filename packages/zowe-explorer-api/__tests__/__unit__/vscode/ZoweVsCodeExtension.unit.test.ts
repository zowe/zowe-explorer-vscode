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
import { Gui } from "../../../src/globals/Gui";
import { IPromptCredentialsOptions, ZoweVsCodeExtension } from "../../../src/vscode";

describe("ZoweVsCodeExtension", () => {
    const fakeVsce: any = {
        exports: "zowe",
        packageJSON: { version: "1.0.1" },
    };

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("getZoweExplorerApi", () => {
        it("should return client API", () => {
            jest.spyOn(vscode.extensions, "getExtension").mockReturnValueOnce(fakeVsce);
            const zeApi = ZoweVsCodeExtension.getZoweExplorerApi();
            expect(zeApi).toBe(fakeVsce.exports);
        });

        it("should return API if required version matches", () => {
            jest.spyOn(vscode.extensions, "getExtension").mockReturnValueOnce(fakeVsce);
            const zeApi = ZoweVsCodeExtension.getZoweExplorerApi("1.0.0");
            expect(zeApi).toBe(fakeVsce.exports);
        });

        it("should return API if required version is invalid", () => {
            jest.spyOn(vscode.extensions, "getExtension").mockReturnValueOnce(fakeVsce);
            const zeApi = ZoweVsCodeExtension.getZoweExplorerApi("test");
            expect(zeApi).toBe(fakeVsce.exports);
        });

        it("should return API if extension version is unknown", () => {
            const vsceWithoutVersion: any = {
                exports: fakeVsce.exports,
                packageJSON: {},
            };
            jest.spyOn(vscode.extensions, "getExtension").mockReturnValueOnce(vsceWithoutVersion);
            const zeApi = ZoweVsCodeExtension.getZoweExplorerApi("1.0.0");
            expect(zeApi).toBe(fakeVsce.exports);
        });

        it("should not return API if extension is not installed", () => {
            jest.spyOn(vscode.extensions, "getExtension").mockReturnValueOnce(undefined);
            const zeApi = ZoweVsCodeExtension.getZoweExplorerApi();
            expect(zeApi).toBeUndefined();
        });

        it("should not return API if there are no exports", () => {
            const vsceWithoutExports: any = { packageJSON: fakeVsce.packageJSON };
            jest.spyOn(vscode.extensions, "getExtension").mockReturnValueOnce(vsceWithoutExports);
            const zeApi = ZoweVsCodeExtension.getZoweExplorerApi();
            expect(zeApi).toBeUndefined();
        });

        it("should not return API if required version does not match", () => {
            jest.spyOn(vscode.extensions, "getExtension").mockReturnValueOnce(fakeVsce);
            const zeApi = ZoweVsCodeExtension.getZoweExplorerApi("1.0.2");
            expect(zeApi).toBeUndefined();
        });
    });

    describe("updateCredentials", () => {
        const promptCredsOptions: IPromptCredentialsOptions = {
            sessionName: "test",
        };

        it("should update user and password as secure fields", async () => {
            const mockUpdateProperty = jest.fn();
            jest.spyOn(ZoweVsCodeExtension as any, "profilesCache", "get").mockReturnValue({
                getLoadedProfConfig: jest.fn().mockReturnValue({
                    profile: {},
                }),
                getProfileInfo: jest.fn().mockReturnValue({
                    isSecured: jest.fn().mockReturnValue(true),
                    updateProperty: mockUpdateProperty,
                }),
                refresh: jest.fn(),
            });
            const showInputBoxSpy = jest.spyOn(Gui, "showInputBox").mockResolvedValueOnce("fakeUser").mockResolvedValueOnce("fakePassword");
            const saveCredentialsSpy = jest.spyOn(ZoweVsCodeExtension as any, "saveCredentials");
            const profileLoaded: any = await ZoweVsCodeExtension.updateCredentials(promptCredsOptions, undefined as any);
            expect(profileLoaded.profile.user).toBe("fakeUser");
            expect(profileLoaded.profile.password).toBe("fakePassword");
            expect(showInputBoxSpy).toHaveBeenCalledTimes(2);
            expect(saveCredentialsSpy).toHaveBeenCalledTimes(0);
            expect(mockUpdateProperty).toHaveBeenCalledTimes(2);
        });

        it("should update user and password as secure fields with reprompt", async () => {
            const mockUpdateProperty = jest.fn();
            jest.spyOn(ZoweVsCodeExtension as any, "profilesCache", "get").mockReturnValue({
                getLoadedProfConfig: jest.fn().mockReturnValue({
                    profile: { user: "badUser", password: "badPassword" },
                }),
                getProfileInfo: jest.fn().mockReturnValue({
                    isSecured: jest.fn().mockReturnValue(true),
                    updateProperty: mockUpdateProperty,
                }),
                refresh: jest.fn(),
            });
            const showInputBoxSpy = jest.spyOn(Gui, "showInputBox").mockResolvedValueOnce("fakeUser").mockResolvedValueOnce("fakePassword");
            const saveCredentialsSpy = jest.spyOn(ZoweVsCodeExtension as any, "saveCredentials");
            const profileLoaded: any = await ZoweVsCodeExtension.updateCredentials(
                {
                    ...promptCredsOptions,
                    rePrompt: true,
                },
                undefined as any
            );
            expect(profileLoaded.profile.user).toBe("fakeUser");
            expect(profileLoaded.profile.password).toBe("fakePassword");
            expect(showInputBoxSpy).toHaveBeenCalledTimes(2);
            expect(saveCredentialsSpy).toHaveBeenCalledTimes(0);
            expect(mockUpdateProperty).toHaveBeenCalledTimes(2);
        });

        it("should update user and password as plain text if prompt accepted", async () => {
            const mockUpdateProperty = jest.fn();
            jest.spyOn(ZoweVsCodeExtension as any, "profilesCache", "get").mockReturnValue({
                getLoadedProfConfig: jest.fn().mockReturnValue({
                    profile: {},
                }),
                getProfileInfo: jest.fn().mockReturnValue({
                    isSecured: jest.fn().mockReturnValue(false),
                    updateProperty: mockUpdateProperty,
                }),
                refresh: jest.fn(),
            });
            const showInputBoxSpy = jest.spyOn(Gui, "showInputBox").mockResolvedValueOnce("fakeUser").mockResolvedValueOnce("fakePassword");
            jest.spyOn(Gui, "showMessage").mockResolvedValueOnce("yes");
            const saveCredentialsSpy = jest.spyOn(ZoweVsCodeExtension as any, "saveCredentials");
            const profileLoaded: any = await ZoweVsCodeExtension.updateCredentials(promptCredsOptions, undefined as any);
            expect(profileLoaded.profile.user).toBe("fakeUser");
            expect(profileLoaded.profile.password).toBe("fakePassword");
            expect(showInputBoxSpy).toHaveBeenCalledTimes(2);
            expect(saveCredentialsSpy).toHaveBeenCalledTimes(1);
            expect(mockUpdateProperty).toHaveBeenCalledTimes(2);
        });

        it("should not update user and password as plain text if prompt cancelled", async () => {
            const mockUpdateProperty = jest.fn();
            jest.spyOn(ZoweVsCodeExtension as any, "profilesCache", "get").mockReturnValue({
                getLoadedProfConfig: jest.fn().mockReturnValue({
                    profile: {},
                }),
                getProfileInfo: jest.fn().mockReturnValue({
                    isSecured: jest.fn().mockReturnValue(false),
                    updateProperty: mockUpdateProperty,
                }),
                refresh: jest.fn(),
            });
            const showInputBoxSpy = jest.spyOn(Gui, "showInputBox").mockResolvedValueOnce("fakeUser").mockResolvedValueOnce("fakePassword");
            jest.spyOn(Gui, "showMessage").mockResolvedValueOnce(undefined);
            const saveCredentialsSpy = jest.spyOn(ZoweVsCodeExtension as any, "saveCredentials");
            const profileLoaded: any = await ZoweVsCodeExtension.updateCredentials(promptCredsOptions, undefined as any);
            expect(profileLoaded.profile.user).toBe("fakeUser");
            expect(profileLoaded.profile.password).toBe("fakePassword");
            expect(showInputBoxSpy).toHaveBeenCalledTimes(2);
            expect(saveCredentialsSpy).toHaveBeenCalledTimes(1);
            expect(mockUpdateProperty).toHaveBeenCalledTimes(0);
        });

        it("should do nothing if user input is cancelled", async () => {
            const mockUpdateProperty = jest.fn();
            jest.spyOn(ZoweVsCodeExtension as any, "profilesCache", "get").mockReturnValue({
                getLoadedProfConfig: jest.fn().mockReturnValue({
                    profile: {},
                }),
                getProfileInfo: jest.fn().mockReturnValue({
                    isSecured: jest.fn().mockReturnValue(true),
                    updateProperty: mockUpdateProperty,
                }),
                refresh: jest.fn(),
            });
            const showInputBoxSpy = jest.spyOn(Gui, "showInputBox").mockResolvedValueOnce(undefined);
            const profileLoaded: any = await ZoweVsCodeExtension.updateCredentials(promptCredsOptions, undefined as any);
            expect(profileLoaded).toBeUndefined();
            expect(showInputBoxSpy).toHaveBeenCalledTimes(1);
            expect(mockUpdateProperty).toHaveBeenCalledTimes(0);
        });

        it("should do nothing if password input is cancelled", async () => {
            const mockUpdateProperty = jest.fn();
            jest.spyOn(ZoweVsCodeExtension as any, "profilesCache", "get").mockReturnValue({
                getLoadedProfConfig: jest.fn().mockReturnValue({
                    profile: {},
                }),
                getProfileInfo: jest.fn().mockReturnValue({
                    isSecured: jest.fn().mockReturnValue(true),
                    updateProperty: mockUpdateProperty,
                }),
                refresh: jest.fn(),
            });
            const showInputBoxSpy = jest.spyOn(Gui, "showInputBox").mockResolvedValueOnce("fakeUser").mockResolvedValueOnce(undefined);
            const profileLoaded: any = await ZoweVsCodeExtension.updateCredentials(promptCredsOptions, undefined as any);
            expect(profileLoaded).toBeUndefined();
            expect(showInputBoxSpy).toHaveBeenCalledTimes(2);
            expect(mockUpdateProperty).toHaveBeenCalledTimes(0);
        });
    });
});
