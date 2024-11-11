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

import { commands, ProviderResult, Uri, UriHandler } from "vscode";
import { ZoweScheme } from "../../../zowe-explorer-api/src";
import { DatasetFSProvider } from "../trees/dataset/DatasetFSProvider";
import { UssFSProvider } from "../trees/uss/UssFSProvider";
import { ZoweLogger } from "../tools/ZoweLogger";

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
        if (uri.scheme === ZoweScheme.Jobs || !Object.values(ZoweScheme).some((scheme) => scheme === parsedUri.scheme)) {
            return;
        }

        const fsProvider = parsedUri.scheme === ZoweScheme.DS ? DatasetFSProvider.instance : UssFSProvider.instance;
        return fsProvider
            .remoteLookupForResource(parsedUri)
            .then(async (_entry) => {
                await commands.executeCommand("vscode.open", parsedUri, { preview: false });
            })
            .catch((err) => {
                if (err instanceof Error) {
                    ZoweLogger.error(`Failed to open external URL: ${err.message}`);
                }
            });
    }
}
