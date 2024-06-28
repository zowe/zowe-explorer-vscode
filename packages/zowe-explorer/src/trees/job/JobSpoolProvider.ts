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
import { ZoweLogger } from "../../tools/ZoweLogger";
import { ZoweExplorerApiRegister } from "../../extending/ZoweExplorerApiRegister";
import { JobSpoolFile } from "./JobSpoolFile";
import type { ZoweSpoolNode } from "./ZoweJobNode";

export class JobSpoolProvider implements vscode.TextDocumentContentProvider {
    // Track files that have been opened previously through the SpoolProvider
    public static files: { [key: string]: JobSpoolFile } = {};

    public static scheme = "zosspool";
    public static onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    public onDidChange = JobSpoolProvider.onDidChangeEmitter.event;

    public async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        ZoweLogger.trace("SpoolProvider.provideTextDocumentContent called.");
        const spoolFile = JobSpoolProvider.files[uri.path];
        if (spoolFile) {
            // Use latest cached content from stored SpoolFile object
            return spoolFile.content;
        }

        // Track the new spool file and pass the event emitter for future updates
        const newSpoolFile = new JobSpoolFile(uri, JobSpoolProvider.onDidChangeEmitter);
        await newSpoolFile.fetchContent();
        JobSpoolProvider.files[uri.path] = newSpoolFile;
        return newSpoolFile.content;
    }

    public dispose(): void {
        JobSpoolProvider.onDidChangeEmitter.dispose();
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
            scheme: JobSpoolProvider.scheme,
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
            const encodedUri = JobSpoolProvider.encodeJobFile(session, spool);
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
        const nodeSpool = (node as ZoweSpoolNode).spool;
        return nodeSpool != null && spool.jobid === nodeSpool.jobid && spool.id === nodeSpool.id;
    }

    public static initializeSpoolProvider(context: vscode.ExtensionContext): void {
        ZoweLogger.trace("SpoolProvider.initializeSpoolProvider called.");
        const spoolProvider = new JobSpoolProvider();
        const providerRegistration = vscode.Disposable.from(
            vscode.workspace.registerTextDocumentContentProvider(JobSpoolProvider.scheme, spoolProvider)
        );
        context.subscriptions.push(spoolProvider, providerRegistration);
    }
}
