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
import { imperative } from "@zowe/imperative";
import { ProfilesCache } from "../../profiles/ProfilesCache";
import { DirEntry, FileEntry, FilterEntry, IFileSystemEntry, UriFsInfo } from "../types/abstract";
import { Gui } from "../../globals";
import { posix } from "path";

export class FsAbstractUtils {
    /**
     * Returns the metadata for a given URI in the FileSystem.
     * @param uri The "Zowe-compliant" URI to extract info from
     * @returns a metadata type with info about the URI
     */
    public static getInfoForUri(uri: vscode.Uri, profilesCache?: ProfilesCache): UriFsInfo {
        // Paths pointing to the session root will have the format `<scheme>:/{lpar_name}`
        const slashAfterProfilePos = uri.path.indexOf("/", 1);
        const isRoot = slashAfterProfilePos === -1;

        // Determine where to parse profile name based on location of first slash
        const startPathPos = isRoot ? uri.path.length : slashAfterProfilePos;

        // Load profile that matches the parsed name
        const profileName = uri.path.startsWith("/") ? uri.path.substring(1, startPathPos) : uri.path.substring(0, startPathPos);
        const profile = profilesCache?.loadNamedProfile ? profilesCache.loadNamedProfile(profileName) : null;

        return {
            isRoot,
            slashAfterProfilePos,
            profileName,
            profile,
        };
    }

    public static findDocMatchingUri(uri: vscode.Uri): vscode.TextDocument {
        return vscode.workspace.textDocuments.find((doc) => doc.uri.toString() === uri.toString());
    }

    public static async confirmForUnsavedDoc(uri: vscode.Uri): Promise<boolean> {
        const doc = FsAbstractUtils.findDocMatchingUri(uri);
        if (doc?.isDirty) {
            const confirmItem = vscode.l10n.t("Confirm");
            return (
                (await Gui.warningMessage(
                    vscode.l10n.t(
                        "{0} is opened and has pending changes in the editor. By selecting 'Confirm', any unsaved changes will be lost.",
                        posix.basename(doc.fileName)
                    ),
                    {
                        items: [confirmItem],
                        vsCodeOpts: { modal: true },
                    }
                )) === confirmItem
            );
        }

        // either the document doesn't exist or it isn't dirty
        return true;
    }

    public static isDirectoryEntry(entry: IFileSystemEntry): entry is DirEntry {
        return entry != null && entry["type"] === vscode.FileType.Directory;
    }

    public static isFileEntry(entry: IFileSystemEntry): entry is FileEntry {
        return entry != null && entry["type"] === vscode.FileType.File;
    }

    public static isFilterEntry(entry: IFileSystemEntry): entry is FilterEntry {
        return entry != null && "filter" in entry;
    }

    /**
     * Executes the provided API getter and translates "missing API/type" failures
     * into a `FileSystemError.Unavailable` error for users and extenders.
     *
     * @param profile The profile used to resolve the API
     * @param apiGetter A callback that returns the API instance (or throws)
     * @param options.apiName Optional friendly name for the API (e.g. "Common API")
     * @param options.registeredTypes Optional list of registered types to short-circuit early
     * @returns The value from `apiGetter` when successful
     * @throws vscode.FileSystemError.Unavailable when the profile type is not registered or the API getter throws a "non-existing" error
     */
    public static getApiOrThrowUnavailable<T>(
        profile: imperative.IProfileLoaded,
        apiGetter: () => T,
        options?: { apiName?: string; registeredTypes?: string[] }
    ): T {
        const apiName = options?.apiName ?? "API";
        const registeredTypes = options?.registeredTypes;

        if (registeredTypes && profile?.type && !registeredTypes.includes(profile.type)) {
            throw vscode.FileSystemError.Unavailable(
                vscode.l10n.t({
                    message: "Profile type {0} is not registered for {1}. Verify that the contributing extension is installed.",
                    args: [profile.type, apiName],
                    comment: ["Profile type", "API name"],
                })
            );
        }

        try {
            return apiGetter();
        } catch (err) {
            if (err instanceof Error && err.message.includes("non-existing")) {
                throw vscode.FileSystemError.Unavailable(
                    vscode.l10n.t({
                        message: "Profile type {0} does not have a registered {1}. Verify that the contributing extension is installed.",
                        args: [profile?.type, apiName],
                        comment: ["Profile type", "API name"],
                    })
                );
            }
            throw err;
        }
    }
}
