import * as vscode from "vscode";
import * as zowe from "@brightside/core";
import { loadNamedProfile } from "./ProfileLoader";

export default class SpoolProvider implements vscode.TextDocumentContentProvider {

    public static scheme = "zosspool";

    private mOnDidChange = new vscode.EventEmitter<vscode.Uri>();

    public provideTextDocumentContent(uri: vscode.Uri): string | Thenable<string> {
        const [sessionName, spool] = decodeJobFile(uri);
        const zosMfProfile = loadNamedProfile(sessionName);
        const session = zowe.ZosmfSession.createBasicZosmfSession(zosMfProfile.profile);
        return zowe.GetJobs.getSpoolContentById(session, spool.jobname, spool.jobid, spool.id);
    }

    public dispose() {
        this.mOnDidChange.dispose();
    }
}

/**
 * Encode the information needed to get the Spool content.
 *
 * @param session The name of the Zowe profile to use to get the Spool Content
 * @param spool The IJobFile to get the spool content for.
 */
export function encodeJobFile(session: string, spool: zowe.IJobFile): vscode.Uri {
    const query = JSON.stringify([session, spool]);
    return vscode.Uri.parse(`${SpoolProvider.scheme}:${spool.jobname}.${spool.jobid}.${spool.ddname}?${query}`);
}

/**
 * Decode the information needed to get the Spool content.
 *
 * @param uri The URI passed to TextDocumentContentProvider
 */
export function decodeJobFile(uri: vscode.Uri): [string, zowe.IJobFile] {
    const [session, spool] = JSON.parse(uri.query) as [string, zowe.IJobFile];
    return [session, spool];
}
