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
import { IZoweJobTreeNode } from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../extending";
import { Profiles } from "../configuration";
import { ZoweLogger } from "../tools";

export class SpoolProvider implements vscode.TextDocumentContentProvider {
    // Track files that have been opened previously through the SpoolProvider
    public static files: { [key: string]: SpoolFile } = {};

    public static scheme = "zosspool";
    public static onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    public onDidChange = SpoolProvider.onDidChangeEmitter.event;

    public async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        ZoweLogger.trace("SpoolProvider.provideTextDocumentContent called.");
        const spoolFile = SpoolProvider.files[uri.path];
        if (spoolFile) {
            // Use latest cached content from stored SpoolFile object
            return spoolFile.content;
        }

        // Track the new spool file and pass the event emitter for future updates
        const newSpoolFile = new SpoolFile(uri, SpoolProvider.onDidChangeEmitter);
        await newSpoolFile.fetchContent();
        SpoolProvider.files[uri.path] = newSpoolFile;
        return newSpoolFile.content;
    }

    public dispose(): void {
        SpoolProvider.onDidChangeEmitter.dispose();
    }

    /**
     * (use {@link toUniqueJobFileUri} instead to use VSCode's cache invalidation)
     *
     * Encode the information needed to get the Spool content.
     *
     * @param session The name of the Zowe profile to use to get the Spool Content
     * @param spool The IJobFile to get the spool content for.
     */
    public static encodeJobFile(session: string, spool: zosjobs.IJobFile): vscode.Uri {
        ZoweLogger.trace("SpoolProvider.encodeJobFile called.");
        const query = JSON.stringify([session, spool]);

        const spoolSegments = [spool.jobname, spool.jobid, spool.stepname, spool.procstep, spool.ddname, spool.id?.toString()];

        const path = spoolSegments.filter((v) => v && v.length).join(".");

        return vscode.Uri.parse("").with({
            scheme: SpoolProvider.scheme,
            path,
            query,
        });
    }

    /**
     * Encode the information needed to get the Spool content with support of the built in VSCode cache invalidation.
     *
     * VSCode built in cache will be applied automatically in case of several requests for the same URI,
     * so consumers can control the amount of spool content requests by specifying different unique fragments
     *
     * Should be used carefully because of the possible memory leaks.
     *
     * @param session The name of the Zowe profile to use to get the Spool Content
     * @param spool The IJobFile to get the spool content for.
     * @param uniqueFragment The unique fragment of the encoded uri (can be timestamp, for example)
     */
    public static toUniqueJobFileUri =
        (session: string, spool: zosjobs.IJobFile) =>
        (uniqueFragment: string): vscode.Uri => {
            ZoweLogger.trace("SpoolProvider.toUniqueJobFileUri called.");
            const encodedUri = SpoolProvider.encodeJobFile(session, spool);
            return encodedUri.with({
                fragment: uniqueFragment,
            });
        };

    /**
     * Gather all spool files for a given job
     * @param node Selected node for which to extract all spool files
     * @returns Array of spool files
     */
    public static async getSpoolFiles(node: IZoweJobTreeNode): Promise<zosjobs.IJobFile[]> {
        ZoweLogger.trace("SpoolProvider.getSpoolFiles called.");
        if (node.job == null) {
            return [];
        }
        let spools: zosjobs.IJobFile[] = [];
        spools = await ZoweExplorerApiRegister.getJesApi(node.getProfile()).getSpoolFiles(node.job.jobname, node.job.jobid);
        spools = spools
            // filter out all the objects which do not seem to be correct Job File Document types
            // see an issue #845 for the details
            .filter((item) => !(item.id === undefined && item.ddname === undefined && item.stepname === undefined));
        return spools;
    }

    /**
     * Determine whether or not a spool file matches a selected node
     *
     * @param spool Individual spool file to match the node with
     * @param node Selected node
     * @returns true if the selected node matches the spool file, false otherwise
     */
    public static matchSpool(spool: zosjobs.IJobFile, node: IZoweJobTreeNode): boolean {
        return (
            `${spool.stepname}:${spool.ddname} - ${spool["record-count"]}` === node.label.toString() ||
            `${spool.stepname}:${spool.ddname} - ${spool.procstep}` === node.label.toString()
        );
    }

    /**
     * Decode the information needed to get the Spool content.
     *
     * @param uri The URI passed to TextDocumentContentProvider
     */
    public static decodeJobFile(uri: vscode.Uri): [string, zosjobs.IJobFile] {
        ZoweLogger.trace("SpoolProvider.decodeJobFile called.");
        const [session, spool] = JSON.parse(uri.query) as [string, zosjobs.IJobFile];
        return [session, spool];
    }

    public static initializeSpoolProvider(context: vscode.ExtensionContext): void {
        ZoweLogger.trace("SpoolProvider.initializeSpoolProvider called.");
        const spoolProvider = new SpoolProvider();
        const providerRegistration = vscode.Disposable.from(
            vscode.workspace.registerTextDocumentContentProvider(SpoolProvider.scheme, spoolProvider)
        );
        context.subscriptions.push(spoolProvider, providerRegistration);
    }
}

/**
 * Manage spool content for each file that is opened through the SpoolProvider.
 */
export class SpoolFile {
    public content: string = "";
    private readonly emitter: vscode.EventEmitter<vscode.Uri>;
    private sessionName: string = "";
    private spool: zosjobs.IJobFile;
    public uri: vscode.Uri;

    public constructor(uri: vscode.Uri, emitter: vscode.EventEmitter<vscode.Uri>) {
        this.uri = uri;
        this.emitter = emitter;
        [this.sessionName, this.spool] = SpoolProvider.decodeJobFile(this.uri);
    }

    /**
     * Caches content changes to the spool file for the SpoolProvider to display.
     */
    public async fetchContent(): Promise<void> {
        const profile = Profiles.getInstance().loadNamedProfile(this.sessionName);
        const result = await ZoweExplorerApiRegister.getJesApi(profile).getSpoolContentById(this.spool.jobname, this.spool.jobid, this.spool.id);
        this.content = result;

        // Signal to the SpoolProvider that the new contents should be rendered for this file
        this.emitter.fire(this.uri);
    }
}
