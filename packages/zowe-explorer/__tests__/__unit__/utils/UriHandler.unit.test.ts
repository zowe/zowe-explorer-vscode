import { commands, Uri } from "vscode";
import { ZoweUriHandler } from "../../../src/utils/UriHandler";

describe("ZoweUriHandler", () => {
    function getBlockMocks() {
        return {
            executeCommand: jest.spyOn(commands, "executeCommand"),
        };
    }

    it("does nothing if the parsed query does not start with a Zowe scheme", async () => {
        const blockMocks = getBlockMocks();
        await ZoweUriHandler.getInstance().handleUri(Uri.parse("vscode://Zowe.vscode-extension-for-zowe?blah-some-unknown-query"));
        expect(blockMocks.executeCommand).not.toHaveBeenCalled();
    });

    it("calls vscode.open with the parsed URI if a Zowe resource URI was provided", async () => {
        const blockMocks = getBlockMocks();
        const uri = Uri.parse("vscode://Zowe.vscode-extension-for-zowe?zowe-ds:/lpar.zosmf/TEST.PS");
        await ZoweUriHandler.getInstance().handleUri(uri);
        const zoweUri = Uri.parse(uri.query);
        expect(blockMocks.executeCommand).toHaveBeenCalledWith("vscode.open", zoweUri, { preview: false });
    });
});
