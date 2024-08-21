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
});
