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
import { ProfilesCache, ZoweExplorerApiType, ZoweTreeNode } from "@zowe/zowe-explorer-api";
import { createIProfile, createISession } from "../../__mocks__/mockCreators/shared";
import { ZoweCommandProvider } from "../../../src/commands/ZoweCommandProvider";
import { Profiles } from "../../../src/configuration/Profiles";
import { ZoweDatasetNode } from "../../../src/trees/dataset/ZoweDatasetNode";
import { SharedContext } from "../../../src/trees/shared/SharedContext";
import { createIJobFile } from "../../__mocks__/mockCreators/jobs";
import { AuthUtils } from "../../../src/utils/AuthUtils";

const globalMocks = {
    testSession: createISession(),
    testProfile: createIProfile(),
    mockIJobFile: createIJobFile(),
};
describe("ZoweCommandProvider Unit Tests", () => {
    describe("ZoweCommandProvider Unit Tests - function refreshElement", () => {
        it("should refresh the tree data", () => {
            const testNode = new (ZoweTreeNode as any)("test", vscode.TreeItemCollapsibleState.None, undefined);
            Object.defineProperty(ZoweCommandProvider.prototype, "mOnDidChangeTreeData", {
                value: {
                    fire: jest.fn(),
                },
                configurable: true,
            });
            expect(ZoweCommandProvider.prototype.refreshElement(testNode)).toEqual(undefined);
        });
    });
});

describe("ZoweCommandProvider Unit Tests - function checkCurrentProfile", () => {
    const testNode: any = new ZoweDatasetNode({
        label: "test",
        collapsibleState: vscode.TreeItemCollapsibleState.None,
        session: globalMocks.testSession,
    });
    testNode.setProfileToChoice(globalMocks.testProfile);
    testNode.contextValue = "session server";

    beforeEach(async () => {
        jest.spyOn(ProfilesCache.prototype, "refresh").mockImplementation();
        const profilesInstance = await Profiles.createInstance(undefined as any);
        Object.defineProperty(profilesInstance, "log", {
            value: {
                error: jest.fn(),
            },
        });
        jest.spyOn(ZoweCommandProvider.prototype, "refresh").mockImplementationOnce(() => {});
        jest.spyOn(SharedContext, "isSessionNotFav").mockReturnValue(true);
    });
    it("should check current profile and perform the case when status is 'active'", async () => {
        const profileStatus = { name: "test", status: "active" };

        jest.spyOn(Profiles.getInstance(), "checkCurrentProfile").mockResolvedValue(profileStatus);
        await expect(ZoweCommandProvider.prototype.checkCurrentProfile(testNode)).resolves.toEqual(profileStatus);
    });
    it("should check current profile and perform the case when status is 'unverified'", async () => {
        const profileStatus = { name: "test", status: "unverified" };

        jest.spyOn(Profiles.getInstance(), "checkCurrentProfile").mockResolvedValue(profileStatus);
        await expect(ZoweCommandProvider.prototype.checkCurrentProfile(testNode)).resolves.toEqual(profileStatus);
    });
    it("should check current profile and perform the case when status is 'inactive'", async () => {
        Object.defineProperty(ZoweCommandProvider, "mOnDidChangeTreeData", {
            value: {
                debug: jest.fn(),
            },
            configurable: true,
        });
        const profileStatus = { name: "test", status: "inactive" };
        jest.spyOn(Profiles.getInstance(), "checkCurrentProfile").mockResolvedValue(profileStatus);
        const errorHandlingSpy = jest.spyOn(AuthUtils, "errorHandling").mockImplementation();
        await expect(ZoweCommandProvider.prototype.checkCurrentProfile(testNode)).resolves.toEqual(profileStatus);
        expect(errorHandlingSpy).toHaveBeenCalledWith(
            "Profile Name " +
                globalMocks.testProfile.name +
                " is inactive. Please check if your Zowe server is active or if the URL and port in your profile is correct.",
            { apiType: ZoweExplorerApiType.Command, profile: globalMocks.testProfile }
        );
    });
});
