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
import { SettingsConfig } from "../utils/SettingsConfig";
import { ZoweLogger } from "../utils/ZoweLogger";
import * as zosuss from "@zowe/zos-uss-for-zowe-sdk";
import { ProfileManagement } from "../utils/ProfileManagement";

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

    private static readonly defaultDialogText: string = vscode.l10n.t("$(plus) Create a new Unix command");
    private static instance: UnixCommandHandler;
    private opCancelledMsg = vscode.l10n.t("Operation Cancelled");
    public profileInstance = Profiles.getInstance();
    public outputChannel: vscode.OutputChannel;
    public sshSession: zosuss.SshSession;
    public pathInputConfirmationFlag: boolean = true;
    public sshprofile: imperative.IProfileLoaded;
    public user: string;

    public constructor() {
        super();
        this.outputChannel = Gui.createOutputChannel(vscode.l10n.t("Zowe Unix Command"));
    }

    public getCmdArgs(profile: imperative.IProfileLoaded): imperative.ICommandArguments {
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
        let sshRequiredBoolean: boolean;

        const profile = await this.getProfile(session, node);
        if (!profile) {
            return;
        }
        // check that issueing commands is possible
        const commandApi = ZoweExplorerApiRegister.getInstance().getCommandApi(profile);
        if (!commandApi) {
            {
                Gui.errorMessage(vscode.l10n.t("Issuing Commands is not supported for this profile."));
                return;
            }
        }
        if (ZoweExplorerApiRegister.getCommandApi(profile).sshProfileRequired) {
            sshRequiredBoolean = true;
        }

        if (sshRequiredBoolean) {
            this.sshSession = await this.setsshSession();
            if (!this.sshSession) {
                return;
            }
        }
        try {
            if (!ZoweExplorerApiRegister.getCommandApi(profile).issueUnixCommand) {
                Gui.errorMessage(
                    vscode.l10n.t({
                        message: "Not implemented yet for profile of type: {0}",
                        args: [profile.type],
                        comment: ["Profile type"],
                    })
                );
                return;
            }
            if (!node) {
                await this.profileInstance.checkCurrentProfile(profile);
            } else {
                cwd = node.fullPath;
            }
            if (cwd == "") {
                const options: vscode.InputBoxOptions = {
                    prompt: vscode.l10n.t("Enter the path of the directory in order to execute the command"),
                };
                cwd = await Gui.showInputBox(options);
                if (cwd == "") {
                    Gui.showMessage(vscode.l10n.t("Redirecting to Home Directory"));
                    this.pathInputConfirmationFlag = false;
                }
                if (cwd == undefined) {
                    Gui.showMessage(this.opCancelledMsg);
                    return;
                }
            }
            if (!command) {
                command = await this.getQuickPick(cwd);
            }
            await this.issueCommand(profile, command, cwd);
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

    public async setsshSession(): Promise<zosuss.SshSession> {
        ZoweLogger.trace("UnixCommandHandler.setsshSession called.");
        this.sshprofile = await this.getSshProfile();
        if (this.sshprofile) {
            const cmdArgs: imperative.ICommandArguments = this.getCmdArgs(this.sshprofile.profile as imperative.IProfileLoaded);
            // create the ssh session
            const sshSessCfg = zosuss.SshSession.createSshSessCfgFromArgs(cmdArgs);
            imperative.ConnectionPropsForSessCfg.resolveSessCfgProps<zosuss.ISshSession>(sshSessCfg, cmdArgs);
            this.sshSession = new zosuss.SshSession(sshSessCfg);
        } else {
            Gui.showMessage(this.opCancelledMsg);
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
                    placeHolder: vscode.l10n.t("Select the ssh Profile."),
                    ignoreFocusOut: true,
                    canPickMany: false,
                };
                const sesName = await Gui.showQuickPick(sshProfileNamesList, quickPickOptions);
                if (sesName === undefined) {
                    Gui.showMessage(this.opCancelledMsg);
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
        const profiles = await this.profileInstance.fetchAllProfilesByType("ssh");
        if (!profiles.length) {
            Gui.errorMessage(vscode.l10n.t("No SSH profile found. Please create an SSH profile."));
            return;
        }
        let sshProfile: imperative.IProfileLoaded;
        if (profiles.length > 0) {
            sshProfile = await this.selectSshProfile(profiles);
            if (!sshProfile) {
                return;
            }
            if (!(sshProfile.profile.host && sshProfile.profile.port)) {
                const currentProfile = await this.profileInstance.getProfileFromConfig(sshProfile.name);
                const filePath = currentProfile.profLoc.osLoc[0];
                await this.profileInstance.openConfigFile(filePath);
                Gui.errorMessage(vscode.l10n.t("SSH profile missing connection details. Please update."));
                return;
            }
            if (!(sshProfile.profile.user || sshProfile.profile.password) && !sshProfile.profile.privateKey) {
                const prompted = await this.profileInstance.promptCredentials(sshProfile);
                if (!prompted) {
                    return;
                }
            }
        }
        return sshProfile;
    }

    public async getProfile(session?: imperative.Session, node?: IZoweTreeNode): Promise<imperative.IProfileLoaded> {
        let profile: imperative.IProfileLoaded;
        if (node) {
            if (!session) {
                session = ZoweExplorerApiRegister.getUssApi(node.getProfile()).getSession();
                if (!session) {
                    return;
                }
            }
        }
        let res: boolean = true;
        if (!session) {
            const allProfiles = this.profileInstance.allProfiles;
            res = this.checkForSshRequired(allProfiles);
            const profileNamesList = ProfileManagement.getRegisteredProfileNameList(globals.Trees.USS);
            if (profileNamesList.length) {
                if (!res) {
                    const quickPickOptions: vscode.QuickPickOptions = {
                        placeHolder: vscode.l10n.t("Select the Profile to use to submit the Unix command"),
                        ignoreFocusOut: true,
                        canPickMany: false,
                    };
                    const sesName = await Gui.showQuickPick(profileNamesList, quickPickOptions);
                    if (sesName === undefined) {
                        Gui.showMessage(this.opCancelledMsg);
                        return;
                    }
                    profile = allProfiles.find((temprofile) => temprofile.name === sesName);
                }
                session = ZoweExplorerApiRegister.getUssApi(profile).getSession();
            } else {
                Gui.showMessage(vscode.l10n.t("No profiles available"));
                return;
            }
        } else {
            profile = node.getProfile();
        }
        return profile;
    }

    private async getQuickPick(cwd: string): Promise<string> {
        ZoweLogger.trace("UnixCommandHandler.getQuickPick called.");
        let response = "";
        const alwaysEdit: boolean = SettingsConfig.getDirectValue(globals.SETTINGS_COMMANDS_ALWAYS_EDIT);
        if (this.history.getSearchHistory().length > 0) {
            const createPick = new FilterDescriptor(UnixCommandHandler.defaultDialogText);
            const items: vscode.QuickPickItem[] = this.history.getSearchHistory().map((element) => new FilterItem({ text: element }));
            const quickpick = Gui.createQuickPick();
            quickpick.placeholder = alwaysEdit
                ? vscode.l10n.t({
                      message: "Select a Unix command to run against {0} (An option to edit will follow)",
                      args: [cwd],
                      comment: ["Current work directory"],
                  })
                : vscode.l10n.t({
                      message: "Select a Unix command to run immediately against {0}",
                      args: [cwd],
                      comment: ["Current work directory"],
                  });

            quickpick.items = [createPick, ...items];
            quickpick.ignoreFocusOut = true;
            quickpick.show();
            const choice = await Gui.resolveQuickPick(quickpick);
            quickpick.hide();
            if (!choice) {
                Gui.showMessage(this.opCancelledMsg);
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
            const options2: vscode.InputBoxOptions = {
                prompt: vscode.l10n.t("Enter or update the Unix command"),
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

    private async issueCommand(profile: imperative.IProfileLoaded, command: string, cwd: string): Promise<void> {
        ZoweLogger.trace("UnixCommandHandler.issueCommand called.");
        try {
            if (command) {
                // If the user has started their command with a / then remove it
                if (command.startsWith("/")) {
                    command = command.substring(1);
                }
                const user: string = profile.profile.user;
                if (this.sshprofile) {
                    this.outputChannel.appendLine(`> ${user}@${this.sshprofile.name}:${cwd ? cwd : "~"}$ ${command}`);
                } else {
                    this.outputChannel.appendLine(`> ${user}:${cwd ? cwd : "~"}$ ${command}`);
                }
                const submitResponse = await Gui.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: vscode.l10n.t("Unix command submitted."),
                    },
                    () => {
                        if (ZoweExplorerApiRegister.getCommandApi(profile).issueUnixCommand) {
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                            if (this.sshSession) {
                                return ZoweExplorerApiRegister.getCommandApi(profile).issueUnixCommand(
                                    command,
                                    cwd,
                                    this.pathInputConfirmationFlag,
                                    this.sshSession
                                );
                            } else {
                                return ZoweExplorerApiRegister.getCommandApi(profile).issueUnixCommand(command, cwd, this.pathInputConfirmationFlag);
                            }
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
