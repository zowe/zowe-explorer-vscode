/*
 * This program and the accompanying materials are made available under the terms of the *
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at *
 * https://www.eclipse.org/legal/epl-v20.html                                      *
 *                                                                                 *
 * SPDX-License-Identifier: EPL-2.0                                                *
 *                                                                                 *
 * Copyright Contributors to the Zowe Project.                                     *
 *                                                                                 *
 */

import * as vscode from "vscode";
import { IZoweDatasetTreeNode, IZoweTreeNode, ZoweExplorerApi, ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import { FtpUssApi } from "./ZoweExplorerFtpUssApi";
import { FtpMvsApi } from "./ZoweExplorerFtpMvsApi";
import { FtpJesApi } from "./ZoweExplorerFtpJesApi";
import { CoreUtils } from "@zowe/zos-ftp-for-zowe-cli";
import { IProfileLoaded } from "@zowe/imperative";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function activate(context: vscode.ExtensionContext): void {
    void registerFtpApis();
    vscode.commands.registerCommand("zftp.test", (node) => createTestPdsWithMembers(node));
}

async function createTestPdsWithMembers(node: IZoweDatasetTreeNode): Promise<void> {
    let pdsNode: IZoweDatasetTreeNode; // A partitioned data set (PDS) node
    let newPdsMemberNames: string[] = []; // An array of member names to be used by the new PDS

    // Get the node's context value
    const nodeContext = node.contextValue;
    if (!nodeContext) {
        return; // Exit if nodeContext is undefined
    }
    // Use nodeContext to check if the node is a PDS or a PDS member.
    const isPds = new RegExp("^(pds)").test(nodeContext); // Will be replaced by API in the future
    const isPdsMember = new RegExp("^(member)").test(nodeContext); // Will be replaced by API in the future
    if (!isPds && !isPdsMember) {
        return; // Exit if node is not a PDS or PDS member
    }

    // Get the PDS node depending on whether the PDS itself versus one of its members was selected
    // Then, add the name(s) that for the new PDS
    if (isPdsMember) {
        pdsNode = node.getParent(); // If node is a PDS member, get its parent PDS node.
        newPdsMemberNames.push(node.getLabel()); // Add the label of the selected PDS member to the array
    } else {
        pdsNode = node; // Node is a PDS if not a PDS member
        const pdsChildren = await node.getChildren(); // Get the members belonging to the PDS
        newPdsMemberNames = pdsChildren.map((pdsChild) => {
            return pdsChild.getLabel(); // Add the labels for all members of the selected PDS to the array
        });
    }

    // Get the label for the data set node
    const pdsNodeLabel = pdsNode.getLabel();

    // Get profile for the data set node
    const pdsProfile = pdsNode.getProfile();

    // Run function using values obtained from the node
    await createTestPds(pdsNodeLabel, pdsProfile, newPdsMemberNames);
}

async function createTestPds(node: string, profile: IProfileLoaded, children?: string[]): Promise<void> {
    await vscode.window.showInformationMessage(node);
    const profileName = profile.name;
    if (children) {
        await vscode.window.showInformationMessage(children?.toString());
    }
}

/**
 * Function that searches for the Zowe VS Code Extension and if found
 * registers the additional USS API implementation provided by this extension.
 */

async function registerFtpApis(): Promise<boolean> {
    const zoweExplorerApi = ZoweVsCodeExtension.getZoweExplorerApi("1.15.0");
    if (zoweExplorerApi) {
        zoweExplorerApi.registerUssApi(new FtpUssApi());
        zoweExplorerApi.registerMvsApi(new FtpMvsApi());
        zoweExplorerApi.registerJesApi(new FtpJesApi());

        const meta = await CoreUtils.getProfileMeta();
        await zoweExplorerApi.getExplorerExtenderApi().initForZowe("zftp", meta);
        await zoweExplorerApi.getExplorerExtenderApi().reloadProfiles();

        void vscode.window.showInformationMessage("Zowe Explorer was modified for FTP support.");

        return true;
    }
    void vscode.window.showInformationMessage(
        "Zowe Explorer was not found: either it is not installed or you are using an older version without extensibility API."
    );
    return false;
}
