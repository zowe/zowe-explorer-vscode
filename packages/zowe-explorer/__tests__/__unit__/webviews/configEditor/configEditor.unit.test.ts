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

import { ExtensionContext } from "vscode";
import { ConfigEditor } from "../../../../src/utils/ConfigEditor";
import { ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";

describe("configEditor", () => {
    let mockContext: ExtensionContext;
    let configEditor: ConfigEditor;
    beforeEach(() => {
        mockContext = {
            extensionPath: "/mock/extension/path",
        } as ExtensionContext;
        configEditor = new ConfigEditor(mockContext);
    });

    describe("areSecureValuesAllowed", () => {
        it("should return false is profiles cache is undefined", () => {});
    });
    describe("getLocalConfigs", () => {
        it("", () => {});
    });

    describe("onDidReceiveMessage", () => {
        it("", () => {});
    });

    describe("handleProfileRenames", () => {
        it("", () => {});
    });

    describe("handleProfileRenames", () => {
        it("", () => {});
    });

    describe("getPendingMergedArgsForProfile", () => {
        it("", () => {});
    });
    describe("layerHasField", () => {
        it("", () => {});
    });

    describe("getWizardMergedProperties", () => {
        it("", () => {});
    });
    describe("simulateProfileRenames", () => {
        it("", () => {});
    });

    describe("wrapper functions", () => {
        it("handleOtherChanges", () => {});
    });
});
