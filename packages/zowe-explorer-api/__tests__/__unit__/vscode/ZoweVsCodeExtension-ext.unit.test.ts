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
import * as imperative from "@zowe/imperative";
import { VscSettings } from "../../../src/vscode/doc/VscSettings";
import { createConfigInstance, createConfigLoad, createTeamConfigMock } from "../../../__mocks__/mockCreators/shared";
import { ZoweVsCodeExtension, FileManagement, Gui } from "../../../src";

jest.mock("@zowe/imperative");

describe("ZoweVsCodeExtension-ext tests with imperative mocked", () => {
    function createGlobalMocks() {
        const newMocks = {
            testProfile: {
                host: "dummy",
                port: 1234,
            } as imperative.IProfile,
            baseProfile: {
                failNotFound: false,
                message: "",
                name: "base",
                type: "base",
                profile: {},
            } as imperative.IProfileLoaded,
            serviceProfile: {
                failNotFound: false,
                message: "",
                name: "service",
                type: "service",
                profile: {},
            } as imperative.IProfileLoaded,
            mockWorkspaceFolders: jest.fn().mockReturnValue([]),
            mockWorkpaceFolderLoaded: [
                {
                    uri: { fsPath: "fakePath", scheme: "file" },
                },
            ],
            mockConfigInstance: createConfigInstance(),
            testTeamConfigProfile: createTeamConfigMock(),
            mockConfigLoad: null as any as typeof imperative.Config,
            testConfig: createConfigLoad(),
            mockDirectValue: jest.fn(),
            expectedSession: new imperative.Session({
                hostname: "dummy",
                password: "Password",
                port: 1234,
                tokenType: "apimlAuthenticationToken",
                type: "token",
                user: "Username",
            }),
            updProfile: { tokenType: "apimlAuthenticationToken", tokenValue: "tokenValue" },
            testRegister: {
                getCommonApi: () => ({
                    login: jest.fn().mockReturnValue("tokenValue"),
                    logout: jest.fn(),
                    getTokenTypeName: () => "apimlAuthenticationToken",
                }),
            },
            configLayer: {
                exists: true,
                path: "zowe.config.json",
                properties: {
                    profiles: {
                        service: {
                            type: "service",
                            properties: {},
                        },
                        base: {
                            type: "base",
                            properties: {},
                        },
                    },
                },
                global: false,
                user: true,
            },
            mockError: new Error(),
        };

        newMocks.baseProfile.profile = { ...newMocks.testProfile };
        newMocks.serviceProfile.profile = { ...newMocks.testProfile };
        newMocks.configLayer.properties.profiles.base.properties = { ...newMocks.testProfile };
        newMocks.configLayer.properties.profiles.service.properties = { ...newMocks.testProfile };

        Object.defineProperty(ZoweVsCodeExtension, "openConfigFile", { value: jest.fn(), configurable: true });
        Object.defineProperty(FileManagement, "getFullPath", { value: jest.fn(), configurable: true });
        Object.defineProperty(FileManagement, "getZoweDir", { value: jest.fn().mockReturnValue("file://globalPath/.zowe"), configurable: true });
        Object.defineProperty(VscSettings, "getDirectValue", { value: newMocks.mockDirectValue.mockReturnValue(true), configurable: true });
        Object.defineProperty(imperative.ConfigSchema, "buildSchema", { value: jest.fn(), configurable: true });
        Object.defineProperty(imperative.ConfigBuilder, "build", { value: jest.fn(), configurable: true });
        Object.defineProperty(vscode.workspace, "workspaceFolders", { get: newMocks.mockWorkspaceFolders, configurable: true });
        Object.defineProperty(imperative, "Config", { value: () => newMocks.mockConfigInstance, configurable: true });
        newMocks.mockConfigLoad = Object.defineProperty(imperative.Config, "load", {
            value: jest.fn(() => {
                return newMocks.testConfig;
            }),
            configurable: true,
        });

        return newMocks;
    }

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("createTeamConfiguration", () => {
        it("Test that createTeamConfiguration will throw error if error deals with parsing file", async () => {
            const blockMocks = createGlobalMocks();
            const spyLayers = jest.spyOn(ZoweVsCodeExtension, "getConfigLayers");
            spyLayers.mockResolvedValueOnce(blockMocks.testConfig.layers);
            const spyInfoMessage = jest.spyOn(Gui, "infoMessage").mockResolvedValueOnce(undefined);
            const spyOpenFile = jest.spyOn(ZoweVsCodeExtension, "openConfigFile");
            spyOpenFile.mockRejectedValueOnce("Error");

            await expect(ZoweVsCodeExtension.createTeamConfiguration()).rejects.toEqual("Error");
            spyLayers.mockClear();
            spyInfoMessage.mockClear();
            spyOpenFile.mockClear();
        });

        it("Test that createTeamConfiguration will show operation cancelled if location choice exited", async () => {
            const blockMocks = createGlobalMocks();
            blockMocks.mockWorkspaceFolders.mockReturnValue(blockMocks.mockWorkpaceFolderLoaded);
            const spyQuickPick = jest.spyOn(Gui, "showQuickPick").mockResolvedValueOnce(undefined);
            const spyInfoMessage = jest.spyOn(Gui, "infoMessage");
            const spyOpenFile = jest.spyOn(ZoweVsCodeExtension, "openConfigFile");

            await ZoweVsCodeExtension.createTeamConfiguration();
            expect(spyInfoMessage).toHaveBeenCalled();
            expect(spyOpenFile).not.toHaveBeenCalled();
            spyQuickPick.mockClear();
            spyInfoMessage.mockClear();
            spyOpenFile.mockClear();
        });

        it("Tests that createTeamConfiguration will open config file when cancelling creation in location with existing config file", async () => {
            const blockMocks = createGlobalMocks();
            const spyLayers = jest.spyOn(ZoweVsCodeExtension, "getConfigLayers");
            spyLayers.mockResolvedValueOnce(blockMocks.testConfig.layers);
            const spyInfoMessage = jest.spyOn(Gui, "infoMessage").mockResolvedValueOnce(undefined);
            const spyOpenFile = jest.spyOn(ZoweVsCodeExtension, "openConfigFile");

            await ZoweVsCodeExtension.createTeamConfiguration();
            expect(spyInfoMessage).toHaveBeenCalled();
            expect(spyOpenFile).toHaveBeenCalled();
            spyLayers.mockClear();
            spyInfoMessage.mockClear();
            spyOpenFile.mockClear();
        });

        it("Test that createTeamConfiguration will create global if VSC in project and config exist", async () => {
            const blockMocks = createGlobalMocks();
            blockMocks.mockWorkspaceFolders.mockReturnValue(blockMocks.mockWorkpaceFolderLoaded);
            const spyQuickPick = jest.spyOn(Gui, "showQuickPick").mockResolvedValueOnce("Global: in the Zowe home directory" as any);
            const spyLayers = jest.spyOn(imperative.Config, "load");
            spyLayers.mockResolvedValueOnce(blockMocks.testConfig);
            const spyInfoMessage = jest.spyOn(Gui, "infoMessage").mockResolvedValueOnce("Create New");
            const spyOpenFile = jest.spyOn(ZoweVsCodeExtension, "openConfigFile");

            await ZoweVsCodeExtension.createTeamConfiguration();
            expect(spyQuickPick).toHaveBeenCalled();
            expect(spyInfoMessage).toHaveBeenCalled();
            expect(spyOpenFile).toHaveBeenCalled();
            spyQuickPick.mockClear();
            spyLayers.mockClear();
            spyInfoMessage.mockClear();
            spyOpenFile.mockClear();
        });

        it("Test that createTeamConfiguration will create project if VSC in project", async () => {
            const blockMocks = createGlobalMocks();
            blockMocks.mockWorkspaceFolders.mockReturnValue(blockMocks.mockWorkpaceFolderLoaded);
            const spyQuickPick = jest.spyOn(Gui, "showQuickPick").mockResolvedValueOnce("Project: in the current working directory" as any);
            const spyLayers = jest.spyOn(ZoweVsCodeExtension, "getConfigLayers");
            spyLayers.mockResolvedValueOnce(blockMocks.testConfig.layers);
            const spyOpenFile = jest.spyOn(ZoweVsCodeExtension, "openConfigFile");

            await ZoweVsCodeExtension.createTeamConfiguration();
            expect(spyQuickPick).toHaveBeenCalled();
            expect(spyOpenFile).toHaveBeenCalled();
            spyQuickPick.mockClear();
            spyLayers.mockClear();
            spyOpenFile.mockClear();
        });

        it("Test that createTeamConfiguration will create unsecure global", async () => {
            const blockMocks = createGlobalMocks();
            blockMocks.mockWorkspaceFolders.mockReturnValue(blockMocks.mockWorkpaceFolderLoaded);
            const spyQuickPick = jest.spyOn(Gui, "showQuickPick").mockResolvedValueOnce("Global: in the Zowe home directory" as any);
            const spyLayers = jest.spyOn(ZoweVsCodeExtension, "getConfigLayers");
            spyLayers.mockResolvedValueOnce(blockMocks.testConfig.layers);
            const spyInfoMessage = jest.spyOn(Gui, "infoMessage").mockResolvedValueOnce("Create New");
            jest.spyOn(imperative.ConfigBuilder, "build").mockReturnValue(blockMocks.testTeamConfigProfile as any);
            blockMocks.mockDirectValue.mockReturnValueOnce(false);
            const spyOpenFile = jest.spyOn(ZoweVsCodeExtension, "openConfigFile");

            await ZoweVsCodeExtension.createTeamConfiguration();
            expect(spyQuickPick).toHaveBeenCalled();
            expect(spyInfoMessage).toHaveBeenCalled();
            expect(spyOpenFile).toHaveBeenCalled();
            spyQuickPick.mockClear();
            spyLayers.mockClear();
            spyInfoMessage.mockClear();
            spyOpenFile.mockClear();
        });
    });
});
