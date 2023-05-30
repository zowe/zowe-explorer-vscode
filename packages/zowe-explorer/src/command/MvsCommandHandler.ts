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
import { ValidProfileEnum, IZoweTreeNode, Gui } from "@zowe/zowe-explorer-api";
import { Profiles } from "../Profiles";
import { FilterDescriptor, FilterItem, errorHandling } from "../utils/ProfilesUtils";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import * as nls from "vscode-nls";
import { ZoweCommandProvider } from "../abstract/ZoweCommandProvider";
import { SettingsConfig } from "../utils/SettingsConfig";
import { ZoweLogger } from "../utils/LoggerUtils";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

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

    private static readonly defaultDialogText: string = localize("command.option.prompt.search", "$(plus) Create a new MVS command");
    private static instance: MvsCommandHandler;
    public outputChannel: vscode.OutputChannel;

    public constructor() {
        super();
        this.outputChannel = Gui.createOutputChannel(localize("issueMvsCommand.outputchannel.title", "Zowe MVS Command"));
    }

    /**
     * Allow the user to submit a MVS Console command to the selected server. Response is written
     * to the output channel.
     * @param session the session the command is to run against (optional) user is prompted if not supplied
     * @param command the command string (optional) user is prompted if not supplied
     */
    public async issueMvsCommand(session?: imperative.Session, command?: string, node?: IZoweTreeNode): Promise<void> {
        ZoweLogger.trace("MvsCommandHandler.issueMvsCommand called.");
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
            const profiles = Profiles.getInstance();
            const allProfiles: imperative.IProfileLoaded[] = profiles.allProfiles;
            const profileNamesList = allProfiles.map((temprofile) => {
                return temprofile.name;
            });
            if (profileNamesList.length) {
                const quickPickOptions: vscode.QuickPickOptions = {
                    placeHolder: localize("issueMvsCommand.quickPickOption", "Select the Profile to use to submit the command"),
                    ignoreFocusOut: true,
                    canPickMany: false,
                };
                const sesName = await Gui.showQuickPick(profileNamesList, quickPickOptions);
                if (sesName === undefined) {
                    Gui.showMessage(localize("issueMvsCommand.undefined.profilename", "Operation Cancelled"));
                    return;
                }
                profile = allProfiles.filter((temprofile) => temprofile.name === sesName)[0];
                if (!node) {
                    await Profiles.getInstance().checkCurrentProfile(profile);
                }
                if (Profiles.getInstance().validProfile !== ValidProfileEnum.INVALID) {
                    session = ZoweExplorerApiRegister.getMvsApi(profile).getSession();
                } else {
                    Gui.errorMessage(localize("issueMvsCommand.checkProfile", "Profile is invalid"));
                    return;
                }
            } else {
                Gui.showMessage(localize("issueMvsCommand.noProfilesLoaded", "No profiles available"));
                return;
            }
        } else {
            profile = node.getProfile();
        }
        try {
            if (Profiles.getInstance().validProfile !== ValidProfileEnum.INVALID) {
                const commandApi = ZoweExplorerApiRegister.getInstance().getCommandApi(profile);
                if (commandApi) {
                    let command1: string = command;
                    if (!command) {
                        command1 = await this.getQuickPick(session && session.ISession ? session.ISession.hostname : "unknown");
                    }
                    await this.issueCommand(profile, command1);
                } else {
                    Gui.errorMessage(localize("issueMvsCommand.checkProfile", "Profile is invalid"));
                    return;
                }
            }
        } catch (error) {
            if (error.toString().includes("non-existing")) {
                ZoweLogger.error(error);
                Gui.errorMessage(localize("issueMvsCommand.apiNonExisting", "Not implemented yet for profile of type: ") + profile.type);
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
            if (globals.ISTHEIA) {
                const options1: vscode.QuickPickOptions = {
                    placeHolder:
                        localize("issueMvsCommand.command.hostname", "Select an MVS command to run against ") +
                        hostname +
                        (alwaysEdit ? localize("issueMvsCommand.command.edit", " (An option to edit will follow)") : ""),
                };
                // get user selection
                const choice = await Gui.showQuickPick([createPick, ...items], options1);
                if (!choice) {
                    Gui.showMessage(localize("issueMvsCommand.options.noselection", "No selection made. Operation cancelled."));
                    return;
                }
                response = choice === createPick ? "" : choice.label;
            } else {
                const quickpick = Gui.createQuickPick();
                quickpick.placeholder = alwaysEdit
                    ? localize("issueMvsCommand.command.hostnameAlt", "Select an MVS command to run against ") +
                      hostname +
                      localize("issueMvsCommand.command.edit", " (An option to edit will follow)")
                    : localize("issueMvsCommand.command.hostname", "Select an MVS command to run immediately against ") + hostname;

                quickpick.items = [createPick, ...items];
                quickpick.ignoreFocusOut = true;
                quickpick.show();
                const choice = await Gui.resolveQuickPick(quickpick);
                quickpick.hide();
                if (!choice) {
                    Gui.showMessage(localize("issueMvsCommand.options.noselection", "No selection made. Operation cancelled."));
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
        }
        if (!response || alwaysEdit) {
            // manually entering a search
            const options2: vscode.InputBoxOptions = {
                prompt: localize("issueMvsCommand.command", "Enter or update the MVS command"),
                value: response,
                valueSelection: response ? [response.length, response.length] : undefined,
            };
            // get user input
            response = await Gui.showInputBox(options2);
            if (!response) {
                Gui.showMessage(localize("issueMvsCommand.enter.command", "No command entered."));
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
                        title: localize("issueMvsCommand.command.submitted", "MVS command submitted."),
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
