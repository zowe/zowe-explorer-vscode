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

import * as zowe from "@zowe/cli";
import * as vscode from "vscode";
import { IProfileLoaded, ISession, Session, IProfile } from "@zowe/imperative";
import * as globals from "../globals";
import { Profiles, ValidProfileEnum } from "../Profiles";
import { PersistentFilters } from "../PersistentFilters";
import { FilterDescriptor, FilterItem, resolveQuickPickHelper, errorHandling } from "../utils";
import { IZoweTreeNode } from "../api/IZoweTreeNode";
import * as nls from "vscode-nls";

// Set up localization
nls.config({ messageFormat: nls.MessageFormat.bundle, bundleFormat: nls.BundleFormat.standalone })();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

/**
 * Provides a class that manages submitting a command on the server
 *
 * @export
 * @class MvsCommandHandler
 */
export class MvsCommandHandler {

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

    private static readonly totalFilters: number = 10;
    private static readonly persistenceSchema: string = "Zowe Commands: History";
    private static readonly defaultDialogText: string = "\uFF0B " + localize("command.option.prompt.search", "Create a new Command");
    private static instance: MvsCommandHandler;

    private history: PersistentFilters;
    private outputChannel: vscode.OutputChannel;


    constructor() {
        this.outputChannel = vscode.window.createOutputChannel(localize("issueMvsCommand.outputchannel.title", "Zowe MVS Command"));
        this.history = new PersistentFilters(MvsCommandHandler.persistenceSchema, MvsCommandHandler.totalFilters);
    }

    /**
     * Allow the user to submit a MVS Console command to the selected server. Response is written
     * to the output channel.
     * @param session the session the command is to run against (optional) user is prompted if not supplied
     * @param command the command string (optional) user is prompted if not supplied
     */
    public async issueMvsCommand(session?: Session, command?: string, node?: IZoweTreeNode) {
        let zosmfProfile: IProfileLoaded;
        if (!session) {
            const profiles = Profiles.getInstance();
            const allProfiles: IProfileLoaded[] = profiles.allProfiles;
            const profileNamesList = allProfiles.map((temprofile) => {
                return temprofile.name;
            });
            if (profileNamesList.length) {
                const quickPickOptions: vscode.QuickPickOptions = {
                    placeHolder: localize("issueMvsCommand.quickPickOption", "Select the Profile to use to submit the command"),
                    ignoreFocusOut: true,
                    canPickMany: false
                };
                const sesName = await vscode.window.showQuickPick(profileNamesList, quickPickOptions);
                if (sesName === undefined) {
                    vscode.window.showInformationMessage(localize("issueMvsCommand.undefined.profilename",
                        "Operation Cancelled"));
                    return;
                }
                zosmfProfile = allProfiles.filter((temprofile) => temprofile.name === sesName)[0];
            } else {
                vscode.window.showInformationMessage(localize("issueMvsCommand.noProfilesLoaded", "No profiles available"));
                return;
            }
        } else {
            zosmfProfile = node.getProfile();
        }
        await Profiles.getInstance().checkCurrentProfile(zosmfProfile);
        if ((Profiles.getInstance().validProfile === ValidProfileEnum.VALID) ||
        (Profiles.getInstance().validProfile === ValidProfileEnum.UNVERIFIED)) {
            const updProfile = zosmfProfile.profile as ISession;
            session = zowe.ZosmfSession.createBasicZosmfSession(updProfile as IProfile);
            let command1: string = command;
            if (!command) {
                command1 = await this.getQuickPick(session && session.ISession ? session.ISession.hostname : "unknown");
            }
            await this.issueCommand(session, command1);
        } else {
            vscode.window.showErrorMessage(localize("issueMvsCommand.checkProfile", "Profile is invalid"));
            return;
        }
    }

    private async getQuickPick(hostname: string) {
        let response = "";
        const alwaysEdit = PersistentFilters.getDirectValue("Zowe Commands: Always edit") as boolean;
        if (this.history.getSearchHistory().length > 0) {
            const createPick = new FilterDescriptor(MvsCommandHandler.defaultDialogText);
            const items: vscode.QuickPickItem[] = this.history.getSearchHistory().map((element) => new FilterItem(element));
            if (globals.ISTHEIA) {
                const options1: vscode.QuickPickOptions = {
                    placeHolder: localize("issueMvsCommand.command.hostname", "Select a command to run against ") + hostname +
                                            (alwaysEdit ? localize("issueMvsCommand.command.edit", " (An option to edit will follow)"): "")
                };
                // get user selection
                const choice = (await vscode.window.showQuickPick([createPick, ...items], options1));
                if (!choice) {
                    vscode.window.showInformationMessage(localize("issueMvsCommand.options.noselection", "No selection made."));
                    return;
                }
                response = choice === createPick ? "" : choice.label;
            } else {
                const quickpick = vscode.window.createQuickPick();
                quickpick.placeholder = alwaysEdit ?
                                            localize("issueMvsCommand.command.hostnameAlt", "Select a command to run against ") + hostname +
                                            localize("issueMvsCommand.command.edit", " (An option to edit will follow)"):
                                            localize("issueMvsCommand.command.hostname",
                                                             "Select a command to run immediately against ") + hostname;

                quickpick.items = [createPick, ...items];
                quickpick.ignoreFocusOut = true;
                quickpick.show();
                const choice = await resolveQuickPickHelper(quickpick);
                quickpick.hide();
                if (!choice) {
                    vscode.window.showInformationMessage(localize("issueMvsCommand.options.noselection", "No selection made."));
                    return;
                }
                if (choice instanceof FilterDescriptor) {
                    if (quickpick.value) {
                        response = quickpick.value;
                    }
                } else {
                    response =  choice.label;
                }
            }
        }
        if (!response || alwaysEdit) {
            // manually entering a search
            const options2: vscode.InputBoxOptions = {
                prompt: localize("issueMvsCommand.command", "Enter or update the command"),
                value: response,
                valueSelection: response ? [response.length, response.length] : undefined
            };
            // get user input
            response = await vscode.window.showInputBox(options2);
            if (!response) {
                vscode.window.showInformationMessage(localize("issueMvsCommand.enter.command", "No command entered."));
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
    private async issueCommand(session: Session, command: string) {
        try {
            if (command) {
                // If the user has started their command with a / then remove it
                if (command.startsWith("/")) {
                    command = command.substring(1);
                }
                this.outputChannel.appendLine(`> ${command}`);
                const submitResponse = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: localize("issueMvsCommand.command.submitted", "MVS command submitted.")
                }, () => {
                    return zowe.IssueCommand.issueSimple(session, command);
                });
                if (submitResponse.success) {
                    this.outputChannel.appendLine(submitResponse.commandResponse);
                    this.outputChannel.show(true);
                }
            }
        } catch (error) {
            await errorHandling(error, null, error.message);
        }
        this.history.addSearchHistory(command);
    }
}
