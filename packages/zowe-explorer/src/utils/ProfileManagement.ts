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
        let selected: vscode.QuickPickItem;
        switch (true) {
            case ProfilesUtils.isProfileUsingBasicAuth(profile): {
                ZoweLogger.debug(`Profile ${profile.name} is using basic authentication.`);
                selected = await this.setupProfileManagementQp(imperative.SessConstants.AUTH_TYPE_BASIC, profile);
                break;
            }
            case await ProfilesUtils.isUsingTokenAuth(profile.name): {
                ZoweLogger.debug(`Profile ${profile.name} is using token authentication.`);
                selected = await this.setupProfileManagementQp("token", profile);
                break;
            }
            // will need a case for isUsingCertAuth
            default: {
                ZoweLogger.debug(`Profile ${profile.name} authentication method is unkown.`);
                selected = await this.setupProfileManagementQp(null, profile);
                break;
            }
        }
        await this.handleAuthSelection(selected, node, profile);
    }
    public static AuthQpLabels = {
        update: "update-credentials",
        edit: "edit-profile",
        login: "obtain-token",
        logout: "invalidate-token",
        add: "add-credentials",
    };
    public static basicAuthAddQpItems: Record<string, vscode.QuickPickItem> = {
        [this.AuthQpLabels.add]: {
            label: localize("addBasicAuthQpItem.addCredentials.qpLabel", "$(plus) Add Credentials"),
            description: localize("addBasicAuthQpItem.addCredentials.qpDetail", "Add username and password for basic authentication"),
        },
    };
    public static basicAuthUpdateQpItems: Record<string, vscode.QuickPickItem> = {
        [this.AuthQpLabels.update]: {
            label: localize("updateBasicAuthQpItem.updateCredentials.qpLabel", "$(refresh) Update Credentials"),
            description: localize("updateBasicAuthQpItem.updateCredentials.qpDetail", "Update stored username and password"),
        },
    };
    public static otherProfileQpItems: Record<string, vscode.QuickPickItem> = {
        [this.AuthQpLabels.edit]: {
            label: localize("editProfileQpItem.editProfile.qpLabel", "$(pencil) Edit profile"),
            description: localize("editProfileQpItem.editProfile.qpDetail", "Update profile connection information"),
        },
    };
    public static tokenAuthLoginQpItem: Record<string, vscode.QuickPickItem> = {
        [this.AuthQpLabels.login]: {
            label: localize("loginQpItem.login.qpLabel", "$(arrow-right) Log in to authentication service"),
            description: localize("loginQpItem.login.qpDetail", "Log in to obtain a new token value"),
        },
    };
    public static tokenAuthLogoutQpItem: Record<string, vscode.QuickPickItem> = {
        [this.AuthQpLabels.logout]: {
            label: localize("logoutQpItem.logout.qpLabel", "$(arrow-left) Log out of authentication service"),
            description: localize("logoutQpItem.logout.qpDetail", "Log out to invalidate and remove stored token value"),
        },
    };
    private static async setupProfileManagementQp(managementType: string, profile: imperative.IProfileLoaded): Promise<vscode.QuickPickItem> {
        const qp = Gui.createQuickPick();
        let quickPickOptions: vscode.QuickPickItem[];
        const placeholders = this.getQpPlaceholders(profile);
        switch (managementType) {
            case imperative.SessConstants.AUTH_TYPE_BASIC: {
                quickPickOptions = this.basicAuthQp();
                qp.placeholder = placeholders.basicAuth;
                break;
            }
            case "token": {
                quickPickOptions = this.tokenAuthQp(profile);
                qp.placeholder = placeholders.tokenAuth;
                break;
            }
            default: {
                quickPickOptions = this.chooseAuthQp();
                qp.placeholder = placeholders.chooseAuth;
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
            case this.basicAuthAddQpItems[this.AuthQpLabels.add]: {
                await ProfilesUtils.promptCredentials(node);
                break;
            }
            case this.otherProfileQpItems[this.AuthQpLabels.edit]: {
                await Profiles.getInstance().editSession(profile, profile.name);
                break;
            }
            case this.tokenAuthLoginQpItem[this.AuthQpLabels.login]: {
                await Profiles.getInstance().ssoLogin(node, profile.name);
                break;
            }
            case this.tokenAuthLogoutQpItem[this.AuthQpLabels.logout]: {
                await Profiles.getInstance().ssoLogout(node);
                break;
            }
            case this.basicAuthUpdateQpItems[this.AuthQpLabels.update]: {
                await ProfilesUtils.promptCredentials(node);
                break;
            }
            default: {
                Gui.infoMessage(localize("profiles.operation.cancelled", "Operation Cancelled"));
                break;
            }
        }
    }

    private static getQpPlaceholders(profile: imperative.IProfileLoaded): { basicAuth: string; tokenAuth: string; chooseAuth: string } {
        return {
            basicAuth: localize("qpPlaceholders.qp.basic", "Profile {0} is using basic authentication. Choose a profile action.", profile.name),
            tokenAuth: localize("qpPlaceholders.qp.token", "Profile {0} is using token authentication. Choose a profile action.", profile.name),
            chooseAuth: localize(
                "qpPlaceholders.qp.choose",
                "Profile {0} doesn't specify an authentication method. Choose a profile action.",
                profile.name
            ),
        };
    }

    private static basicAuthQp(): vscode.QuickPickItem[] {
        const quickPickOptions: vscode.QuickPickItem[] = Object.values(this.basicAuthUpdateQpItems);
        quickPickOptions.push(this.otherProfileQpItems[this.AuthQpLabels.edit]);
        return quickPickOptions;
    }
    private static tokenAuthQp(profile: imperative.IProfileLoaded): vscode.QuickPickItem[] {
        const quickPickOptions: vscode.QuickPickItem[] = Object.values(this.tokenAuthLoginQpItem);
        if (profile.profile.tokenType) {
            quickPickOptions.push(this.tokenAuthLogoutQpItem[this.AuthQpLabels.logout]);
        }
        quickPickOptions.push(this.otherProfileQpItems[this.AuthQpLabels.edit]);
        return quickPickOptions;
    }
    private static chooseAuthQp(): vscode.QuickPickItem[] {
        const quickPickOptions: vscode.QuickPickItem[] = Object.values(this.basicAuthAddQpItems);
        quickPickOptions.push(this.tokenAuthLoginQpItem[this.AuthQpLabels.login]);
        quickPickOptions.push(this.otherProfileQpItems[this.AuthQpLabels.edit]);
        return quickPickOptions;
    }
}
