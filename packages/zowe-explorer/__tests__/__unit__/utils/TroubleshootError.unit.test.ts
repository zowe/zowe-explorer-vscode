import { env, ExtensionContext } from "vscode";
import { TroubleshootError } from "../../../src/utils/TroubleshootError";
import { NetworkError } from "@zowe/zowe-explorer-api";
import { ZoweLogger } from "../../../src/tools/ZoweLogger";

describe("TroubleshootError", () => {
    function getGlobalMocks() {
        const context = {
            extensionPath: "/a/b/c/zowe-explorer",
            subscriptions: [],
        } as unknown as ExtensionContext;
        const errorData = {
            error: new NetworkError({ error: "test error" }),
            stackTrace: "test stack trace",
        };
        const troubleshootError = new TroubleshootError(context, errorData);

        return {
            context,
            errorData,
            troubleshootError,
        };
    }
    describe("onDidReceiveMessage", () => {
        it("handles copy command for error with stack trace", async () => {
            const { errorData, troubleshootError } = getGlobalMocks();
            const writeTextMock = jest.spyOn(env.clipboard, "writeText").mockImplementation();
            await troubleshootError.onDidReceiveMessage({ command: "copy" });
            expect(writeTextMock).toHaveBeenCalledWith(
                `Error details:\n${errorData.error.message}\nStack trace:\n${errorData.error.stack.replace(/(.+?)\n/, "")}`
            );
        });

        it("handles copy command for error without stack trace", async () => {
            const { errorData, troubleshootError } = getGlobalMocks();
            Object.defineProperty(errorData.error, "stack", { value: undefined });
            const writeTextMock = jest.spyOn(env.clipboard, "writeText").mockImplementation();
            await troubleshootError.onDidReceiveMessage({ command: "copy" });
            expect(writeTextMock).toHaveBeenCalledWith(`Error details:\n${errorData.error.message}`);
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
            const { errorData, troubleshootError } = getGlobalMocks();
            const postMessageSpy = jest.spyOn(troubleshootError.panel.webview, "postMessage");
            await troubleshootError.sendErrorData(errorData);
            expect(postMessageSpy).toHaveBeenCalledWith(errorData);
        });
    });
});
