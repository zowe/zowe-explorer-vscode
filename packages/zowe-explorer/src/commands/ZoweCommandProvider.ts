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
import { Gui, imperative, IZoweTreeNode, PersistenceSchemaEnum, Validation } from "@zowe/zowe-explorer-api";
import { ZowePersistentFilters } from "../tools/ZowePersistentFilters";
import { ZoweLogger } from "../tools/ZoweLogger";
import { SharedContext } from "../trees/shared/SharedContext";
import { Profiles } from "../configuration/Profiles";
import { Constants } from "../configuration/Constants";
import { IconGenerator } from "../icons/IconGenerator";
import { IconUtils } from "../icons/IconUtils";
import { AuthUtils } from "../utils/AuthUtils";
import { ProfileManagement } from "../management/ProfileManagement";
import { Definitions } from "../configuration/Definitions";
import { SettingsConfig } from "../configuration/SettingsConfig";
import { FilterDescriptor, FilterItem } from "../management/FilterManagement";

export abstract class ZoweCommandProvider {
    // eslint-disable-next-line no-magic-numbers
    private static readonly totalFilters: number = 10;
    public profileInstance: Profiles;
    public history: ZowePersistentFilters;
    // Event Emitters used to notify subscribers that the refresh event has fired
    public mOnDidChangeTreeData: vscode.EventEmitter<IZoweTreeNode | void> = new vscode.EventEmitter<IZoweTreeNode | undefined>();
    public readonly onDidChangeTreeData: vscode.Event<IZoweTreeNode | void> = this.mOnDidChangeTreeData.event;

    public constructor() {
        this.history = new ZowePersistentFilters(PersistenceSchemaEnum.Commands, ZoweCommandProvider.totalFilters);
        this.profileInstance = Profiles.getInstance();
    }

    public async selectNodeProfile(cmdTree: Definitions.Trees): Promise<imperative.IProfileLoaded> {
        ZoweLogger.trace("ZoweCommandProvider.selectNodeProfile called.");

        const allProfiles = this.profileInstance.allProfiles;
        const profileNamesList = ProfileManagement.getRegisteredProfileNameList(cmdTree);
        if (profileNamesList.length > 0) {
            const quickPickOptions: vscode.QuickPickOptions = {
                placeHolder: vscode.l10n.t("Select a profile for this command"),
                ignoreFocusOut: true,
                canPickMany: false,
            };
            const sesName = await Gui.showQuickPick(profileNamesList, quickPickOptions);
            if (sesName === undefined) {
                Gui.showMessage(vscode.l10n.t("Operation Cancelled"));
                return;
            }
            const profile = allProfiles.find((tempProfile) => tempProfile.name === sesName);
            await this.profileInstance.checkCurrentProfile(profile);
            if (this.profileInstance.validProfile === Validation.ValidationType.INVALID) {
                Gui.errorMessage(vscode.l10n.t("Profile is invalid"));
                return;
            }
            return profile;
        } else {
            const noProfAvailable = vscode.l10n.t("No profiles available.");
            ZoweLogger.info(noProfAvailable);
            Gui.showMessage(noProfAvailable);
        }
    }

    public async selectServiceProfile(profiles: imperative.IProfileLoaded[] = []): Promise<imperative.IProfileLoaded> {
        ZoweLogger.trace("ZoweCommandProvider.selectServiceProfile called.");
        let profile: imperative.IProfileLoaded;
        if (profiles.length > 1) {
            const profileNamesList = profiles.map((tempProfile) => {
                return tempProfile.name;
            });
            const quickPickOptions: vscode.QuickPickOptions = {
                placeHolder: vscode.l10n.t("Select a profile for this command"),
                ignoreFocusOut: true,
                canPickMany: false,
            };
            const sesName = await Gui.showQuickPick(profileNamesList, quickPickOptions);
            if (sesName === undefined) {
                Gui.showMessage(vscode.l10n.t("Operation Cancelled"));
                return;
            }
            profile = profiles.filter((tempProfile) => tempProfile.name === sesName)[0];
        } else if (profiles.length > 0) {
            profile = profiles[0];
        }
        return profile;
    }

    public abstract defaultDialogText: string;

