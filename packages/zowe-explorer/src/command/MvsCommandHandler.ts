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
import { imperative } from "@zowe/cli";
import * as globals from "../globals";
import { Validation, IZoweTreeNode, Gui } from "@zowe/zowe-explorer-api";
import { Profiles } from "../Profiles";
import { FilterDescriptor, FilterItem, errorHandling } from "../utils/ProfilesUtils";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { ZoweCommandProvider } from "../abstract/ZoweCommandProvider";
import { SettingsConfig } from "../utils/SettingsConfig";
import { ZoweLogger } from "../utils/LoggerUtils";
import { ProfileManagement } from "../utils/ProfileManagement";

/**
 * Provides a class that manages submitting a command on the server
 *
 * @export
 * @class MvsCommandHandler
 */
export class MvsCommandHandler extends ZoweCommandProvider {
    /**
     * Implements access singleton
     * for {MvsCommandHandler}.
     *
     * @returns {MvsCommandHandler}
     */
    public static getInstance(): MvsCommandHandler {
        if (!MvsCommandHandler.instance) {
            MvsCommandHandler.instance = new MvsCommandHandler();
        }
        return this.instance;
    }

    private static readonly defaultDialogText: string = vscode.l10n.t("$(plus) Create a new MVS command");
    private static instance: MvsCommandHandler;
    public outputChannel: vscode.OutputChannel;

    public constructor() {
        super();
        this.outputChannel = Gui.createOutputChannel(vscode.l10n.t("Zowe MVS Command"));
    }

    /**
     * Allow the user to submit a MVS Console command to the selected server. Response is written
     * to the output channel.
     * @param session the session the command is to run against (optional) user is prompted if not supplied
     * @param command the command string (optional) user is prompted if not supplied
     */
    public async issueMvsCommand(session?: imperative.Session, command?: string, node?: IZoweTreeNode): Promise<void> {
        ZoweLogger.trace("MvsCommandHandler.issueMvsCommand called.");
        const profiles = Profiles.getInstance();
        let profile: imperative.IProfileLoaded;
        if (node) {
            await this.checkCurrentProfile(node);
            if (!session) {
                session = ZoweExplorerApiRegister.getMvsApi(node.getProfile()).getSession();
                if (!session) {
                    return;
                }
            }
        }
        if (!session) {
            const allProfiles = profiles.allProfiles;
            const profileNamesList = ProfileManagement.getRegisteredProfileNameList(globals.Trees.MVS);
            if (profileNamesList.length) {
                const quickPickOptions: vscode.QuickPickOptions = {
                    placeHolder: vscode.l10n.t("Select the Profile to use to submit the command"),
                    ignoreFocusOut: true,
                    canPickMany: false,
                };
                const sesName = await Gui.showQuickPick(profileNamesList, quickPickOptions);
                if (sesName === undefined) {
                    Gui.showMessage(vscode.l10n.t("Operation Cancelled"));
                    return;
                }
                profile = allProfiles.filter((temprofile) => temprofile.name === sesName)[0];
                if (!node) {
                    await profiles.checkCurrentProfile(profile);
                }
                if (profiles.validProfile !== Validation.ValidationType.INVALID) {
                    session = ZoweExplorerApiRegister.getMvsApi(profile).getSession();
                } else {
                    Gui.errorMessage(vscode.l10n.t("Profile is invalid"));
                    return;
                }
            } else {
                Gui.showMessage(vscode.l10n.t("No profiles available"));
                return;
            }
        } else {
            profile = node.getProfile();
        }
        try {
            if (profiles.validProfile !== Validation.ValidationType.INVALID) {
                const commandApi = ZoweExplorerApiRegister.getInstance().getCommandApi(profile);
                if (commandApi) {
                    let command1: string = command;
                    if (!command) {
                        command1 = await this.getQuickPick(session && session.ISession ? session.ISession.hostname : "unknown");
                    }
                    await this.issueCommand(profile, command1);
                } else {
                    Gui.errorMessage(vscode.l10n.t("Profile is invalid"));
                    return;
                }
            }
        } catch (error) {
            if (error.toString().includes("non-existing")) {
                ZoweLogger.error(error);
                Gui.errorMessage(
                    vscode.l10n.t({
                        message: "Not implemented yet for profile of type: {0}",
                        args: [profile.type],
                        comment: ["Profile type"],
                    })
                );
            } else {
                await errorHandling(error, profile.name);
            }
        }
    }

    private async getQuickPick(hostname: string): Promise<string> {
        ZoweLogger.trace("MvsCommandHandler.getQuickPick called.");
        let response = "";
        const alwaysEdit: boolean = SettingsConfig.getDirectValue(globals.SETTINGS_COMMANDS_ALWAYS_EDIT);
        if (this.history.getSearchHistory().length > 0) {
            const createPick = new FilterDescriptor(MvsCommandHandler.defaultDialogText);
            const items: vscode.QuickPickItem[] = this.history.getSearchHistory().map((element) => new FilterItem({ text: element }));
            const quickpick = Gui.createQuickPick();
            quickpick.placeholder = alwaysEdit
                ? vscode.l10n.t({
                      message: "Select an MVS command to run against {0} (An option to edit will follow)",
                      args: [hostname],
                      comment: ["Host name"],
                  })
                : vscode.l10n.t({
                      message: "Select an MVS command to run immediately against {0}",
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
                prompt: vscode.l10n.t("Enter or update the MVS command"),
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
     * Allow the user to submit an MVS Console command to the selected server. Response is written
     * to the output channel.
     * @param session The Session object
     * @param command the command string
     */
    private async issueCommand(profile: imperative.IProfileLoaded, command: string): Promise<void> {
        ZoweLogger.trace("MvsCommandHandler.issueCommand called.");
        try {
            if (command) {
                // If the user has started their command with a / then remove it
                if (command.startsWith("/")) {
                    command = command.substring(1);
                }
                this.outputChannel.appendLine(`> ${command}`);
                const submitResponse = await Gui.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: vscode.l10n.t("MVS command submitted."),
                    },
                    () => {
                        return ZoweExplorerApiRegister.getCommandApi(profile).issueMvsCommand(command);
                    }
                );
                if (submitResponse.success) {
                    this.outputChannel.appendLine(submitResponse.commandResponse);
                    this.outputChannel.show(true);
                }
            }
        } catch (error) {
            await errorHandling(error, profile.name);
        }
        this.history.addSearchHistory(command);
    }
}
