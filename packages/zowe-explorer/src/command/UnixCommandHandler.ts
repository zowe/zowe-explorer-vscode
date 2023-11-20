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
import * as nls from "vscode-nls";
import * as globals from "../globals";
import { Gui, ValidProfileEnum, IZoweTreeNode } from "@zowe/zowe-explorer-api";
import { Profiles } from "../Profiles";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { errorHandling, FilterDescriptor, FilterItem } from "../utils/ProfilesUtils";
import { ZoweCommandProvider } from "../abstract/ZoweCommandProvider";
import { imperative } from "@zowe/cli";
import { SettingsConfig } from "../utils/SettingsConfig";
import { ZoweLogger } from "../utils/LoggerUtils";
import * as cli from "@zowe/cli";
import { SshSession, ISshSession } from "@zowe/zos-uss-for-zowe-sdk";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

/**
 * Provides a class that manages submitting a Unix command on the server
 *
 * @export
 * @class UnixCommandHandler
 */
export class UnixCommandHandler extends ZoweCommandProvider {
    /**
     * Implements access singleton
     * for {UnixCommandHandler}.
     *
     * @returns {UnixCommandHandler}
     */
    public static getInstance(): UnixCommandHandler {
        if (!UnixCommandHandler.instance) {
            UnixCommandHandler.instance = new UnixCommandHandler();
        }
        return this.instance;
    }

    private static readonly defaultDialogText: string = localize("command.option.prompt.search", "$(plus) Create a new Unix command");
    private static instance: UnixCommandHandler;
    public outputChannel: vscode.OutputChannel;
    public sshSession: SshSession;
    // public profile: imperative.IProfileLoaded;

    public constructor() {
        super();
        this.outputChannel = Gui.createOutputChannel(localize("issueUnixCommand.outputchannel.title", "Zowe Unix Command"));
    }

