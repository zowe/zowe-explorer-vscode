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
import * as globals from "../globals";
import { Gui, Validation, imperative, IZoweTreeNode } from "@zowe/zowe-explorer-api";
import { Profiles } from "../Profiles";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { errorHandling, FilterDescriptor, FilterItem } from "../utils/ProfilesUtils";
import { ZoweCommandProvider } from "../abstract/ZoweCommandProvider";
import * as zostso from "@zowe/zos-tso-for-zowe-sdk";
import { SettingsConfig } from "../utils/SettingsConfig";
import { ZoweLogger } from "../utils/LoggerUtils";
import { ProfileManagement } from "../utils/ProfileManagement";

/**
 * Provides a class that manages submitting a TSO command on the server
 *
 * @export
 * @class TSOCommandHandler
 */
export class TsoCommandHandler extends ZoweCommandProvider {
    /**
     * Implements access singleton
     * for {TsoCommandHandler}.
     *
     * @returns {TsoCommandHandler}
     */
    public static getInstance(): TsoCommandHandler {
        if (!TsoCommandHandler.instance) {
            TsoCommandHandler.instance = new TsoCommandHandler();
        }
        return this.instance;
    }

    private static readonly defaultDialogText: string = vscode.l10n.t("$(plus) Create a new TSO command");
    private static instance: TsoCommandHandler;
    public outputChannel: vscode.OutputChannel;

    public constructor() {
        super();
        this.outputChannel = Gui.createOutputChannel(vscode.l10n.t("Zowe TSO Command"));
    }

