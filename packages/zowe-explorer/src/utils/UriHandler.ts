import { commands, ProviderResult, Uri, UriHandler } from "vscode";
import { ZoweScheme } from "../../../zowe-explorer-api/src";

export class ZoweUriHandler implements UriHandler {
    private static instance: ZoweUriHandler = null;
    private constructor() {}

    public static getInstance(): ZoweUriHandler {
        if (ZoweUriHandler.instance == null) {
            ZoweUriHandler.instance = new ZoweUriHandler();
        }

        return ZoweUriHandler.instance;
    }

    public handleUri(uri: Uri): ProviderResult<void> {
        const parsedUri = Uri.parse(uri.query);
        if (!Object.values(ZoweScheme).some((scheme) => scheme === parsedUri.scheme)) {
            return;
        }
        return commands.executeCommand("vscode.open", parsedUri, { preview: false });
    }
}
