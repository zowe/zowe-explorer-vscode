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

import { createInstanceOfProfile, createIProfile } from "../../../__mocks__/mockCreators/shared";
import { ZosConsoleViewProvider } from "../../../src/zosconsole/ZosConsolePanel";
import { Profiles } from "../../../src/Profiles";
import * as vscode from "vscode";
import { ZoweExplorerApiRegister } from "../../../src/ZoweExplorerApiRegister";

describe("ZosConsoleViewProvider", () => {
    function createGlobalMocks(): any {
        const newMocks = {
            imperativeProfile: createIProfile(),
            profileInstance: null,
            testWebView: {},
            issueMvsCommand: jest.fn(),
        };
        newMocks.testWebView = {
            webview: {
                postMessage: jest.fn(),
                asWebviewUri: jest.fn(),
                onDidReceiveMessage: jest.fn(),
            },
        };
        newMocks.profileInstance = createInstanceOfProfile(newMocks.imperativeProfile);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn().mockReturnValue(newMocks.profileInstance),
            configurable: true,
        });
        Object.defineProperty(vscode.Uri, "joinPath", { value: jest.fn(), configurable: true });
        jest.spyOn(ZoweExplorerApiRegister, "getCommandApi").mockReturnValue({
            issueMvsCommand: newMocks.issueMvsCommand,
        } as any);

        return newMocks;
    }
    describe("resolveWebviewView", () => {
        it("should submit command", () => {
            const globalMocks = createGlobalMocks();
            const myconsole = new ZosConsoleViewProvider({} as any);
            myconsole.resolveWebviewView(globalMocks.testWebView, {} as any, { isCancellationRequested: false } as any);
            expect(globalMocks.testWebView.webview.onDidReceiveMessage).toBeCalled();
        });
    });

    describe("runOperCmd", () => {
        it("should successfully return command response", async () => {
            const globalMocks = createGlobalMocks();
            globalMocks.issueMvsCommand.mockResolvedValueOnce({ commandResponse: "hello" });
            const myconsole = new ZosConsoleViewProvider({} as any);
            (myconsole as any).profiles.set("fake", { type: "zosmf" });
            const response = await (myconsole as any).runOperCmd("D T", "fake");
            expect(globalMocks.issueMvsCommand).toBeCalled();
            expect(response).toBe("hello");
        });

        it("should return error when profile not found", async () => {
            const globalMocks = createGlobalMocks();
            const myconsole = new ZosConsoleViewProvider({} as any);
            const response = await (myconsole as any).runOperCmd("D T", "fake");
            expect(globalMocks.issueMvsCommand).not.toBeCalled();
            expect(response).toContain("No profile found");
        });

        it("should return error when MVS command fails", async () => {
            const globalMocks = createGlobalMocks();
            globalMocks.issueMvsCommand.mockImplementationOnce(() => {
                throw new Error("Command failed");
            });
            const myconsole = new ZosConsoleViewProvider({} as any);
            (myconsole as any).profiles.set("fake", { type: "zosmf" });
            const response = await (myconsole as any).runOperCmd("D T", "fake");
            expect(globalMocks.issueMvsCommand).toBeCalled();
            expect(response).toContain("Command failed");
        });
    });
});
