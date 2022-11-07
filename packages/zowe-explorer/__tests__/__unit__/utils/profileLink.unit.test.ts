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

import { IProfileLoaded, Logger } from "@zowe/imperative";
import * as zowe from "@zowe/cli";
import * as vscode from "vscode";
import * as globals from "../../../src/globals";
import * as fs from "fs";
import * as testConst from "../../../resources/testProfileData";
import { IZoweDatasetTreeNode, ZoweExplorerTreeApi } from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../../../src/ZoweExplorerApiRegister";
import { Profiles } from "../../../src/Profiles";
import { linkProfileDialog, getLinkedProfile } from "../../../src/ProfileLink";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";

jest.mock("fs");

const existsSync = jest.fn();
const mkdirSync = jest.fn();
const readFileSync = jest.fn();
const writeFileSync = jest.fn();
const mockdirectLoad = jest.fn();
const mockAllTypes = jest.fn();
const mockNamesForType = jest.fn();
const showQuickPick = jest.fn();
const showInformationMessage = jest.fn();
const showErrorMessage = jest.fn();

Object.defineProperty(fs, "existsSync", { value: existsSync });
Object.defineProperty(fs, "mkdirSync", { value: mkdirSync });
Object.defineProperty(fs, "readFileSync", { value: readFileSync });
Object.defineProperty(fs, "writeFileSync", { value: writeFileSync });
Object.defineProperty(vscode.window, "showQuickPick", { value: showQuickPick });
Object.defineProperty(vscode.window, "showInformationMessage", { value: showInformationMessage });
Object.defineProperty(vscode.window, "showErrorMessage", { value: showErrorMessage });

const testProfile: IProfileLoaded = {
    name: "azbox",
    profile: {
        user: undefined,
        password: undefined,
        host: "azbox.com",
        port: 32070,
        rejectUnauthorized: false,
        name: "azbox",
    },
    type: "zosmf",
    message: "",
    failNotFound: false,
};

const session = zowe.ZosmfSession.createBasicZosmfSession(testConst.profile);
const sessionNode = new ZoweDatasetNode(
    testConst.profile.name,
    vscode.TreeItemCollapsibleState.Expanded,
    null,
    session,
    undefined,
    undefined,
    testProfile
);
sessionNode.contextValue = globals.DS_SESSION_CONTEXT;
sessionNode.pattern = "MYHLQ.TEST";

const profileOne: IProfileLoaded = {
    name: "btso",
    profile: {
        user: undefined,
        password: undefined,
    },
    type: "tso",
    message: "",
    failNotFound: false,
};

const profileTwo: IProfileLoaded = {
    name: "zos1",
    profile: {
        user: undefined,
        password: undefined,
    },
    type: "zosmf",
    message: "",
    failNotFound: false,
};

const dataSetName = "MYHLQ.TEST" + ".EXT.DATASET.TEST";
const testNode = new ZoweDatasetNode(dataSetName, vscode.TreeItemCollapsibleState.None, sessionNode, session);
const aBadNode: any = {
    dummy: test,
};
const profilesForValidation = { status: "active", name: "fake" };

