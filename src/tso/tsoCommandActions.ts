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

import * as zowe from "@brightside/core";
import * as vscode from "vscode";
import { IProfileLoaded, ISession, Session, IProfile } from "@brightside/imperative";
import * as nls from "vscode-nls";
import * as extension from "../extension";
import { Profiles } from "../Profiles";
import { PersistentFilters } from "../PersistentFilters";
import { FilterDescriptor, FilterItem, resolveQuickPickHelper } from "../utils";
const localize = nls.config({ messageFormat: nls.MessageFormat.file })();


const persistenceSchema: string = "Zowe-Commands-Persistent";
const defaultDialogText: string = "\uFF0B " + localize("command.option.prompt.search", "Create a new Command");
const totalFilters: number = 10;
const mHistory: PersistentFilters = new PersistentFilters(persistenceSchema, totalFilters);
/**
 * Allow the user to submit a TSO command to the selected server. Response is written
 * to the output channel.
 * @param outputChannel The Output Channel to write the command and response to
 * @param profile a preselected profile
 * @param command the command string
 */
export async function issueTsoCommand(outputChannel: vscode.OutputChannel, session?: Session, command?: string) {
    if (!session) {
        let usrNme: string;
        let passWrd: string;
        let baseEncd: string;
        const profiles = Profiles.getInstance();
        const allProfiles: IProfileLoaded[] = profiles.allProfiles;
        const profileNamesList = allProfiles.map((temprofile) => {
            return temprofile.name;
        });
        if (profileNamesList.length) {
            const quickPickOptions: vscode.QuickPickOptions = {
                placeHolder: localize("issueTsoCommand.quickPickOption", "Select the Profile to use to submit the command"),
                ignoreFocusOut: true,
                canPickMany: false
            };
            const sesName = await vscode.window.showQuickPick(profileNamesList, quickPickOptions);
            const zosmfProfile = allProfiles.filter((temprofile) => temprofile.name === sesName)[0];
            const updProfile = zosmfProfile.profile as ISession;
            if ((!updProfile.user) || (!updProfile.password)) {
                try {
                    const values = await Profiles.getInstance().promptCredentials(zosmfProfile.name);
                    if (values !== undefined) {
                        usrNme = values [0];
                        passWrd = values [1];
                        baseEncd = values [2];
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(error.message);
                }
                if (usrNme !== undefined && passWrd !== undefined && baseEncd !== undefined) {
                    updProfile.user = usrNme;
                    updProfile.password = passWrd;
                    updProfile.base64EncodedAuth = baseEncd;
                }
            }
            session = zowe.ZosmfSession.createBasicZosmfSession(updProfile as IProfile);
        } else {
            vscode.window.showInformationMessage(localize("issueTsoCommand.noProfilesLoaded", "No profiles available"));
        }
    }
    let command1: string = command;
    if (!command) {
        command1 = await getQuickPick();
        // await vscode.window.showInputBox({ prompt: localize("issueTsoCommand.command", "Command") });
    }
    issueCommand(outputChannel, session, command1);
}

/**
 * Allow the user to submit a TSO command to the selected server. Response is written
 * to the output channel.
 * @param outputChannel The Output Channel to write the command and response to
 */
async function issueCommand(outputChannel: vscode.OutputChannel, session: Session, command: string) {
    try {
        if (command) {
            // If the user has started their command with a / then remove it
            if (command.startsWith("/")) {
                command = command.substring(1);
            }
            outputChannel.appendLine(`> ${command}`);
            const response = await zowe.IssueCommand.issueSimple(session, command);
            outputChannel.appendLine(response.commandResponse);
            outputChannel.show(true);
        }
    } catch (error) {
        vscode.window.showErrorMessage(error.message);
    }
    mHistory.addHistory(command);
}

async function getQuickPick() {
    let response = "";
    if (mHistory.getHistory().length > 0) {
        const createPick = new FilterDescriptor(defaultDialogText);
        const items: vscode.QuickPickItem[] = mHistory.getHistory().map((element) => new FilterItem(element));
        if (extension.ISTHEIA) {
            const options1: vscode.QuickPickOptions = {
                placeHolder: localize("issueTsoCommand.options.prompt", "Select a previous command")
            };
            // get user selection
            const choice = (await vscode.window.showQuickPick([createPick, ...items], options1));
            if (!choice) {
                vscode.window.showInformationMessage(localize("issueTsoCommand.options.noselection", "No selection made."));
                return;
            }
            response = choice === createPick ? "" : choice.label;
        } else {
            const quickpick = vscode.window.createQuickPick();
            quickpick.placeholder = localize("issueTsoCommand.options.select", "Select a command");
            quickpick.items = [createPick, ...items];
            quickpick.ignoreFocusOut = true;
            quickpick.show();
            const choice = await resolveQuickPickHelper(quickpick);
            quickpick.hide();
            if (!choice) {
                vscode.window.showInformationMessage(localize("issueTsoCommand.options.noselection", "No selection made."));
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
    if (!response) {
        // manually entering a search
        const options2: vscode.InputBoxOptions = {
            prompt: localize("issueTsoCommand.command", "Command"),
            value: "",
        };
        // get user input
        response = await vscode.window.showInputBox(options2);
        if (!response) {
            vscode.window.showInformationMessage(localize("issueTsoCommand.enter.command", "You must enter a command."));
            return;
        }
    }
    return response;
}
