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

import { WebView } from "../../../../src/vscode/ui";
import * as vscode from "vscode";
import * as Mustache from "mustache";

describe("WebView unit tests", () => {
    beforeAll(() => {
        Object.defineProperty(vscode.window, "createWebviewPanel", {
            value: jest.fn().mockReturnValue({
                dispose: jest.fn(),
                webview: {
                    asWebviewUri: jest.fn(),
                    html: "<some html>",
                    onDidReceiveMessage: jest.fn(),
                },
                onDidDispose: jest.fn(),
            }),
        });
    });
    it("Successfully creates a WebView", () => {
        const createWebviewPanelSpy = jest.spyOn(vscode.window, "createWebviewPanel");
        const renderSpy = jest.spyOn(Mustache as any, "render");

        try {
            new WebView("Test Webview Title", "example-folder", { extensionPath: "test/path" } as vscode.ExtensionContext);
        } catch (err) {
            throw new Error("Failed to create WebView");
        }
        expect(createWebviewPanelSpy).toHaveBeenCalled();
        expect(renderSpy).toHaveBeenCalled();
    });

    it("Correctly disposes a WebView", () => {
        const createWebviewPanelSpy = jest.spyOn(vscode.window, "createWebviewPanel");
        const renderSpy = jest.spyOn(Mustache as any, "render");

        const disposeMock = jest.fn();
        const disposable = new vscode.Disposable(disposeMock);

        const testView = new WebView("Test Webview Title", "example-folder", { extensionPath: "test/path" } as vscode.ExtensionContext, {
            onDidReceiveMessage: async (_message: any) => {},
        });
        (testView as any).disposables = [disposable];
        expect(createWebviewPanelSpy).toHaveBeenCalled();
        expect(renderSpy).toHaveBeenCalled();
        (testView as any).dispose();
        expect(testView.panel).toBeUndefined();
        expect(disposeMock).toHaveBeenCalledTimes(1);
    });

    it("returns HTML content from WebView", () => {
        const testView = new WebView("Test Webview Title", "example-folder", { extensionPath: "test/path" } as vscode.ExtensionContext, {
            onDidReceiveMessage: async (_message: any) => {},
        });
        expect(testView.htmlContent).toBe(testView.panel.webview.html);
    });

    it("sets viewColumn from WebViewOpts", () => {
        const createWebviewPanelSpy = jest.spyOn(vscode.window, "createWebviewPanel");
        const viewColumn = vscode.ViewColumn.One;
        new WebView("Test Webview Title", "example-folder", { extensionPath: "test/path" } as vscode.ExtensionContext, {
            viewColumn,
        });
        expect(createWebviewPanelSpy).toHaveBeenCalledWith(
            "ZEAPIWebview",
            "Test Webview Title",
            viewColumn,
            expect.objectContaining({
                enableScripts: true,
                retainContextWhenHidden: false,
            })
        );
    });

    it("sets iconPath from string in WebViewOpts", () => {
        const iconPath = "test/path/to/icon.png";
        const testView = new WebView("Test Webview Title", "example-folder", { extensionPath: "test/path" } as vscode.ExtensionContext, {
            iconPath,
        });
        expect(testView.panel.iconPath).toEqual(vscode.Uri.file(iconPath));
    });

    it("sets iconPath from Uri in WebViewOpts", () => {
        const iconUri = vscode.Uri.file("test/path/to/icon.png");
        const testView = new WebView("Test Webview Title", "example-folder", { extensionPath: "test/path" } as vscode.ExtensionContext, {
            iconPath: iconUri,
        });
        expect(testView.panel.iconPath).toBe(iconUri);
    });

    it("sets iconPath from light/dark object in WebViewOpts", () => {
        const light = "test/path/to/light.png";
        const dark = vscode.Uri.file("test/path/to/dark.png");
        const testView = new WebView("Test Webview Title", "example-folder", { extensionPath: "test/path" } as vscode.ExtensionContext, {
            iconPath: { light, dark },
        });
        expect((testView.panel.iconPath as any).light).toEqual(vscode.Uri.file(light));
        expect((testView.panel.iconPath as any).dark).toBe(dark);
    });
});
