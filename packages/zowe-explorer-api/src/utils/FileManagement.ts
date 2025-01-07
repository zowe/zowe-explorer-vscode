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

import { realpathSync } from "fs";
import { platform } from "os";
import { Constants } from "../globals";
import { ImperativeConfig, ConfigUtils } from "@zowe/imperative";
import { IFileSystemEntry, ZoweScheme } from "../fs/types";
import { window, workspace } from "vscode";

export class FileManagement {
    public static permStringToOctal(perms: string): number {
        const permsWithoutDirFlag = perms.substring(1);
        let octalValue = "";
        const offset = 3;
        for (let i = 0; i + offset <= permsWithoutDirFlag.length; i += offset) {
            const group = permsWithoutDirFlag.slice(i, i + offset);
            let groupValue = 0;
            for (const char of group) {
                if (char in Constants.PERM_VALUES) {
                    groupValue += Constants.PERM_VALUES[char];
                }
            }
            octalValue = octalValue.concat(groupValue.toString());
        }

        return parseInt(octalValue);
    }

    public static getZoweDir(): string {
        if (ImperativeConfig.instance.loadedConfig != null) {
            return ImperativeConfig.instance.cliHome;
        }
        return ConfigUtils.getZoweDir();
    }

    public static getFullPath(anyPath: string): string {
        if (platform() === "win32") {
            try {
                return realpathSync.native(anyPath);
            } catch (err) {
                // Fallback to realpathSync below
            }
        }
        return realpathSync(anyPath);
    }

    public static async reloadActiveEditorForProfile(profileName: string): Promise<void> {
        const document = window.activeTextEditor?.document;
        if (
            document != null &&
            (Object.values(ZoweScheme) as string[]).includes(document.uri.scheme) &&
            document.uri.path.startsWith(`/${profileName}/`) &&
            !document.isDirty
        ) {
            const fsEntry = (await workspace.fs.stat(document.uri)) as IFileSystemEntry;
            fsEntry.wasAccessed = false;
            await workspace.fs.readFile(document.uri);
        }
    }

    public static async reloadWorkspacesForProfile(profileName: string): Promise<void> {
        const foldersWithProfile = (workspace.workspaceFolders ?? []).filter(
            (f) => (f.uri.scheme === ZoweScheme.DS || f.uri.scheme === ZoweScheme.USS) && f.uri.path.startsWith(`/${profileName}/`)
        );
        for (const folder of foldersWithProfile) {
            try {
                await workspace.fs.stat(folder.uri.with({ query: "fetch=true" }));
            } catch (err) {
                if (err instanceof Error) {
                    // TODO: Remove console.error in favor of logger
                    // (need to move logger to ZE API)
                    // eslint-disable-next-line no-console
                    console.error("reloadWorkspacesForProfile:", err.message);
                }
            }
        }
    }
}
