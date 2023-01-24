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

import * as vscode from "vscode";
import * as globals from "../../../src/globals";
import * as sharedExtension from "../../../src/shared/init";

describe("Test src/shared/extension", () => {
    describe("registerRefreshCommand", () => {
        const context: any = { subscriptions: [] };
        const activate = jest.fn();
        const deactivate = jest.fn();
        const dispose = jest.fn();
        let extRefreshCallback;
        const spyExecuteCommand = jest.fn();
        const spyLogError = jest.fn();

        beforeAll(async () => {
            Object.defineProperty(vscode.commands, "registerCommand", {
                value: (_: string, fun: () => void) => {
                    extRefreshCallback = fun;
                    return { dispose };
                },
            });
            Object.defineProperty(vscode.commands, "executeCommand", { value: spyExecuteCommand });
            Object.defineProperty(globals, "LOG", { value: { error: spyLogError } });
            await sharedExtension.registerRefreshCommand(context, activate, deactivate);
        });

        beforeEach(() => {
            jest.clearAllMocks();
        });

        afterAll(() => {
            jest.restoreAllMocks();
        });

        it("Test assuming we are in a Theia environment", async () => {
            Object.defineProperty(globals, "ISTHEIA", { value: true });
            await extRefreshCallback();
            expect(spyExecuteCommand).toHaveBeenCalledWith("workbench.action.reloadWindow");
            expect(spyExecuteCommand).toHaveBeenCalledTimes(1);
            expect(deactivate).not.toHaveBeenCalled();
            expect(dispose).not.toHaveBeenCalled();
            expect(spyLogError).not.toHaveBeenCalled();
            expect(activate).not.toHaveBeenCalled();
        });

        it("Test assuming we are NOT in a Theia environment", async () => {
            Object.defineProperty(globals, "ISTHEIA", { value: false });
            await extRefreshCallback();
            expect(spyExecuteCommand).not.toHaveBeenCalled();
            expect(deactivate).toHaveBeenCalled();
            expect(spyLogError).not.toHaveBeenCalled();
            expect(dispose).toHaveBeenCalled();
            expect(activate).toHaveBeenCalled();
        });

        it("Test assuming we are NOT in a Theia environment and unable to dispose of the subscription", async () => {
            Object.defineProperty(globals, "ISTHEIA", { value: false });
            const testError = new Error("test");
            dispose.mockRejectedValue(testError);
            await extRefreshCallback();
            expect(spyExecuteCommand).not.toHaveBeenCalled();
            expect(deactivate).toHaveBeenCalled();
            expect(spyLogError).toHaveBeenCalledWith(testError);
            expect(dispose).toHaveBeenCalled();
            expect(activate).toHaveBeenCalled();
        });
    });
});
