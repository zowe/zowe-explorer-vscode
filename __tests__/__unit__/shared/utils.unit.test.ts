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
import { Session } from "@zowe/imperative";
import * as sharedUtils from "../../../src/shared/utils";

const session = new Session({
    user: "fake",
    password: "fake",
    hostname: "fake",
    protocol: "https",
    type: "basic",
});

describe("Shared Utils Unit Tests - Function node.labelRefresh()", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("Checks that labelRefresh subtly alters the label", async () => {
        const rootNode = new ZoweUSSNode(
            "gappy", vscode.TreeItemCollapsibleState.Collapsed, null, session, null, false, null, undefined);
        expect(rootNode.label === "gappy");
        sharedUtils.labelRefresh(rootNode);
        expect(rootNode.label === "gappy ");
        sharedUtils.labelRefresh(rootNode);
        expect(rootNode.label === "gappy");
    });
});
