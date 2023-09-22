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
import { Gui, IZoweTreeNode, imperative } from "@zowe/zowe-explorer-api";
import { ZoweLogger } from "./LoggerUtils";
import { ProfilesUtils } from "./ProfilesUtils";
import * as nls from "vscode-nls";
import { Profiles } from "../Profiles";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

export class ProfileManagement {
    public static async manageProfile(node: IZoweTreeNode): Promise<void> {
        const profile = node.getProfile();
        switch (true) {
            case ProfilesUtils.isProfileUsingBasicAuth(profile): {
                ZoweLogger.debug(`Profile ${profile.name} is using basic authentication.`);
                await this.basicAuthProfileManagement(node);
                break;
            }
            case await ProfilesUtils.isUsingTokenAuth(profile.name): {
                ZoweLogger.debug(`Profile ${profile.name} is using token authentication.`);
                await this.tokenAuthProfileManagement(node);
                break;
            }
            // will need a case for isUsingCertAuth
            default: {
                ZoweLogger.debug(`Profile ${profile.name} authentication method is unkown.`);
                await this.chooseAuthProfileManagement(node);
                break;
            }
        }
    }
    private static AuthQpLabels = {
        update: "update-credentials",
        edit: "edit-profile",
        login: "obtain-token",
        logout: "invalidate-token",
    };
    private static editProfileQpItem: Record<string, vscode.QuickPickItem> = {
        [this.AuthQpLabels.edit]: {
            label: localize("editProfileQpItem.editProfile.qpLabel", "$(pencil) Edit profile"),
            description: localize("editProfileQpItem.editProfile.qpDetail", "Update profile connection information"),
        },
    };
    private static updateBasicAuthQpItem: Record<string, vscode.QuickPickItem> = {
        [this.AuthQpLabels.update]: {
            label: localize("updateBasicAuthQpItem.updateCredentials.qpLabel", "$(refresh) Update Credentials"),
            description: localize("updateBasicAuthQpItem.updateCredentials.qpDetail", "Update stored username and password"),
        },
    };
    private static addBasicAuthQpItem: Record<string, vscode.QuickPickItem> = {
        [this.AuthQpLabels.update]: {
            label: localize("addBasicAuthQpItem.addCredentials.qpLabel", "$(plus) Add Credentials"),
            description: localize("addBasicAuthQpItem.addCredentials.qpDetail", "Add username and password for basic authentication"),
        },
    };
    private static loginQpItem: Record<string, vscode.QuickPickItem> = {
        [this.AuthQpLabels.login]: {
            label: localize("loginQpItem.login.qpLabel", "$(arrow-right) Log in to authentication service"),
            description: localize("loginQpItem.login.qpDetail", "Log in to obtain a new token value"),
        },
    };
    private static logoutQpItem: Record<string, vscode.QuickPickItem> = {
        [this.AuthQpLabels.logout]: {
            label: localize("logoutQpItem.logout.qpLabel", "$(arrow-left) Log out of authentication service"),
            description: localize("logoutQpItem.logout.qpDetail", "Log out to invalidate and remove stored token value"),
        },
    };

    private static async basicAuthProfileManagement(node: IZoweTreeNode): Promise<void> {
        const profile = node.getProfile();
        const selected = await this.setupProfileManagementQp(imperative.SessConstants.AUTH_TYPE_BASIC, profile);
        await this.handleAuthSelection(selected, node, profile);
    }
    private static async tokenAuthProfileManagement(node: IZoweTreeNode): Promise<void> {
        const profile = node.getProfile();
        const selected = await this.setupProfileManagementQp("token", profile);
        await this.handleAuthSelection(selected, node, profile);
    }
    private static async chooseAuthProfileManagement(node: IZoweTreeNode): Promise<void> {
        const profile = node.getProfile();
        const selected = await this.setupProfileManagementQp(null, profile);
        await this.handleAuthSelection(selected, node, profile);
    }
    private static async setupProfileManagementQp(managementType: string, profile: imperative.IProfileLoaded): Promise<vscode.QuickPickItem> {
        const qp = Gui.createQuickPick();
        let quickPickOptions: vscode.QuickPickItem[];
        switch (managementType) {
            case imperative.SessConstants.AUTH_TYPE_BASIC: {
                quickPickOptions = this.basicAuthQp();
                qp.placeholder = this.qpPlaceholders.basicAuth;
                break;
            }
            case "token": {
                quickPickOptions = this.tokenAuthQp(profile);
                qp.placeholder = this.qpPlaceholders.tokenAuth;
                break;
            }
            default: {
                quickPickOptions = this.chooseAuthQp();
                qp.placeholder = this.qpPlaceholders.chooseAuth;
                break;
            }
        }
        let selectedItem = quickPickOptions[0];
        qp.items = quickPickOptions;
        qp.activeItems = [selectedItem];
        qp.show();
        selectedItem = await Gui.resolveQuickPick(qp);
        qp.hide();
        return selectedItem;
    }
    private static async handleAuthSelection(selected: vscode.QuickPickItem, node: IZoweTreeNode, profile: imperative.IProfileLoaded): Promise<void> {
        switch (selected) {
            case this.loginQpItem[this.AuthQpLabels.login]: {
                await Profiles.getInstance().ssoLogin(node, profile.name);
                break;
            }
            case this.editProfileQpItem[this.AuthQpLabels.edit]: {
                await Profiles.getInstance().editSession(profile, profile.name);
                break;
            }
            case this.logoutQpItem[this.AuthQpLabels.logout]: {
                await Profiles.getInstance().ssoLogout(node);
                break;
            }
            case this.updateBasicAuthQpItem[this.AuthQpLabels.update]: {
                await ProfilesUtils.promptCredentials(node);
                break;
            }
            default: {
                Gui.infoMessage(localize("profiles.operation.cancelled", "Operation Cancelled"));
                break;
            }
        }
    }

    private static qpPlaceholders = {
        basicAuth: localize("qpPlaceholders.qp.basic", "Profile is using basic authentication. Choose a profile action."),
        tokenAuth: localize("qpPlaceholders.qp.token", "Profile is using token authentication. Choose a profile action."),
        chooseAuth: localize("qpPlaceholders.qp.choose", "Profile doesn't specify an authentication method. Choose a profile action."),
    };

    private static basicAuthQp(): vscode.QuickPickItem[] {
        const quickPickOptions: vscode.QuickPickItem[] = Object.values(this.updateBasicAuthQpItem);
        quickPickOptions.push(this.editProfileQpItem[this.AuthQpLabels.edit]);
        return quickPickOptions;
    }
    private static tokenAuthQp(profile: imperative.IProfileLoaded): vscode.QuickPickItem[] {
        const quickPickOptions: vscode.QuickPickItem[] = Object.values(this.loginQpItem);
        if (profile.profile.tokenType) {
            quickPickOptions.push(this.logoutQpItem[this.AuthQpLabels.logout]);
        }
        quickPickOptions.push(this.editProfileQpItem[this.AuthQpLabels.edit]);
        return quickPickOptions;
    }
    private static chooseAuthQp(): vscode.QuickPickItem[] {
        const quickPickOptions: vscode.QuickPickItem[] = Object.values(this.addBasicAuthQpItem);
        quickPickOptions.push(this.loginQpItem[this.AuthQpLabels.login]);
        quickPickOptions.push(this.editProfileQpItem[this.AuthQpLabels.edit]);
        return quickPickOptions;
    }
}
