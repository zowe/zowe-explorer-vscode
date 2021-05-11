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
import * as nls from "vscode-nls";
import * as globals from "../globals";
import * as imperative from "@zowe/imperative";
import { ValidProfileEnum, IZoweTreeNode } from "@zowe/zowe-explorer-api";
import { PersistentFilters } from "../PersistentFilters";
import { Profiles } from "../Profiles";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { errorHandling, FilterDescriptor, FilterItem, resolveQuickPickHelper } from "../utils/ProfilesUtils";
import { ZoweCommandProvider } from "../abstract/ZoweCommandProvider";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

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

    private static readonly defaultDialogText: string =
        "\uFF0B " + localize("command.option.prompt.search", "Create a new TSO Command");
    private static instance: TsoCommandHandler;

    constructor() {
        super();
    }

    /**
     * Allow the user to submit a TSO command to the selected server. Response is written
     * to the output channel.
     * @param session the session the command is to run against (optional) user is prompted if not supplied
     * @param command the command string (optional) user is prompted if not supplied
     */
    public async issueTsoCommand(session?: imperative.Session, command?: string, node?: IZoweTreeNode) {
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
                    placeHolder: localize(
                        "issueTsoCommand.quickPickOption",
                        "Select the Profile to use to submit the TSO command"
                    ),
                    ignoreFocusOut: true,
                    canPickMany: false,
                };
                const sesName = await vscode.window.showQuickPick(profileNamesList, quickPickOptions);
                if (sesName === undefined) {
                    vscode.window.showInformationMessage(localize("issueTsoCommand.cancelled", "Operation Cancelled"));
                    return;
                }
                profile = allProfiles.filter((temprofile) => temprofile.name === sesName)[0];
                if (!node) {
                    // If baseProfile exists, combine that information first
                    const baseProfile = Profiles.getInstance().getBaseProfile();
                    if (baseProfile) {
                        try {
                            const combinedProfile = await Profiles.getInstance().getCombinedProfile(
                                profile,
                                baseProfile
                            );
                            profile = combinedProfile;
                        } catch (error) {
                            throw error;
                        }
                    }
                    await Profiles.getInstance().checkCurrentProfile(profile);
                }
                if (Profiles.getInstance().validProfile !== ValidProfileEnum.INVALID) {
                    session = ZoweExplorerApiRegister.getMvsApi(profile).getSession();
                } else {
                    vscode.window.showErrorMessage(localize("issueTsoCommand.checkProfile", "Profile is invalid"));
                    return;
                }
            } else {
                vscode.window.showInformationMessage(
                    localize("issueTsoCommand.noProfilesLoaded", "No profiles available")
                );
                return;
            }
        } else {
            profile = node.getProfile();
        }
        try {
            if (Profiles.getInstance().validProfile !== ValidProfileEnum.INVALID) {
                const commandApi = ZoweExplorerApiRegister.getInstance().getCommandApi(profile);
                if (commandApi) {
                    let acctNum: string;
                    if (profile.type === "zosmf") {
                        acctNum = await this.getAccountNumber();
                    }
                    let command1: string = command;
                    if (!command) {
                        command1 = await this.getQuickPick(
                            session && session.ISession ? session.ISession.hostname : "unknown"
                        );
                    }
                    await this.issueCommand(command1, profile, acctNum);
                } else {
                    vscode.window.showErrorMessage(localize("issueTsoCommand.checkProfile", "Profile is invalid"));
                    return;
                }
            }
        } catch (error) {
            if (error.toString().includes("non-existing")) {
                vscode.window.showErrorMessage(
                    localize("issueTsoCommand.apiNonExisting", "Not implemented yet for profile of type: ") +
                        profile.type
                );
            } else {
                await errorHandling(error.toString(), profile.name, error.message.toString());
            }
        }
    }

    private async getQuickPick(hostname: string) {
        let response = "";
        const alwaysEdit = PersistentFilters.getDirectValue("Zowe Commands: Always edit") as boolean;
        if (this.history.getSearchHistory().length > 0) {
            const createPick = new FilterDescriptor(TsoCommandHandler.defaultDialogText);
            const items: vscode.QuickPickItem[] = this.history
                .getSearchHistory()
                .map((element) => new FilterItem(element));
            if (globals.ISTHEIA) {
                const options1: vscode.QuickPickOptions = {
                    placeHolder:
                        localize("issueTsoCommand.command.hostname", "Select a TSO command to run against ") +
                        hostname +
                        (alwaysEdit
                            ? localize("issueTsoCommand.command.edit", " (An option to edit will follow)")
                            : ""),
                };
                // get user selection
                const choice = await vscode.window.showQuickPick([createPick, ...items], options1);
                if (!choice) {
                    vscode.window.showInformationMessage(
                        localize("issueTsoCommand.options.noselection", "No selection made.")
                    );
                    return;
                }
                response = choice === createPick ? "" : choice.label;
            } else {
                const quickpick = vscode.window.createQuickPick();
                quickpick.placeholder = alwaysEdit
                    ? localize("issueTsoCommand.command.hostnameAlt", "Select a TSO command to run against ") +
                      hostname +
                      localize("issueTsoCommand.command.edit", " (An option to edit will follow)")
                    : localize("issueTsoCommand.command.hostname", "Select a TSO command to run immediately against ") +
                      hostname;

                quickpick.items = [createPick, ...items];
                quickpick.ignoreFocusOut = true;
                quickpick.show();
                const choice = await resolveQuickPickHelper(quickpick);
                quickpick.hide();
                if (!choice) {
                    vscode.window.showInformationMessage(
                        localize("issueTsoCommand.options.noselection", "No selection made.")
                    );
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
                prompt: localize("issueTsoCommand.command", "Enter or update the TSO command"),
                value: response,
                valueSelection: response ? [response.length, response.length] : undefined,
            };
            // get user input
            response = await vscode.window.showInputBox(options2);
            if (!response) {
                vscode.window.showInformationMessage(localize("issueTsoCommand.enter.command", "No command entered."));
                return;
            }
        }
        return response;
    }
    /**
     * Allow the user to submit an TSO command to the selected server. Response is written
     * to the output channel.
     * @param session The Session object
     * @param command the command string
     */
    private async issueCommand(command: string, profile: imperative.IProfileLoaded, acctNum?: string) {
        try {
            if (command) {
                // If the user has started their command with a / then remove it
                if (command.startsWith("/")) {
                    command = command.substring(1);
                }
                this.outputChannel.appendLine(`> ${command}`);
                const submitResponse = await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: localize("issueTsoCommand.command.submitted", "TSO command submitted."),
                    },
                    () => {
                        return ZoweExplorerApiRegister.getCommandApi(profile).issueTsoCommand(command, acctNum);
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
                vscode.window.showErrorMessage(
                    localize("issueTsoCommand.accountNumberNotSupplied", "Error: No account number was supplied.")
                );
            } else {
                await errorHandling(error.toString(), profile.name, error.message.toString());
            }
        }
    }

    private async getAccountNumber(): Promise<string> {
        const tsoProfiles: imperative.IProfileLoaded[] = [];
        let tsoProfile: imperative.IProfileLoaded;
        let acctNum: string;
        const profileManager = Profiles.getInstance().getCliProfileManager("tso");
        if (profileManager) {
            try {
                const profiles = await profileManager.loadAll();
                for (const item of profiles) {
                    if (item.type === "tso") {
                        tsoProfiles.push(item);
                    }
                }
                if (tsoProfiles.length && tsoProfiles.length > 1) {
                    const tsoProfileNamesList = tsoProfiles.map((temprofile) => {
                        return temprofile.name;
                    });
                    if (tsoProfileNamesList.length) {
                        const quickPickOptions: vscode.QuickPickOptions = {
                            placeHolder: localize(
                                "issueTsoCommand.tsoProfile.quickPickOption",
                                "Select the TSO Profile to use for account number."
                            ),
                            ignoreFocusOut: true,
                            canPickMany: false,
                        };
                        const sesName = await vscode.window.showQuickPick(tsoProfileNamesList, quickPickOptions);
                        if (sesName === undefined) {
                            vscode.window.showInformationMessage(
                                localize("issueTsoCommand.cancelled", "Operation Cancelled")
                            );
                            return;
                        }
                        tsoProfile = tsoProfiles.filter((temprofile) => temprofile.name === sesName)[0];
                    }
                } else {
                    if (tsoProfiles.length) {
                        tsoProfile = tsoProfiles[0];
                    }
                }
            } catch (error) {
                if (!error?.message?.includes(`No default profile set for type "tso"`)) {
                    vscode.window.showInformationMessage(error);
                }
            }
        }
        if (tsoProfile) {
            acctNum = tsoProfile.profile.account;
        } else {
            const InputBoxOptions = {
                placeHolder: localize("issueTsoCommand.command.account", "Account Number"),
                prompt: localize(
                    "issueTsoCommand.option.prompt.acctNum",
                    "Enter the account number for the TSO connection."
                ),
                ignoreFocusOut: true,
                value: acctNum,
            };
            acctNum = await vscode.window.showInputBox(InputBoxOptions);
            if (!acctNum) {
                vscode.window.showInformationMessage(localize("issueTsoCommand.cancelled", "Operation Cancelled."));
                return;
            }
        }
        return acctNum;
    }
}
