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

import { ZoweUSSNode } from "../../../src/uss/ZoweUSSNode";
import * as vscode from "vscode";
import { Session, IProfileLoaded, Logger } from "@zowe/imperative";
import * as sharedUtils from "../../../src/shared/utils";
import { Profiles } from "../../../src/Profiles";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import { Job } from "../../../src/job/ZoweJobNode";
import * as globals from "../../../src/globals";
import { ZoweExplorerApiRegister } from "../../../src/api/ZoweExplorerApiRegister";
import * as zowe from "@zowe/cli";


describe("Test type guard functions", () => {
    const dsNode = new ZoweDatasetNode(null, null, null, null);
    const ussNode = new ZoweUSSNode(null, null, null, null, null);
    const jobNode = new Job(null, null, null, null, null, null);

    describe("Positive testing", () => {
        it("should pass for ZoweDatasetTreeNode with ZoweDatasetNode node type", async () => {
            const value = sharedUtils.isZoweDatasetTreeNode(dsNode);
            expect(value).toBeTruthy();
        });
        it("should pass for ZoweUSSTreeNode with ZoweUSSNode node type", async () => {
            const value = sharedUtils.isZoweUSSTreeNode(ussNode);
            expect(value).toBeTruthy();
        });
        it("should pass for  ZoweJobTreeNode with Job node type", async () => {
            const value = sharedUtils.isZoweJobTreeNode(jobNode);
            expect(value).toBeTruthy();
        });
    });
    describe("Negative testing", () => {
        describe("Test for ZoweDatasetTreeNode", () => {
            it("should fail with ZoweUSSNode node type", async () => {
                const value = sharedUtils.isZoweDatasetTreeNode(ussNode);
                expect(value).toBeFalsy();
            });
            it("should fail with Job node type", async () => {
                const value = sharedUtils.isZoweDatasetTreeNode(jobNode);
                expect(value).toBeFalsy();
            });
        });
        describe("Test for ZoweUSSTreeNode", () => {
            it("should fail with ZoweDatasetNode node type", async () => {
                const value = sharedUtils.isZoweUSSTreeNode(dsNode);
                expect(value).toBeFalsy();
            });
            it("should fail with Job node type", async () => {
                const value = sharedUtils.isZoweUSSTreeNode(jobNode);
                expect(value).toBeFalsy();
            });
        });
        describe("Test for ZoweJobTreeNode", () => {
            it("should fail with ZoweDatasetNode node type", async () => {
                const value = sharedUtils.isZoweJobTreeNode(dsNode);
                expect(value).toBeFalsy();
            });
            it("should fail with ZoweUSSNode node type", async () => {
                const value = sharedUtils.isZoweJobTreeNode(ussNode);
                expect(value).toBeFalsy();
            });
        });
    });
});

describe("Test force upload", () => {
    const dsNode = new ZoweDatasetNode(null, null, null, null);
    const ussNode = new ZoweUSSNode(null, null, null, null, null);
    const showInformationMessage = jest.fn();
    const showWarningMessage = jest.fn();
    const getMvsApi = jest.fn();
    const getUssApi = jest.fn();
    const withProgress = jest.fn();
    const fileResponse: zowe.IZosFilesResponse = {
        success: true,
        commandResponse: null,
        apiResponse: {
            etag: null
        }
    };
    const ProgressLocation = jest.fn().mockImplementation(() => {
        return {
            Notification: 15
        };
    });
    beforeAll(() => {
        Object.defineProperty(vscode.window, "showInformationMessage", {value: showInformationMessage});
        Object.defineProperty(vscode.window, "showWarningMessage", {value: showWarningMessage});
        Object.defineProperty(ZoweExplorerApiRegister, "getMvsApi", {value: getMvsApi});
        Object.defineProperty(ZoweExplorerApiRegister, "getUssApi", {value: getUssApi});
        Object.defineProperty(vscode.window, "withProgress", {value: withProgress});
        Object.defineProperty(vscode, "ProgressLocation", {value: ProgressLocation});

    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should successfully call upload for a USS file if user clicks 'Yes'", async () => {
        showInformationMessage.mockResolvedValueOnce("Yes");
        withProgress.mockResolvedValueOnce(fileResponse);
        await sharedUtils.willForceUpload(ussNode, null, null);
        expect(withProgress).toBeCalledWith(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Saving file..."
            }, expect.any(Function)
        );
    });
    it("should successfully call upload for a data set if user clicks 'Yes'", async () => {
        showInformationMessage.mockResolvedValueOnce("Yes");
        withProgress.mockResolvedValueOnce(fileResponse);
        await sharedUtils.willForceUpload(dsNode, null, null);
        expect(withProgress).toBeCalledWith(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Saving data set..."
            }, expect.any(Function)
        );
    });
    it("should cancel upload if user clicks 'No'", async () => {
        showInformationMessage.mockResolvedValueOnce("No");
        await sharedUtils.willForceUpload(dsNode, null, null);
        expect(showInformationMessage.mock.calls[1][0]).toBe("Upload cancelled.");
    });
    it("should display specific message if Theia is detected", async () => {
        Object.defineProperty(globals, "ISTHEIA", {value : true});
        showInformationMessage.mockResolvedValueOnce("No");
        await sharedUtils.willForceUpload(dsNode, null, null);
        expect(showWarningMessage.mock.calls[0][0]).toBe("A merge conflict has been detected. Since you are running inside Theia editor, a merge conflict resolution is not available yet.");
    });
});
