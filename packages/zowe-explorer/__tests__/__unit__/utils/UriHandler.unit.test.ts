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

import { commands, Uri } from "vscode";
import { ZoweUriHandler } from "../../../src/utils/UriHandler";
import { DatasetFSProvider } from "../../../src/trees/dataset/DatasetFSProvider";

describe("ZoweUriHandler", () => {
    function getBlockMocks() {
        return {
            remoteLookupForResource: jest.spyOn(DatasetFSProvider.instance, "remoteLookupForResource"),
        };
    }

    it("does nothing if the parsed query does not start with a Zowe scheme", async () => {
        const blockMocks = getBlockMocks();
        await ZoweUriHandler.getInstance().handleUri(Uri.parse("vscode://Zowe.vscode-extension-for-zowe?blah-some-unknown-query"));
        expect(blockMocks.remoteLookupForResource).not.toHaveBeenCalled();
    });

    it("calls remoteLookupForResource with the parsed URI if a Zowe resource URI was provided", async () => {
        const blockMocks = getBlockMocks();
        const uri = Uri.parse("vscode://Zowe.vscode-extension-for-zowe?zowe-ds:/lpar.zosmf/TEST.PS");
        await ZoweUriHandler.getInstance().handleUri(uri);
        const zoweUri = Uri.parse(uri.query);
        expect(blockMocks.remoteLookupForResource).toHaveBeenCalledWith(zoweUri);
    });

    it("calls remoteLookupForResource with the parsed URI if a Zowe resource URI was provided", async () => {
        const blockMocks = getBlockMocks();
        blockMocks.remoteLookupForResource.mockResolvedValue({ name: "exampleEntry" } as any);
        const executeCommandSpy = jest.spyOn(commands, "executeCommand");
        const uri = Uri.parse("vscode://Zowe.vscode-extension-for-zowe?zowe-ds:/lpar.zosmf/TEST.PS");
        await ZoweUriHandler.getInstance().handleUri(uri);
        const zoweUri = Uri.parse(uri.query);
        expect(blockMocks.remoteLookupForResource).toHaveBeenCalledWith(zoweUri);
        expect(executeCommandSpy).toHaveBeenCalledWith("vscode.open", zoweUri, { preview: false });
    });
});
