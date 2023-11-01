import * as vscode from "vscode";
import { Profiles } from "../../Profiles";
import { imperative } from "@zowe/cli";

export type UriFsInfo = {
    isRoot: boolean;
    slashAfterProfilePos: number;
    profile: imperative.IProfileLoaded;
};

/**
 * Returns the metadata for a given URI in the FileSystem.
 * @param uri The "Zowe-compliant" URI to extract info from
 * @returns a metadata type with info about the URI
 */
export function getInfoForUri(uri: vscode.Uri): UriFsInfo {
    // Paths pointing to the session root will have the format `<scheme>:/{lpar_name}`
    const slashAfterProfilePos = uri.path.indexOf("/", 1);
    const isRoot = slashAfterProfilePos === -1;

    // Determine where to parse profile name based on location of first slash
    const startPathPos = isRoot ? uri.path.length : slashAfterProfilePos;

    // Load profile that matches the parsed name
    // Remove "$conflicts" (if present) to get the profile based on the conflict URI
    const profileName = uri.path.substring(1, startPathPos).replace("$conflicts", "");

    return {
        isRoot,
        slashAfterProfilePos,
        profile: Profiles.getInstance().loadNamedProfile(profileName),
    };
}
