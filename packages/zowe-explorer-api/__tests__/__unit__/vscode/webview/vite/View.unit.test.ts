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

import { Vite } from "../../../../../src/vscode/webview";
import * as vscode from "vscode";
import * as Handlebars from "handlebars";

describe("Vite.View unit tests", () => {
    beforeAll(() => {
        Object.defineProperty(vscode.window, "createWebviewPanel", {
            value: jest.fn().mockReturnValue({
                dispose: jest.fn(),
                webview: {
                    asWebviewUri: jest.fn(),
                    html: "<some html>",
                    onDidReceiveMessage: jest.fn()
                },
                onDidDispose: jest.fn()
            })
        });
        Object.defineProperty(vscode, "Uri", {
            value: {
                file: jest.fn()
            }
        });
    });
    it("Successfully creates a Vite WebView", () => {
        const createWebviewPanelSpy = jest.spyOn(vscode.window, "createWebviewPanel");
        const compileSpy = jest.spyOn(Handlebars, "compile");

        new Vite.View(
            "Test Webview Title",
            "example-folder",
            { extensionPath: "test/path" } as vscode.ExtensionContext
        );
        expect(createWebviewPanelSpy).toHaveBeenCalled();
        expect(compileSpy).toHaveBeenCalled();
    });

    it("Correctly disposes a Vite WebView", () => {
        const createWebviewPanelSpy = jest.spyOn(vscode.window, "createWebviewPanel");
        const compileSpy = jest.spyOn(Handlebars, "compile");

        const testView = new Vite.View(
            "Test Webview Title",
            "example-folder",
            { extensionPath: "test/path" } as vscode.ExtensionContext,
            async (_message: any) => {}
        );
        expect(createWebviewPanelSpy).toHaveBeenCalled();
        expect(compileSpy).toHaveBeenCalled();
        (testView as any).dispose();
        expect(testView.panel).toBeUndefined();
    });

    it("returns HTML content from webview", () => {
        const testView = new Vite.View(
            "Test Webview Title",
            "example-folder",
            { extensionPath: "test/path" } as vscode.ExtensionContext,
            async (_message: any) => {}
        );
        expect(testView.htmlContent).toBe(testView.panel.webview.html);
    })
})