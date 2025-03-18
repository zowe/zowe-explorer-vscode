import * as imperative from "@zowe/imperative";
import { VscSettings } from "../../../src/vscode/doc/VscSettings";
import { createConfigInstance, createConfigLoad } from "../../../__mocks__/mockCreators/shared";
import { ZoweVsCodeExtension, ProfilesCache, FileManagement, Gui } from "../../../src";

jest.mock("@zowe/imperative");

describe("createTeamConfiguration", () => {
    function createBlockMocks() {
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
            testCache: new ProfilesCache({ debug: jest.fn() } as unknown as imperative.Logger),
            // testProfInfo: new imperative.ProfileInfo("zowe"),
            mockConfigInstance: createConfigInstance(),
            mockConfigLoad: null as any as typeof imperative.Config,
            testConfig: createConfigLoad(),
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
                    // ...imperative.Config.empty(),
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
        // newMocks.mockConfigInstance.layerActive = jest.fn().mockReturnValue(newMocks.configLayer);
        // newMocks.mockConfigInstance.api.layers.merge = jest.fn();
        newMocks.testCache.allProfiles = [newMocks.serviceProfile, newMocks.baseProfile];

        Object.defineProperty(ZoweVsCodeExtension, "openConfigFile", { value: jest.fn(), configurable: true });
        Object.defineProperty(FileManagement, "getFullPath", { value: jest.fn(), configurable: true });
        Object.defineProperty(FileManagement, "getZoweDir", { value: jest.fn().mockReturnValue("file://globalPath/.zowe"), configurable: true });
        Object.defineProperty(VscSettings, "getDirectValue", { value: jest.fn().mockReturnValue(true), configurable: true });
        Object.defineProperty(imperative.ConfigSchema, "buildSchema", { value: jest.fn(), configurable: true });
        Object.defineProperty(imperative.ConfigBuilder, "build", { value: jest.fn(), configurable: true });

        Object.defineProperty(imperative, "Config", {
            value: () => newMocks.mockConfigInstance,
            configurable: true,
        });
        newMocks.mockConfigLoad = Object.defineProperty(imperative.Config, "load", {
            value: jest.fn(() => {
                return createConfigLoad();
            }),
            configurable: true,
        });

        return newMocks;
    }

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("Tests that createTeamConfiguration will open config file when cancelling creation in location with existing config file", async () => {
        const blockMocks = createBlockMocks();
        // const spyQuickPick = jest.spyOn(Gui, "showQuickPick").mockResolvedValueOnce("Global: in the Zowe home directory" as any);
        const spyLayers = jest.spyOn(ZoweVsCodeExtension, "getConfigLayers");
        spyLayers.mockResolvedValueOnce(blockMocks.testConfig.layers);
        const spyInfoMessage = jest.spyOn(Gui, "infoMessage").mockResolvedValueOnce(undefined);
        const spyOpenFile = jest.spyOn(ZoweVsCodeExtension, "openConfigFile");
        await ZoweVsCodeExtension.createTeamConfiguration();
        // expect(spyQuickPick).toHaveBeenCalled();
        expect(spyInfoMessage).toHaveBeenCalled();
        expect(spyOpenFile).toHaveBeenCalled();
        // spyQuickPick.mockClear();
        spyLayers.mockClear();
        spyInfoMessage.mockClear();
        spyOpenFile.mockClear();
    });

    it("Test that createTeamConfiguration will throw error if error deals with parsing file", async () => {
        const blockMocks = createBlockMocks();
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
});
