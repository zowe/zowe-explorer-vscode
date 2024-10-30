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

import { createInstanceOfProfile, createIProfile } from "../../__mocks__/mockCreators/shared";
import { ZosConsoleViewProvider } from "../../../src/zosconsole/ZosConsolePanel";
import { Profiles } from "../../../src/configuration/Profiles";
import * as vscode from "vscode";
import * as fs from "fs";

jest.mock("fs");
jest.mock("@zowe/zowe-explorer-api", () => ({
    ...jest.requireActual("@zowe/zowe-explorer-api"),
    HTMLTemplate: jest.requireActual("../../../../zowe-explorer-api/src/vscode/ui/utils/HTMLTemplate"),
}));

describe("ZosConsoleViewProvider", () => {
    function createGlobalMocks(): any {
        const newMocks = {
            imperativeProfile: createIProfile(),
            profileInstance: null,
            testWebView: {},
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
        const spyReadFile = jest.fn((path, encoding, callback) => {
            callback(null, "file contents");
        });
        Object.defineProperty(fs, "readFile", { value: spyReadFile, configurable: true });
        return newMocks;
    }
    describe("resolveWebviewView", () => {
        it("should submit command", () => {
            const globalMocks = createGlobalMocks();
            const myconsole = new ZosConsoleViewProvider({} as any);
            myconsole.resolveWebviewView(globalMocks.testWebView, {} as any, { isCancellationRequested: false } as any);
            expect(globalMocks.testWebView.webview.onDidReceiveMessage).toHaveBeenCalled();
        });
        it("handles the get_localization message", async () => {
            const globalMocks = createGlobalMocks();
            const myconsole = new ZosConsoleViewProvider({} as any);
            const postMessageMock = jest.spyOn(globalMocks.testWebView.webview, "postMessage").mockImplementation();
            const onDidReceiveMessageCallback = jest
                .spyOn(globalMocks.testWebView.webview, "onDidReceiveMessage")
                .mockImplementation((callback: any) => {
                    callback({ command: "GET_LOCALIZATION" });
                });
            (myconsole as any).data = "file contents";
            myconsole.resolveWebviewView(globalMocks.testWebView, {} as any, { isCancellationRequested: false } as any);
            expect(onDidReceiveMessageCallback).toHaveBeenCalled();
            expect(postMessageMock).toHaveBeenCalledWith({ type: "GET_LOCALIZATION", contents: (myconsole as any).data });
        });
        it("handles the get_localization message", async () => {
            const globalMocks = createGlobalMocks();
            const spyReadFile = jest.fn((path, encoding, callback) => {
                callback("error", "file contents");
            });
            Object.defineProperty(fs, "readFile", { value: spyReadFile, configurable: true });
            const myconsole = new ZosConsoleViewProvider({} as any);
            const onDidReceiveMessageCallback = jest
                .spyOn(globalMocks.testWebView.webview, "onDidReceiveMessage")
                .mockImplementation((callback: any) => {
                    callback({ command: "GET_LOCALIZATION" });
                });
            myconsole.resolveWebviewView(globalMocks.testWebView, {} as any, { isCancellationRequested: false } as any);
            expect(onDidReceiveMessageCallback).toHaveBeenCalled();
        });
    });
});
