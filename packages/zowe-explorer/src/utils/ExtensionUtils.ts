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

import * as vscode from "vscode";
import * as path from "path";
import { Constants } from "../configuration/Constants";
import { ZoweLogger } from "../tools/ZoweLogger";

export class ExtensionUtils {
    public static defineConstants(tempPath: string | undefined): void {
        Constants.SETTINGS_TEMP_FOLDER_LOCATION = tempPath;
        Constants.ZOWETEMPFOLDER = tempPath ? path.join(tempPath, "temp") : path.join(__dirname, "..", "..", "resources", "temp");
        ZoweLogger.info(
            vscode.l10n.t({
                message: `Zowe Explorer's temp folder is located at {0}`,
                args: [Constants.ZOWETEMPFOLDER],
                comment: ["Zowe temp folder"],
            })
        );
        Constants.ZOWE_TMP_FOLDER = path.join(Constants.ZOWETEMPFOLDER, "tmp");
        Constants.USS_DIR = path.join(Constants.ZOWETEMPFOLDER, "_U_");
        Constants.DS_DIR = path.join(Constants.ZOWETEMPFOLDER, "_D_");
    }
}
