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

import { ZoweCommandProvider } from "../../../src/abstract/ZoweCommandProvider";
import { ZoweTreeNode } from "@zowe/zowe-explorer-api";
import * as vscode from "vscode";
import { Profiles } from "../../../src/Profiles";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import { createIJobFile } from "../../../__mocks__/mockCreators/jobs";
import * as contextually from "../../../src/shared/context";
import { createIProfile, createISession } from "../../../__mocks__/mockCreators/shared";
import * as utils from "../../../src/utils/ProfilesUtils";
import { ZoweLogger } from "../../../src/utils/LoggerUtils";

const globalMocks = {
    testSession: createISession(),
    testProfile: createIProfile(),
    mockIJobFile: createIJobFile(),
};
describe("ZoweCommandProvider Unit Tests", () => {
    Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });
    describe("ZoweCommandProvider Unit Tests - function refreshElement", () => {
        it("should refresh the tree data", async () => {
            const testNode = new (ZoweTreeNode as any)("test", vscode.TreeItemCollapsibleState.None, undefined);
            Object.defineProperty(ZoweCommandProvider.prototype, "mOnDidChangeTreeData", {
                value: {
                    fire: jest.fn(),
                },
                configurable: true,
            });
            await expect(ZoweCommandProvider.prototype.refreshElement(testNode)).toEqual(undefined);
        });
    });
});

describe("ZoweCommandProvide Unit Tests - function checkCurrentProfile", () => {
    const testNode = new ZoweDatasetNode("test", vscode.TreeItemCollapsibleState.None, undefined, globalMocks.testSession);
    testNode.setProfileToChoice(globalMocks.testProfile);
    testNode.contextValue = "session server";

    beforeEach(async () => {
        void Profiles.createInstance(undefined);
        Object.defineProperty(Profiles.getInstance(), "log", {
            value: {
                error: jest.fn(),
            },
        });
        jest.spyOn(ZoweCommandProvider.prototype, "refresh").mockImplementation();
        jest.spyOn(contextually, "isSessionNotFav").mockReturnValue(true);
    });
    it("should check current profile and perform the case when status is 'active'", async () => {
        jest.spyOn(Profiles.getInstance(), "checkCurrentProfile").mockResolvedValue({
            name: "test",
            status: "active",
        });
        await expect(ZoweCommandProvider.prototype.checkCurrentProfile(testNode)).resolves.toEqual(undefined);
    });
    it("should check current profile and perform the case when status is 'unverified'", async () => {
        jest.spyOn(Profiles.getInstance(), "checkCurrentProfile").mockResolvedValue({
            name: "test",
            status: "unverified",
        });
        await expect(ZoweCommandProvider.prototype.checkCurrentProfile(testNode)).resolves.toEqual(undefined);
    });
    it("should check current profile and perform the case when status is 'inactive'", async () => {
        Object.defineProperty(ZoweCommandProvider.prototype as any, "log", {
            value: {
                debug: jest.fn(),
            },
            configurable: true,
        });
        jest.spyOn(Profiles.getInstance(), "checkCurrentProfile").mockResolvedValue({
            name: "test",
            status: "inactive",
        });
        const errorHandlingSpy = jest.spyOn(utils, "errorHandling").mockImplementation();
        await expect(ZoweCommandProvider.prototype.checkCurrentProfile(testNode)).resolves.toEqual(undefined);
        expect(errorHandlingSpy).toBeCalledWith(
            "Profile Name " +
                globalMocks.testProfile.name +
                " is inactive. Please check if your Zowe server is active or if the URL and port in your profile is correct."
        );
    });
});
