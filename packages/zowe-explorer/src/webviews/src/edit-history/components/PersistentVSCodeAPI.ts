import { WebviewApi } from "vscode-webview";

export default class PersistentVSCodeAPI {
    private static vscodeAPI = acquireVsCodeApi();

    public static getVSCodeAPI(): WebviewApi<unknown> {
        return this.vscodeAPI;
    }
}
