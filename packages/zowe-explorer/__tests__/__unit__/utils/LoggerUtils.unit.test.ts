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

import { ZoweLogger } from "../../../src/utils/LoggerUtils";
import * as vscode from "vscode";
import * as globals from "../../../src/globals";
import { Gui } from "@zowe/zowe-explorer-api";

describe("Logger Utils Unit Tests - function initializeZoweLogger", () => {
    it("should throw an error if logger was not able to initialize", async () => {
        jest.spyOn(globals, "initLogger").mockImplementation(() => {
            throw new Error("failed to initialize logger");
        });

        const errorMessageSpy = jest.spyOn(Gui, "errorMessage").mockImplementation();
        const testContext = {
            subscriptions: [],
            extensionPath: "./test",
            extension: {
                packageJSON: {
                    packageInfo: "Zowe Explorer",
                    version: "2.x.x",
                },
            },
        } as unknown as vscode.ExtensionContext;

        expect(await ZoweLogger.initializeZoweLogger(testContext)).toBeUndefined();
        expect(errorMessageSpy).toBeCalledTimes(1);
    });
});