    public getCmdArgs(profile: imperative.IProfileLoaded): cli.imperative.ICommandArguments {
        const cmdArgs: imperative.ICommandArguments = {
            $0: "zowe",
            _: [""],
        };
        for (const prop of Object.keys(profile)) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            cmdArgs[prop] = profile[prop];
        }
        return cmdArgs;
    }

    public async issueUnixCommand(session?: imperative.Session, command?: string, node?: IZoweTreeNode): Promise<void> {
        let cwd: string;
        let profile: imperative.IProfileLoaded;
        if (node) {
            cwd = node.fullPath;
            await this.checkCurrentProfile(node);
            if (!session) {
                session = ZoweExplorerApiRegister.getUssApi(node.getProfile()).getSession();
                if (!session) {
                    return;
                }
            }
        }
        if (!session) {
            const profiles = Profiles.getInstance();
            const allProfiles: imperative.IProfileLoaded[] = profiles.allProfiles;
            const profileNamesList = allProfiles.map((temprofile) => temprofile.name);
            if (profileNamesList.length) {
                const quickPickOptions: vscode.QuickPickOptions = {
                    placeHolder: localize("issueUnixCommand.quickPickOption", "Select the Profile to use to submit the Unix command"),
                    ignoreFocusOut: true,
                    canPickMany: false,
                };
                const sesName = await Gui.showQuickPick(profileNamesList, quickPickOptions);
                if (sesName === undefined) {
                    Gui.showMessage(localize("issueUnixCommand.cancelled", "Operation Cancelled"));
                    return;
                }
                profile = allProfiles.find((temprofile) => temprofile.name === sesName);
                if (cwd == undefined) {
                    cwd = await vscode.window.showInputBox({
                        prompt: "Enter the path of the directory in order to execute the command",
                        value: "",
                    });
                }
                if (!node) {
                    await Profiles.getInstance().checkCurrentProfile(profile);
                }
                if (Profiles.getInstance().validProfile !== ValidProfileEnum.INVALID) {
                    session = ZoweExplorerApiRegister.getUssApi(profile).getSession();
                } else {
                    Gui.errorMessage(localize("issueUnixCommand.checkProfile", "Profile is invalid"));
                    return;
                }
            } else {
                Gui.showMessage(localize("issueUnixCommand.noProfilesLoaded", "No profiles available"));
                return;
            }
        } else {
            profile = node.getProfile();
        }
        if(cwd == ''){
            Gui.errorMessage(localize("path.notselected", "First select the filter that displays the directories inorder to issue unix command"));
            return;
        }
        if (ZoweExplorerApiRegister.getCommandApi(profile).sshProfileRequired) {
            this.sshSession = await this.setsshSession();
            if(!this.sshSession) return;
        } else {
            Gui.showMessage(localize("issueUnixCommand.apiNonExisting", "Not implemented yet for profile of type: ") + profile.type);
            return;
        }
        try {
            if (Profiles.getInstance().validProfile !== ValidProfileEnum.INVALID) {
                const commandApi = ZoweExplorerApiRegister.getInstance().getCommandApi(profile);
                if (commandApi) {
                    let command1: string = command;
                    if (!command) {
                        command1 = await this.getQuickPick(cwd);
                    }
                    await this.issueCommand(profile, command1, cwd);
                } else {
                    Gui.errorMessage(localize("issueUnixCommand.checkProfile", "Profile is invalid"));
                    return;
                }
            }
        } catch (error) {
            if (error.toString().includes("non-existing")) {
                ZoweLogger.error(error);
                Gui.errorMessage(localize("issueUnixCommand.apiNonExisting", "Not implemented yet for profile of type: ") + profile.type);
            } else {
                await errorHandling(error, profile.name);
            }
        }
    }
    public async setsshSession(): Promise<SshSession> {
        ZoweLogger.trace("UnixCommandHandler.setsshSession called.");
        const sshprofile: imperative.IProfileLoaded = Profiles.getInstance().getDefaultProfile("ssh");
        if (!sshprofile) {
            Gui.errorMessage(
                localize("setsshProfile.couldnotfindprofile", "No SSH profile found. Please create an SSH profile before issuing Unix commands.")
            );
            return;
        }
        const cmdArgs: imperative.ICommandArguments = this.getCmdArgs(sshprofile?.profile as imperative.IProfileLoaded);
        // create the ssh session
        const sshSessCfg = SshSession.createSshSessCfgFromArgs(cmdArgs);
        const sshSessCfgWithCreds = await imperative.ConnectionPropsForSessCfg.addPropsOrPrompt<ISshSession>(sshSessCfg, cmdArgs);
        this.sshSession = new SshSession(sshSessCfgWithCreds);
        return this.sshSession;
    }

    private async getQuickPick(cwd: string): Promise<string> {
        ZoweLogger.trace("UnixCommandHandler.getQuickPick called.");
        let response = "";
        const alwaysEdit: boolean = SettingsConfig.getDirectValue(globals.SETTINGS_COMMANDS_ALWAYS_EDIT);
        if (this.history.getSearchHistory().length > 0) {
            const createPick = new FilterDescriptor(UnixCommandHandler.defaultDialogText);
            const items: vscode.QuickPickItem[] = this.history.getSearchHistory().map((element) => new FilterItem({ text: element }));
            if (globals.ISTHEIA) {
                const options1: vscode.QuickPickOptions = {
                    placeHolder:
                        localize("issueUnixCommand.command.hostname", "Select a Unix command to run against ") +
                        cwd +
                        (alwaysEdit ? localize("issueUnixCommand.command.edit", " (An option to edit will follow)") : ""),
                };
                // get user selection
                const choice = await Gui.showQuickPick([createPick, ...items], options1);
                if (!choice) {
                    Gui.showMessage(localize("issueUnixCommand.options.noselection", "No selection made. Operation cancelled."));
                    return;
                }
                response = choice === createPick ? "" : choice.label;
            } else {
                const quickpick = Gui.createQuickPick();
                quickpick.placeholder = alwaysEdit
                    ? localize("issueUnixCommand.command.path", "Select a Unix command to run against ") +
                      cwd +
                      localize("issueUnixCommand.command.edit", " (An option to edit will follow)")
                    : localize("issueUnixCommand.command.path", "Select a Unix command to run immediately against ") + cwd;

                quickpick.items = [createPick, ...items];
                quickpick.ignoreFocusOut = true;
                quickpick.show();
                const choice = await Gui.resolveQuickPick(quickpick);
                quickpick.hide();
                if (!choice) {
                    Gui.showMessage(localize("issueUnixCommand.options.noselection", "No selection made. Operation cancelled."));
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
                prompt: localize("issueUnixCommand.command", "Enter or update the Unix command"),
                value: response,
                valueSelection: response ? [response.length, response.length] : undefined,
            };
            // get user input
            response = await Gui.showInputBox(options2);
            if (!response) {
                Gui.showMessage(localize("issueUnixCommand.enter.command", "No command entered."));
                return;
            }
        }
        return response;
    }

    private async issueCommand(profile: imperative.IProfileLoaded, command: string, cwd: string): Promise<void> {
        ZoweLogger.trace("UnixCommandHandler.issueCommand called.");
        try {
            if (command) {
                // If the user has started their command with a / then remove it
                if (command.startsWith("/")) {
                    command = command.substring(1);
                }
                this.outputChannel.appendLine(`> ${cwd} ${command}`);
                const submitResponse = await Gui.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: localize("issueUnixCommand.command.submitted", "Unix command submitted."),
                    },
                    () => {
                        if (ZoweExplorerApiRegister.getCommandApi(profile).issueUnixCommand) {
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                            return ZoweExplorerApiRegister.getCommandApi(profile).issueUnixCommand(this.sshSession, command, cwd);
                        }
                    }
                );
                this.outputChannel.appendLine(submitResponse);
                this.outputChannel.show(true);
            }
        } catch (error) {
            await errorHandling(error, profile.name);
        }
        this.history.addSearchHistory(command);
    }
}
