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
