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

import { env, ExtensionContext } from "vscode";
import { TroubleshootError } from "../../../src/utils/TroubleshootError";
import { CorrelatedError } from "@zowe/zowe-explorer-api";
import { ZoweLogger } from "../../../src/tools/ZoweLogger";
import { MockedProperty } from "../../__mocks__/mockUtils";

describe("TroubleshootError", () => {
    function getGlobalMocks() {
        const context = {
            extensionPath: "/a/b/c/zowe-explorer",
            subscriptions: [],
        } as unknown as ExtensionContext;
        const error = new Error("test error");
        error.stack = "test stack trace";
        const correlatedError = new CorrelatedError({ initialError: error });
        const troubleshootError = new TroubleshootError(context, { error: correlatedError, stackTrace: "test stack trace" });

        return {
            context,
            error,
            correlatedError,
            troubleshootError,
        };
    }
    describe("onDidReceiveMessage", () => {
        it("handles copy command for error with stack trace", async () => {
            const { error, troubleshootError } = getGlobalMocks();
            const writeTextMock = jest.spyOn(env.clipboard, "writeText").mockImplementation();
            await troubleshootError.onDidReceiveMessage({ command: "copy" });
            expect(writeTextMock).toHaveBeenCalledWith(`Error details:\n${error.message}\nStack trace:\n${error.stack?.replace(/(.+?)\n/, "")}`);
        });

        it("handles copy command for error without stack trace", async () => {
            const { error, troubleshootError } = getGlobalMocks();
            const errorProp = new MockedProperty(error, "stack", { value: undefined });
            const writeTextMock = jest.spyOn(env.clipboard, "writeText").mockImplementation();
            await troubleshootError.onDidReceiveMessage({ command: "copy" });
            expect(writeTextMock).toHaveBeenCalledWith(`Error details:\n${error.message}`);
            errorProp[Symbol.dispose]();
        });

        it("handles ready command", async () => {
            const { troubleshootError } = getGlobalMocks();
            const sendErrorDataSpy = jest.spyOn(troubleshootError, "sendErrorData");
            await troubleshootError.onDidReceiveMessage({ command: "ready" });
            expect(sendErrorDataSpy).toHaveBeenCalledWith(troubleshootError.errorData);
        });

        it("handles an unrecognized command", async () => {
            const { troubleshootError } = getGlobalMocks();
            const debugSpy = jest.spyOn(ZoweLogger, "debug");
            await troubleshootError.onDidReceiveMessage({ command: "unknown" });
            expect(debugSpy).toHaveBeenCalledWith("[TroubleshootError] Unknown command: unknown");
        });
    });

    describe("sendErrorData", () => {
        it("sends error data to the webview", async () => {
            const { correlatedError, troubleshootError } = getGlobalMocks();
            const postMessageSpy = jest.spyOn(troubleshootError.panel.webview, "postMessage");
            const data = { error: correlatedError, stackTrace: correlatedError.stack };
            await troubleshootError.sendErrorData(data);
            expect(postMessageSpy).toHaveBeenCalledWith(data);
        });
    });
});
