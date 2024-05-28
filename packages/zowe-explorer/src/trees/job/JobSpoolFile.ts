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
import * as zosjobs from "@zowe/zos-jobs-for-zowe-sdk";
import { Profiles } from "../../configuration/Profiles";
import { ZoweExplorerApiRegister } from "../../extending/ZoweExplorerApiRegister";
import { ZoweLogger } from "../../tools/ZoweLogger";

export class JobSpoolFile {
    public content: string = "";
    public uri: vscode.Uri;
    private readonly emitter: vscode.EventEmitter<vscode.Uri>;
    private sessionName: string = "";
    private spool: zosjobs.IJobFile;

    public constructor(uri: vscode.Uri, emitter: vscode.EventEmitter<vscode.Uri>) {
        this.uri = uri;
        this.emitter = emitter;
        [this.sessionName, this.spool] = JobSpoolFile.decodeJobFile(this.uri);
    }

    public async fetchContent(): Promise<void> {
        const profile = Profiles.getInstance().loadNamedProfile(this.sessionName);
        const result = await ZoweExplorerApiRegister.getJesApi(profile).getSpoolContentById(this.spool.jobname, this.spool.jobid, this.spool.id);
        this.content = result;

        // Signal to the SpoolProvider that the new contents should be rendered for this file
        this.emitter.fire(this.uri);
    }

    /**
     * Decode the information needed to get the Spool content.
     * @param uri The URI passed to TextDocumentContentProvider
     */
    public static decodeJobFile(uri: vscode.Uri): [string, zosjobs.IJobFile] {
        ZoweLogger.trace("SpoolProvider.decodeJobFile called.");
        const [session, spool] = JSON.parse(uri.query) as [string, zosjobs.IJobFile];
        return [session, spool];
    }
}
