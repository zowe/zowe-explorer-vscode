import * as LoggerUtils from "../../../src/utils/LoggerUtils";
import * as vscode from "vscode";
import * as globals from "../../../src/globals";
import { Gui } from "@zowe/zowe-explorer-api";

describe("Logger Utils Unit Tests - function initializeZoweLogger", () => {
    it("should throw an error if logger was not able to initialize", async () => {
        jest.spyOn(globals, "initLogger").mockImplementation(() => {
            throw new Error("failed to initialize logger");
        });

        Object.defineProperty(globals, "LOG", {
            value: {
                error: jest.fn(),
            },
            configurable: true,
        });

        const errorMessageSpy = jest.spyOn(Gui, "errorMessage").mockImplementation();

        await expect(
            LoggerUtils.initializeZoweLogger({
                subscriptions: [],
                extensionPath: "./test",
            } as vscode.ExtensionContext)
        ).resolves.toEqual(undefined);
        expect(errorMessageSpy).toBeCalledTimes(1);
    });
});