describe("Profile link unit tests part 1", () => {
    //  writeYaml.mockReturnValue("secondaries:"+"\u000a" + "  zftp: azftp"+"\u000a" + "  tso: btso "+"\u000a");
    beforeEach(() => {
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{ name: "firstName" }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    directLoad: mockdirectLoad,
                    promptCredentials: jest.fn(),
                    getAllTypes: mockAllTypes,
                    getNamesForType: mockNamesForType,
                    updateProfile: jest.fn(),
                    checkCurrentProfile: jest.fn(() => {
                        return profilesForValidation;
                    }),
                    profilesForValidation: [],
                    validateProfiles: jest.fn(),
                };
            }),
        });
        mockAllTypes.mockReturnValueOnce(["tso", "zftp", "ano"]);
        mockNamesForType.mockReturnValueOnce(["pro1", "pro2", "pro3"]);
        existsSync.mockReturnValueOnce(false);
        existsSync.mockReturnValueOnce(true);
        readFileSync.mockReturnValue(
            "secondaries:" + "\u000a" + "  zftp: azftp" + "\u000a" + "  tso: btso " + "\u000a"
        );
        writeFileSync.mockReturnValue({});
        showInformationMessage.mockReset();
    });
    afterEach(() => {
        jest.resetAllMocks();
    });

    it("Test get profile via the API", async () => {
        const extenderApi = (ZoweExplorerApiRegister.getExplorerExtenderApi() as unknown) as ZoweExplorerTreeApi;
        expect((await extenderApi.getProfile(testNode)).name).toEqual("azbox");
    });

    it("Test get profile via the API - Bad input", async () => {
        let response = "";
        const extenderApi = (ZoweExplorerApiRegister.getExplorerExtenderApi() as unknown) as ZoweExplorerTreeApi;
        try {
            await extenderApi.getProfile(aBadNode as IZoweDatasetTreeNode);
        } catch (error) {
            response = error.message;
        }
        expect(response).toEqual("Tree Item is not a Zowe Explorer item.");
    });

    it("Test get linked profile via the API", async () => {
        mockdirectLoad.mockReturnValue(profileOne);
        profileOne.name = "btso";
        const extenderApi = (ZoweExplorerApiRegister.getExplorerExtenderApi() as unknown) as ZoweExplorerTreeApi;
        const pr1 = await extenderApi.getLinkedProfile(testNode, "tso");
        expect(pr1.name).toEqual("btso");
    });

    it("Test get linked profile directly - Bad input", async () => {
        let response = "";
        ZoweExplorerApiRegister.getExplorerExtenderApi();
        try {
            await getLinkedProfile(aBadNode as IZoweDatasetTreeNode, "tso", Logger.getAppLogger());
        } catch (error) {
            response = error.message;
        }
        expect(response).toEqual("Tree Item is not a Zowe Explorer item.");
    });

    it("Test get linked profile via the API - Bad input", async () => {
        let response = "";
        const extenderApi = (ZoweExplorerApiRegister.getExplorerExtenderApi() as unknown) as ZoweExplorerTreeApi;
        try {
            await extenderApi.getLinkedProfile(aBadNode as IZoweDatasetTreeNode, "tso");
        } catch (error) {
            response = error.message;
        }
        expect(response).toEqual("Tree Item is not a Zowe Explorer item.");
    });

    it("Test get linked profile via the API - Bad output found", async () => {
        let response = "";
        mockdirectLoad.mockRejectedValue(new Error("An Error"));
        const extenderApi = (ZoweExplorerApiRegister.getExplorerExtenderApi() as unknown) as ZoweExplorerTreeApi;
        try {
            const pr1 = await extenderApi.getLinkedProfile(testNode, "tso");
        } catch (error) {
            response = error.message;
        }
        expect(response).toEqual("Attempted to load a missing profile. + An Error");
    });

    it("Test the linked profile save dialog", async () => {
        showQuickPick.mockReturnValueOnce("ano");
        showQuickPick.mockReturnValueOnce("pro2");
        await linkProfileDialog(profileOne);
        expect(writeFileSync.mock.calls[0][0]).toContain("btso.yaml");
        expect(writeFileSync.mock.calls[0][1]).toContain("ano: pro2");
        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toBe(
            "Associated secondary profile ano:pro2 with tso:btso primary."
        );
    });

    it("Test the linked profile save dialog", async () => {
        showQuickPick.mockReturnValueOnce("ano");
        showQuickPick.mockReturnValueOnce("pro3");
        await linkProfileDialog(profileOne);
        expect(writeFileSync.mock.calls[0][1]).toContain("ano: pro3");
    });
});

describe("Profile link unit tests part 2. No file for profile", () => {
    beforeEach(() => {
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{ name: "firstName" }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    directLoad: mockdirectLoad,
                    promptCredentials: jest.fn(),
                    getAllTypes: mockAllTypes,
                    getNamesForType: mockNamesForType,
                    updateProfile: jest.fn(),
                    checkCurrentProfile: jest.fn(() => {
                        return profilesForValidation;
                    }),
                    profilesForValidation: [],
                    validateProfiles: jest.fn(),
                };
            }),
        });
        mockAllTypes.mockReturnValueOnce(["tso", "zftp", "ano"]);
        mockNamesForType.mockReturnValueOnce(["pro1", "pro2", "pro3"]);
        existsSync.mockReturnValueOnce(false);
        existsSync.mockReturnValueOnce(false);
        existsSync.mockReturnValueOnce(true);
        writeFileSync.mockReturnValue({});
        showQuickPick.mockReturnValueOnce("ano");
        showQuickPick.mockReturnValueOnce("pro3");
    });
    afterEach(() => {
        jest.resetAllMocks();
    });

    it("Test the linked profile save dialog repeat with an empty file loaded", async () => {
        await linkProfileDialog(profileOne);
        expect(showInformationMessage.mock.calls[0][0]).toBe(
            "Associated secondary profile ano:pro3 with tso:btso primary."
        );
    });

    it("Test the linked profile save dialog repeat with a bad file loaded", async () => {
        readFileSync.mockReturnValue("Stuff");
        await linkProfileDialog(profileTwo);
        expect(showInformationMessage.mock.calls[0][0]).toBe(
            "Associated secondary profile ano:pro3 with zosmf:zos1 primary."
        );
        expect(writeFileSync.mock.calls[0][1]).toContain("ano: pro3"); // line 126
    });
    it("Test the linked profile save dialog repeat with an empty file loaded", async () => {
        readFileSync.mockReturnValue("secondaries:");
        await linkProfileDialog(profileTwo);
        expect(showInformationMessage.mock.calls[0][0]).toBe(
            "Associated secondary profile ano:pro3 with zosmf:zos1 primary."
        );
        expect(writeFileSync.mock.calls[0][1]).toContain("ano: pro3");
    });
    it("Test the linked profile save dialog error thrown", async () => {
        readFileSync.mockImplementationOnce(() => {
            throw Error("Test Error 1");
        });
        await linkProfileDialog(profileTwo);
        expect(showErrorMessage.mock.calls[0][0]).toBe("Unable to save profile association. Test Error 1");
    });
});