    /**
     * Allow the user to submit a TSO command to the selected server. Response is written
     * to the output channel.
     * @param session the session the command is to run against (optional) user is prompted if not supplied
     * @param command the command string (optional) user is prompted if not supplied
     */
    public async issueTsoCommand(session?: imperative.Session, command?: string, node?: IZoweTreeNode): Promise<void> {
        ZoweLogger.trace("TsoCommandHandler.issueTsoCommand called.");
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
            const profileNamesList = ProfileManagement.getRegisteredProfileNameList(globals.Trees.MVS);
            if (profileNamesList.length > 0) {
                const quickPickOptions: vscode.QuickPickOptions = {
                    placeHolder: vscode.l10n.t("Select the Profile to use to submit the TSO command"),
                    ignoreFocusOut: true,
                    canPickMany: false,
                };
                const sesName = await Gui.showQuickPick(profileNamesList, quickPickOptions);
                if (sesName === undefined) {
                    Gui.showMessage(vscode.l10n.t("Operation Cancelled"));
                    return;
                }
                const allProfiles = profiles.allProfiles;
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
                    let tsoParams: zostso.IStartTsoParms;
                    if (profile.type === "zosmf") {
                        tsoParams = await this.getTsoParams();
                        if (!tsoParams) {
                            return;
                        }
                    }
                    let command1: string = command;
                    if (!command) {
                        command1 = await this.getQuickPick(session && session.ISession ? session.ISession.hostname : "unknown");
                    }
                    await this.issueCommand(command1, profile, tsoParams);
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
        ZoweLogger.trace("TsoCommandHandler.getQuickPick called.");
        let response = "";
        const alwaysEdit: boolean = SettingsConfig.getDirectValue(globals.SETTINGS_COMMANDS_ALWAYS_EDIT);
        if (this.history.getSearchHistory().length > 0) {
            const createPick = new FilterDescriptor(TsoCommandHandler.defaultDialogText);
            const items: vscode.QuickPickItem[] = this.history.getSearchHistory().map((element) => new FilterItem({ text: element }));
            const quickpick = Gui.createQuickPick();
            quickpick.placeholder = alwaysEdit
                ? vscode.l10n.t({
                      message: "Select a TSO command to run against {0} (An option to edit will follow)",
                      args: [hostname],
                      comment: ["Host name"],
                  })
                : vscode.l10n.t({
                      message: "Select a TSO command to run immediately against {0}",
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
                prompt: vscode.l10n.t("Enter or update the TSO command"),
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
     * Allow the user to submit an TSO command to the selected server. Response is written
     * to the output channel.
     * @param command the command string
     * @param profile profile to be used
     * @param tsoParams parameters (from TSO profile, when used)
     */
    private async issueCommand(command: string, profile: imperative.IProfileLoaded, tsoParams?: zostso.IStartTsoParms): Promise<void> {
        ZoweLogger.trace("TsoCommandHandler.issueCommand called.");
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
                        title: vscode.l10n.t("TSO command submitted."),
                    },
                    () => {
                        return ZoweExplorerApiRegister.getCommandApi(profile).issueTsoCommandWithParms(command, tsoParams);
                    }
                );
                if (submitResponse.success) {
                    this.outputChannel.appendLine(submitResponse.commandResponse);
                    this.outputChannel.show(true);
                }
            }
            this.history.addSearchHistory(command);
        } catch (error) {
            if (error.toString().includes("account number")) {
                const message = vscode.l10n.t("No account number was supplied.");
                ZoweLogger.error(message);
                Gui.errorMessage(message);
            } else {
                await errorHandling(error, profile.name);
            }
        }
    }

    private async selectTsoProfile(tsoProfiles: imperative.IProfileLoaded[] = []): Promise<imperative.IProfileLoaded> {
        ZoweLogger.trace("TsoCommandHandler.selectTsoProfile called.");
        let tsoProfile: imperative.IProfileLoaded;
        if (tsoProfiles.length > 1) {
            const tsoProfileNamesList = tsoProfiles.map((temprofile) => {
                return temprofile.name;
            });
            if (tsoProfileNamesList.length) {
                const quickPickOptions: vscode.QuickPickOptions = {
                    placeHolder: vscode.l10n.t("Select the TSO Profile to use for account number."),
                    ignoreFocusOut: true,
                    canPickMany: false,
                };
                const sesName = await Gui.showQuickPick(tsoProfileNamesList, quickPickOptions);
                if (sesName === undefined) {
                    Gui.showMessage(vscode.l10n.t("Operation Cancelled"));
                    return;
                }
                tsoProfile = tsoProfiles.filter((temprofile) => temprofile.name === sesName)[0];
            }
        } else if (tsoProfiles.length > 0) {
            tsoProfile = tsoProfiles[0];
        }
        return tsoProfile;
    }

    /**
     * Looks for list of tso profiles for user to choose from,
     * if non exist prompts user for account number.
     * @returns Promise<IStartTsoParms>
     */
    private async getTsoParams(): Promise<zostso.IStartTsoParms> {
        ZoweLogger.trace("TsoCommandHandler.getTsoParams called.");
        const profileInfo = await Profiles.getInstance().getProfileInfo();
        let tsoParms: zostso.IStartTsoParms = {};

        // Keys in the IStartTsoParms interface
        // TODO(zFernand0): Request the CLI squad that all interfaces are also exported as values that we can iterate
        const iStartTso = ["account", "characterSet", "codePage", "columns", "logonProcedure", "regionSize", "rows"];
        const profiles = profileInfo.getAllProfiles("tso");
        let tsoProfile: imperative.IProfileLoaded;
        if (profiles.length > 0) {
            tsoProfile = await this.selectTsoProfile(profiles.map((p) => imperative.ProfileInfo.profAttrsToProfLoaded(p)));
            if (tsoProfile != null) {
                const prof = profileInfo.mergeArgsForProfile(tsoProfile.profile as imperative.IProfAttrs);
                iStartTso.forEach((p) => (tsoProfile.profile[p] = prof.knownArgs.find((a) => a.argName === p)?.argValue));
            }
        }
        if (tsoProfile) {
            tsoParms = {
                ...iStartTso.reduce((obj, parm) => {
                    return { ...obj, [parm]: tsoProfile.profile[parm] };
                }, {}),
            };
        }

        if (tsoParms.account == null || tsoParms.account === "") {
            // If there is no tso profile an account number is still required, so ask for one.
            // All other properties of tsoParams will be undefined, so defaults will be utilized.
            const InputBoxOptions = {
                placeHolder: vscode.l10n.t("Account Number"),
                prompt: vscode.l10n.t("Enter the account number for the TSO connection."),
                ignoreFocusOut: true,
                value: tsoParms.account,
            };
            tsoParms.account = await Gui.showInputBox(InputBoxOptions);
            if (!tsoParms.account) {
                Gui.showMessage(vscode.l10n.t("Operation Cancelled."));
                return;
            }
        }
        return tsoParms;
    }
}