    public async getQuickPick(hostname: string): Promise<string> {
        ZoweLogger.trace("ZoweCommandProvider.getQuickPick called.");
        let response = "";
        const alwaysEdit: boolean = SettingsConfig.getDirectValue(Constants.SETTINGS_COMMANDS_ALWAYS_EDIT);
        if (this.history.getSearchHistory().length > 0) {
            const createPick = new FilterDescriptor(this.defaultDialogText);
            const items: vscode.QuickPickItem[] = this.history.getSearchHistory().map((element) => new FilterItem({ text: element }));
            const quickpick = Gui.createQuickPick();
            quickpick.placeholder = alwaysEdit
                ? vscode.l10n.t({
                      message: "Select a command to run against {0} (An option to edit will follow)",
                      args: [hostname],
                      comment: ["Host name"],
                  })
                : vscode.l10n.t({
                      message: "Select a command to run immediately against {0}",
                      args: [hostname],
                      comment: ["Host name"],
                  });

            quickpick.items = [createPick, ...items];
            quickpick.ignoreFocusOut = true;
            quickpick.show();
            const choice = await Gui.resolveQuickPick(quickpick);
            quickpick.hide();
            if (!choice) {
                Gui.showMessage(vscode.l10n.t("No selection made. Operation cancelled."));
                return;
            }
            if (choice instanceof FilterDescriptor) {
                if (quickpick.value) {
                    response = quickpick.value;
                }
            } else {
                response = choice.label;
            }
        }
        if (!response || alwaysEdit) {
            // manually entering a search
            const options2: vscode.InputBoxOptions = {
                prompt: vscode.l10n.t("Enter or update the command"),
                value: response,
                valueSelection: response ? [response.length, response.length] : undefined,
            };
            // get user input
            response = await Gui.showInputBox(options2);
            if (!response) {
                Gui.showMessage(vscode.l10n.t("No command entered."));
                return;
            }
        }
        return response;
    }

    /**
     * Called whenever the tree needs to be refreshed, and fires the data change event
     *
     */
    public refreshElement(element: IZoweTreeNode): void {
        ZoweLogger.trace("ZoweCommandProvider.refreshElement called.");
        element.dirty = true;
        this.mOnDidChangeTreeData.fire(element);
    }

    /**
     * Called whenever the tree needs to be refreshed, and fires the data change event
     *
     */
    public refresh(): void {
        ZoweLogger.trace("ZoweCommandProvider.refresh called.");
        this.mOnDidChangeTreeData.fire();
    }

    public async checkCurrentProfile(node: IZoweTreeNode): Promise<Validation.IValidationProfile> {
        ZoweLogger.trace("ZoweCommandProvider.checkCurrentProfile called.");
        const profile = node.getProfile();
        const profileStatus = await Profiles.getInstance().checkCurrentProfile(profile);
        if (profileStatus.status === "inactive") {
            if (
                SharedContext.isSessionNotFav(node) &&
                (node.contextValue.toLowerCase().includes("session") || node.contextValue.toLowerCase().includes("server"))
            ) {
                node.contextValue = node.contextValue.replace(/(?<=.*)(_Active|_Inactive|_Unverified)$/, "");
                node.contextValue = node.contextValue + Constants.INACTIVE_CONTEXT;
                const inactiveIcon = IconGenerator.getIconById(IconUtils.IconId.sessionInactive);
                if (inactiveIcon) {
                    node.iconPath = inactiveIcon.path;
                }
            }

            await AuthUtils.errorHandling(
                vscode.l10n.t({
                    message:
                        "Profile Name {0} is inactive. Please check if your Zowe server is active or if the URL and port in your profile is correct.",
                    args: [profile.name],
                    comment: ["Profile name"],
                })
            );
        } else if (profileStatus.status === "active") {
            if (
                SharedContext.isSessionNotFav(node) &&
                (node.contextValue.toLowerCase().includes("session") || node.contextValue.toLowerCase().includes("server"))
            ) {
                node.contextValue = node.contextValue.replace(/(?<=.*)(_Active|_Inactive|_Unverified)$/, "");
                node.contextValue = node.contextValue + Constants.ACTIVE_CONTEXT;
                const activeIcon = IconGenerator.getIconById(IconUtils.IconId.sessionActive);
                if (activeIcon) {
                    node.iconPath = activeIcon.path;
                }
            }
        } else if (profileStatus.status === "unverified") {
            if (
                SharedContext.isSessionNotFav(node) &&
                (node.contextValue.toLowerCase().includes("session") || node.contextValue.toLowerCase().includes("server"))
            ) {
                node.contextValue = node.contextValue.replace(/(?<=.*)(_Active|_Inactive|_Unverified)$/, "");
                node.contextValue = node.contextValue + Constants.UNVERIFIED_CONTEXT;
            }
        }
        this.refresh();
        return profileStatus;
    }
}
