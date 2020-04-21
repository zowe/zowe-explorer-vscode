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

import * as ussNodeActions from "../../../src/uss/actions";
import { generateUSSTree, generateUSSNode, generateFavoriteUSSNode } from "../../../__mocks__/generators/uss";
import { generateProfile, generateSession, generateTreeView } from "../../../__mocks__/generators/shared";
import { ValidProfileEnum, Profiles } from "../../../src/Profiles";
import * as vscode from "vscode";
import * as globals from "../../../src/globals";
import * as zowe from "@zowe/cli";

const showQuickPick = jest.fn();
const showInputBox = jest.fn();
const Create = jest.fn();
const uss = jest.fn();
const writeText = jest.fn();
const showErrorMessage = jest.fn();

Object.defineProperty(vscode.window, "showInputBox", { value: showInputBox });
Object.defineProperty(vscode.window, "showQuickPick", { value: showQuickPick });
Object.defineProperty(zowe, "Create", { value: Create });
Object.defineProperty(Create, "uss", { value: uss });
Object.defineProperty(vscode.env.clipboard, "writeText", {value: writeText});
let theia = false;
Object.defineProperty(globals, "ISTHEIA", {get: () => theia});

const testSession = generateSession();
const testProfile = generateProfile();

const mockLoadNamedProfile = jest.fn();
mockLoadNamedProfile.mockReturnValue(testProfile);
Object.defineProperty(Profiles, "getInstance", {
    value: jest.fn(() => {
        return {
            allProfiles: [{name: "firstName"}, {name: "secondName"}],
            defaultProfile: {name: "firstName"},
            type: "zosmf",
            validProfile: ValidProfileEnum.VALID,
            checkCurrentProfile: jest.fn(),
            loadNamedProfile: mockLoadNamedProfile
        };
    })
});

describe("USS Action Unit Tests - Function createUSSNodeDialog", () => {
    let ussNode;
    let testUSSTree;

    beforeEach(() => {
        ussNode = generateUSSNode(testSession, generateProfile());
        testUSSTree = generateUSSTree([generateFavoriteUSSNode(testSession, testProfile)], [ussNode], generateTreeView());
    })

    afterAll(() => {
        jest.clearAllMocks();
    });

    it("Tests if createUSSNode is executed successfully", async () => {
        showQuickPick.mockResolvedValueOnce("File");
        showInputBox.mockReturnValueOnce("USSFolder");

        await ussNodeActions.createUSSNodeDialog(ussNode, testUSSTree);
        expect(testUSSTree.refreshAll).toHaveBeenCalled();
        expect(testUSSTree.refreshElement).not.toHaveBeenCalled();
        expect(showErrorMessage.mock.calls.length).toBe(0);
    });
});

describe("USS Action Unit Tests - Function createUSSNode", () => {
    const ussNode = generateUSSNode(testSession, generateProfile());
    const testUSSTree = generateUSSTree([generateFavoriteUSSNode(testSession, testProfile)], [ussNode], generateTreeView());

    beforeEach(() => {
        showInputBox.mockReset();
        testUSSTree.refresh.mockReset();
        testUSSTree.refreshAll.mockReset();
        testUSSTree.refreshElement.mockReset();
    });
    afterAll(() => {
        jest.clearAllMocks();
    });

    it("Tests that createUSSNode is executed successfully", async () => {
        showInputBox.mockReturnValueOnce("USSFolder");

        await ussNodeActions.createUSSNode(ussNode, testUSSTree, "file");
        expect(testUSSTree.refreshElement).toHaveBeenCalled();
        expect(showErrorMessage.mock.calls.length).toBe(0);
    });

    it("Tests that createUSSNode does not execute if node name was not entered", async () => {
        showInputBox.mockReturnValueOnce("");

        await ussNodeActions.createUSSNode(ussNode, testUSSTree, "file");
        expect(testUSSTree.refresh).not.toHaveBeenCalled();
        expect(showErrorMessage.mock.calls.length).toBe(0);
    });

    it("Tests that only the child node is refreshed when createUSSNode() is called on a child node", async () => {
        showInputBox.mockReturnValueOnce("USSFolder");
        const isTopLevel = false;
        spyOn(ussNodeActions, "refreshAllUSS");

        await ussNodeActions.createUSSNode(ussNode, testUSSTree, "folder", isTopLevel);
        expect(testUSSTree.refreshElement).toHaveBeenCalled();
        expect(ussNodeActions.refreshAllUSS).not.toHaveBeenCalled();
    });
});

describe("USS Action Unit Tests - Function refreshAllUSS", () => {
    const ussNode = generateUSSNode(testSession, generateProfile());
    const testUSSTree = generateUSSTree([generateFavoriteUSSNode(testSession, testProfile)], [ussNode], generateTreeView());

    beforeEach(() => {
        testUSSTree.refresh.mockReset();
        testUSSTree.refreshAll.mockReset();
        testUSSTree.refreshElement.mockReset();
    });
    afterAll(() => {
        jest.clearAllMocks();
    });

    it("Tests that refreshAllUSS() is executed successfully", async () => {
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName"}, {name: "secondName"}],
                    defaultProfile: {name: "firstName"},
                    getDefaultProfile: mockLoadNamedProfile,
                    loadNamedProfile: mockLoadNamedProfile,
                    usesSecurity: true,
                    getProfiles: jest.fn(() => {
                        return [{name: testProfile.name, profile: testProfile}, {name: testProfile.name, profile: testProfile}];
                    }),
                    refresh: jest.fn(),
                };
            })
        });
        const spy = jest.spyOn(ussNodeActions, "refreshAllUSS");

        ussNodeActions.refreshAllUSS(testUSSTree);
        expect(spy).toHaveBeenCalledTimes(1);
    });
});

describe("copyPath", () => {
    const ussNode = generateUSSNode(testSession, generateProfile());

    beforeEach(() => {
        writeText.mockReset();
    });
    afterAll(() => {
        theia = false;
        jest.clearAllMocks();
    });

    it("should copy the node's full path to the system clipboard", async () => {
        await ussNodeActions.copyPath(ussNode);
        expect(writeText).toBeCalledWith(ussNode.fullPath);
    });

    it("should not copy the node's full path to the system clipboard if theia", async () => {
        theia = true;

        await ussNodeActions.copyPath(ussNode);
        expect(writeText).not.toBeCalled();
    });
});