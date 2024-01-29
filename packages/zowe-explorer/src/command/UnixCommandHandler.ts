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
import { ProfileManagement } from "../utils/ProfileManagement";

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
    public pathInputConfirmationFlag: boolean = true;
    public sshprofile: imperative.IProfileLoaded;
    public user: string;

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
        let cwd: string = "";
        let profile: imperative.IProfileLoaded;
        const profiles = Profiles.getInstance();
        let sshRequiredBoolean: boolean;
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
        let res: boolean = true;
        if (!session) {
            const allProfiles = profiles.allProfiles;
            res = this.checkForSshRequired(allProfiles);
            const profileNamesList = ProfileManagement.getRegisteredProfileNameList(globals.Trees.USS);
            if (profileNamesList.length) {
                if (!res) {
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
                }
                if (ZoweExplorerApiRegister.getCommandApi(profile).sshProfileRequired) {
                    sshRequiredBoolean = true;
                    this.sshSession = await this.setsshSession();
                    if (!this.sshSession) {
                        return;
                    }
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
        if (cwd == "") {
            const options: vscode.InputBoxOptions = {
                prompt: localize("unixCommand.pathToEnter", "Enter the path of the directory in order to execute the command"),
            };
            cwd = await Gui.showInputBox(options);
        }
        if (cwd == "") {
            Gui.showMessage(localize("unixCommand.HomeDirectory", "Redirecting to Home Directory"));
            this.pathInputConfirmationFlag = false;
        }
        if (cwd == undefined) {
            Gui.showMessage(localize("issueUnixCommand.options.nopathentered", "Operation cancelled."));
            return;
        }
        if (ZoweExplorerApiRegister.getCommandApi(profile).sshProfileRequired && sshRequiredBoolean == undefined) {
            this.sshSession = await this.setsshSession();
            if (!this.sshSession) {
                return;
            }
        }
        try {
            if (Profiles.getInstance().validProfile !== ValidProfileEnum.INVALID) {
                const commandApi = ZoweExplorerApiRegister.getInstance().getCommandApi(profile);
                if (!ZoweExplorerApiRegister.getCommandApi(profile).issueUnixCommand) {
                    Gui.errorMessage(localize("issueUnixCommand.apiNonExisting", "Not implemented yet for profile of type: ") + profile.type);
                    return;
                }
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

    public checkForSshRequired(allProfiles: imperative.IProfileLoaded[]): boolean {
        try {
            allProfiles.forEach((p) => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                if (!ZoweExplorerApiRegister.getCommandApi(p).sshProfileRequired) {
                    return false;
                }
            });
        } catch (error) {
            return false;
        }
    }

    public async setsshSession(): Promise<SshSession> {
        ZoweLogger.trace("UnixCommandHandler.setsshSession called.");
        this.sshprofile = await this.getSshProfile();
        if (this.sshprofile) {
            const cmdArgs: imperative.ICommandArguments = this.getCmdArgs(this.sshprofile.profile as imperative.IProfileLoaded);
            // create the ssh session
            const sshSessCfg = SshSession.createSshSessCfgFromArgs(cmdArgs);
            imperative.ConnectionPropsForSessCfg.resolveSessCfgProps<ISshSession>(sshSessCfg, cmdArgs);
            this.sshSession = new SshSession(sshSessCfg);
        } else {
            Gui.showMessage(localize("issueUnixCommand.cancelled", "Operation Cancelled"));
            return;
        }
        return this.sshSession;
    }

    private async selectSshProfile(sshProfiles: imperative.IProfileLoaded[] = []): Promise<imperative.IProfileLoaded> {
        ZoweLogger.trace("UnixCommandHandler.selectSshProfile called.");
        let sshProfile: imperative.IProfileLoaded;
        if (sshProfiles.length > 1) {
            const sshProfileNamesList = sshProfiles.map((temprofile) => {
                return temprofile.name;
            });
            if (sshProfileNamesList.length) {
                const quickPickOptions: vscode.QuickPickOptions = {
                    placeHolder: localize("issueUnixCommand.sshProfile.quickPickOption", "Select the ssh Profile."),
                    ignoreFocusOut: true,
                    canPickMany: false,
                };
                const sesName = await Gui.showQuickPick(sshProfileNamesList, quickPickOptions);
                if (sesName === undefined) {
                    Gui.showMessage(localize("issueUnixCommand.cancelled", "Operation Cancelled"));
                    return;
                }

                sshProfile = sshProfiles.filter((temprofile) => temprofile.name === sesName)[0];
            }
        } else if (sshProfiles.length > 0) {
            sshProfile = sshProfiles[0];
        }
        return sshProfile;
    }

    private async getSshProfile(): Promise<imperative.IProfileLoaded> {
        ZoweLogger.trace("UnixCommandHandler.getsshParams called.");
        const profileInfo = await Profiles.getInstance().getProfileInfo();
        const params = ["port", "host", "user", "password"];
        const profiles = profileInfo.getAllProfiles("ssh");
        let exitflag: boolean;
        if (!profiles) {
            Gui.errorMessage(
                localize("setsshProfile.couldnotfindprofile", `No SSH profile found. Please create an SSH profile before issuing Unix commands.`)
            );
            return;
        }
        let sshProfile: imperative.IProfileLoaded;
        if (profiles.length > 0) {
            sshProfile = await this.selectSshProfile(profiles.map((p) => imperative.ProfileInfo.profAttrsToProfLoaded(p)));
            if (sshProfile != null) {
                const prof = profileInfo.mergeArgsForProfile(sshProfile.profile as imperative.IProfAttrs);
                for (const p of params) {
                    let obj = prof.knownArgs.find((a) => a.argName === p);
                    if (obj) {
                        if (obj.argValue) {
                            sshProfile.profile[p] = obj.argValue;
                        } else {
                            sshProfile.profile[p] = profileInfo.loadSecureArg(obj);
                        }
                    } else {
                        obj = prof.missingArgs.find((a) => a.argName === p);
                        if (obj.argValue) {
                            sshProfile.profile[p] = obj.argValue;
                        } else {
                            const options: vscode.InputBoxOptions = {
                                prompt: localize("issueUnixCommand.user.pw", `Enter the {0} of the profile.`,p),
                                value: "",
                                ignoreFocusOut: true,
                                password: p.toLowerCase().includes("password"), 
                            };
                            const response = await Gui.showInputBox(options);
                            if (!response) {
                                Gui.showMessage(localize("issueUnixCommand.enter.command", `No command entered.`));
                                return;
                            }
                            sshProfile.profile[p] = response;
                        }
                    }
                }
            }
        }
        return sshProfile;
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
                const user: string = this.sshprofile.profile.user;
                this.outputChannel.appendLine(`> ${user} @ ${this.sshprofile.name} : ${cwd ? cwd : "~"} ${command}`);
                const submitResponse = await Gui.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: localize("issueUnixCommand.command.submitted", "Unix command submitted."),
                    },
                    () => {
                        if (ZoweExplorerApiRegister.getCommandApi(profile).issueUnixCommand) {
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                            return ZoweExplorerApiRegister.getCommandApi(profile).issueUnixCommand(
                                this.sshSession,
                                command,
                                cwd,
                                this.pathInputConfirmationFlag
                            );
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
