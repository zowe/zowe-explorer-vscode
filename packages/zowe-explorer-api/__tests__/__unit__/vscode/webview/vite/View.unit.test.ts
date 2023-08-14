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
                    html: ""
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
            { extensionPath: "test/path" } as vscode.ExtensionContext
        );
        expect(createWebviewPanelSpy).toHaveBeenCalled();
        expect(compileSpy).toHaveBeenCalled();
        (testView as any).dispose();
        expect(testView.panel).toBeUndefined();
    });
})