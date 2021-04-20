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
import { Logger } from "@zowe/imperative";
import * as globals from "../globals";
import { getIconById, IconId } from "../generators/icons";
import * as contextually from "../shared/context";
import { IZoweTreeNode } from "@zowe/zowe-explorer-api";
import { Profiles } from "../Profiles";
import { errorHandling } from "../utils/ProfilesUtils";

import * as nls from "vscode-nls";
import { PersistentFilters } from "../PersistentFilters";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

export class ZoweCommandProvider {
    private static readonly totalFilters: number = 10;
    private static readonly persistenceSchema: string = "Zowe Commands: History";

    public outputChannel: vscode.OutputChannel;
    public history: PersistentFilters;
    // Event Emitters used to notify subscribers that the refresh event has fired
    public mOnDidChangeTreeData: vscode.EventEmitter<IZoweTreeNode | void> = new vscode.EventEmitter<
        IZoweTreeNode | undefined
    >();
    public readonly onDidChangeTreeData: vscode.Event<IZoweTreeNode | void> = this.mOnDidChangeTreeData.event;
    private log: Logger = Logger.getAppLogger();

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel(
            localize("issueCommand.outputchannel.title", "Zowe Command")
        );
        this.history = new PersistentFilters(ZoweCommandProvider.persistenceSchema, ZoweCommandProvider.totalFilters);
    }

    /**
     * Called whenever the tree needs to be refreshed, and fires the data change event
     *
     */
    public async refreshElement(element: IZoweTreeNode): Promise<void> {
        element.dirty = true;
        this.mOnDidChangeTreeData.fire(element);
    }

    /**
     * Called whenever the tree needs to be refreshed, and fires the data change event
     *
     */
    public async refresh(): Promise<void> {
        this.mOnDidChangeTreeData.fire();
    }

    public async checkCurrentProfile(node: IZoweTreeNode) {
        const profile = node.getProfile();
        const profileStatus = await Profiles.getInstance().checkCurrentProfile(profile);
        if (profileStatus.status === "inactive") {
            if (
                contextually.isSessionNotFav(node) &&
                (node.contextValue.toLowerCase().includes("session") ||
                    node.contextValue.toLowerCase().includes("server"))
            ) {
                node.contextValue = node.contextValue.replace(/(?<=.*)(_Active|_Inactive|_Unverified)$/, "");
                node.contextValue = node.contextValue + globals.INACTIVE_CONTEXT;
                const inactiveIcon = getIconById(IconId.sessionInactive);
                if (inactiveIcon) {
                    node.iconPath = inactiveIcon.path;
                }
            }

            await errorHandling(
                localize("validateProfiles.invalid1", "Profile Name ") +
                    profile.name +
                    localize(
                        "validateProfiles.invalid2",
                        " is inactive. Please check if your Zowe server is active or if the URL and port in your profile is correct."
                    )
            );
            this.log.debug(
                localize("validateProfiles.invalid1", "Profile Name ") +
                    node.getProfileName() +
                    localize(
                        "validateProfiles.invalid2",
                        " is inactive. Please check if your Zowe server is active or if the URL and port in your profile is correct."
                    )
            );
        } else if (profileStatus.status === "active") {
            if (
                contextually.isSessionNotFav(node) &&
                (node.contextValue.toLowerCase().includes("session") ||
                    node.contextValue.toLowerCase().includes("server"))
            ) {
                node.contextValue = node.contextValue.replace(/(?<=.*)(_Active|_Inactive|_Unverified)$/, "");
                node.contextValue = node.contextValue + globals.ACTIVE_CONTEXT;
                const activeIcon = getIconById(IconId.sessionActive);
                if (activeIcon) {
                    node.iconPath = activeIcon.path;
                }
            }
        } else if (profileStatus.status === "unverified") {
            if (
                contextually.isSessionNotFav(node) &&
                (node.contextValue.toLowerCase().includes("session") ||
                    node.contextValue.toLowerCase().includes("server"))
            ) {
                node.contextValue = node.contextValue.replace(/(?<=.*)(_Active|_Inactive|_Unverified)$/, "");
                node.contextValue = node.contextValue + globals.UNVERIFIED_CONTEXT;
            }
        }
        await this.refresh();
    }
}
