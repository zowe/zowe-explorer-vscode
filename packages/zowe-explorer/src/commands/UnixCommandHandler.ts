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
import * as zosuss from "@zowe/zos-uss-for-zowe-sdk";
import { ZoweCommandProvider } from "./ZoweCommandProvider";
import { Gui, IZoweTreeNode, imperative } from "@zowe/zowe-explorer-api";
import { Profiles } from "../configuration/Profiles";
import { ZoweExplorerApiRegister } from "../extending/ZoweExplorerApiRegister";
import { ZoweLogger } from "../tools/ZoweLogger";
import { ProfileManagement } from "../management/ProfileManagement";
import { Constants } from "../configuration/Constants";
import { SettingsConfig } from "../configuration/SettingsConfig";
import { FilterDescriptor, FilterItem } from "../management/FilterManagement";
import { AuthUtils } from "../utils/AuthUtils";
import { Definitions } from "../configuration/Definitions";

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
    private serviceProf: imperative.IProfileLoaded = undefined;
    private unixCmdMsgs = {
        opCancelledMsg: vscode.l10n.t("Operation Cancelled"),
        issueCmdNotSupportedMsg: vscode.l10n.t({
            message: "Issuing commands is not supported for this profile type, {0}.",
            args: [this.serviceProf?.type],
            comment: ["Profile type"],
        }),
        issueUnixCmdNotSupportedMsg: vscode.l10n.t({
            message: "Issuing UNIX commands is not supported for this profile type, {0}.",
            args: [this.serviceProf?.type],
            comment: ["Profile type"],
        }),
        sshSessionErrorMsg: vscode.l10n.t("Error preparring SSH connection for issueing UNIX commands, please check SSH profile for correctness."),
        sshProfNotFoundMsg: vscode.l10n.t("No SSH profile found. Please create an SSH profile."),
        sshProfMissingInfoMsg: vscode.l10n.t("SSH profile missing connection details. Please update."),
        noProfilesAvailableMsg: vscode.l10n.t("No profiles available."),
        cwdRedirectingMsg: vscode.l10n.t("Redirecting to Home Directory"),
    };

    public profileInstance = Profiles.getInstance();
    public outputChannel: vscode.OutputChannel;
    public sshSession: zosuss.SshSession;
    public sshProfile: imperative.IProfileLoaded;
    public isSshRequiredForProf: boolean = false;

    public constructor() {
        super();
        this.outputChannel = Gui.createOutputChannel(vscode.l10n.t("Zowe Unix Command"));
    }

    public async issueUnixCommand(node?: IZoweTreeNode, command?: string): Promise<void> {
        let cwd: string;
        if (node) {
            this.serviceProf = node.getProfile();
            cwd = node.fullPath;
        }
        if (!this.serviceProf) {
            this.serviceProf = await this.userSelectProfile();
            if (!this.serviceProf) {
                return;
            }
        }
        try {
            // check for availability of all needed ZE APIs for issuing UNIX commands
            const commandApi = ZoweExplorerApiRegister.getInstance().getCommandApi(this.serviceProf);
            if (!commandApi) {
                ZoweLogger.error(this.unixCmdMsgs.issueCmdNotSupportedMsg);
                Gui.errorMessage(this.unixCmdMsgs.issueCmdNotSupportedMsg);
                return;
            }
            if (!ZoweExplorerApiRegister.getCommandApi(this.serviceProf).issueUnixCommand) {
                ZoweLogger.error(this.unixCmdMsgs.issueUnixCmdNotSupportedMsg);
                Gui.errorMessage(
                    vscode.l10n.t({
                        message: "Issuing UNIX commands is not supported for this profile type, {0}.",
                        args: [this.serviceProf?.type],
                        comment: ["Profile type"],
                    })
                );
                return;
            }
            try {
                this.isSshRequiredForProf = ZoweExplorerApiRegister.getCommandApi(this.serviceProf).sshProfileRequired();
                ZoweLogger.info(
                    vscode.l10n.t("An SSH profile will be used for issuing UNIX commands with the profile {0}.", [this.serviceProf?.name])
                );
            } catch (e) {
                // error would be due to missing API, assuming SSH profile not required
                ZoweLogger.warn(
                    vscode.l10n.t(
                        "Error checking if SSH profile type required for issueing UNIX commands, setting requirement to false for profile {0}.",
                        [this.serviceProf?.name]
                    )
                );
            }
            await this.profileInstance.checkCurrentProfile(this.serviceProf);

            if (this.isSshRequiredForProf) {
                await this.setsshSession();
                if (!this.sshSession) {
                    this.serviceProf = undefined;
                    ZoweLogger.error(this.unixCmdMsgs.sshSessionErrorMsg);
                    Gui.errorMessage(this.unixCmdMsgs.sshSessionErrorMsg);
                    return;
                }
            }

            if (!cwd) {
                const options: vscode.InputBoxOptions = {
                    prompt: vscode.l10n.t("Enter the path of the directory in order to execute the command"),
                };
                cwd = await Gui.showInputBox(options);
                if (cwd === "") {
                    ZoweLogger.info(this.unixCmdMsgs.cwdRedirectingMsg);
                    Gui.showMessage(this.unixCmdMsgs.cwdRedirectingMsg);
                }
                if (cwd == undefined) {
                    this.serviceProf = undefined;
                    ZoweLogger.info(this.unixCmdMsgs.opCancelledMsg);
                    Gui.showMessage(this.unixCmdMsgs.opCancelledMsg);
                    return;
                }
            }
            if (!command) {
                command = await this.getQuickPick(cwd);
            }
            await this.issueCommand(this.serviceProf, command, cwd);
        } catch (error) {
            if (error.toString().includes("non-existing")) {
                ZoweLogger.error(error);
                Gui.errorMessage(
                    vscode.l10n.t({
                        message: "Not implemented yet for profile of type: {0}",
                        args: [this.serviceProf.type],
                        comment: ["Profile type"],
                    })
                );
            } else {
                await AuthUtils.errorHandling(error, this.serviceProf.name);
            }
        }
    }

    public checkForSshRequiredForAllTypes(allProfiles: imperative.IProfileLoaded[]): boolean {
        const sshReqArray: boolean[] = [];
        try {
            allProfiles.forEach((p) => {
                sshReqArray.push(ZoweExplorerApiRegister.getCommandApi(p).sshProfileRequired());
            });
            sshReqArray.every((v) => v === true);
        } catch (error) {
            return false;
        }
    }

    public async setsshSession(): Promise<void> {
        ZoweLogger.trace("UnixCommandHandler.setsshSession called.");
        await this.getSshProfile();
        if (this.sshProfile) {
            const cmdArgs: imperative.ICommandArguments = this.getSshCmdArgs(this.sshProfile.profile);
            // create the ssh session
            const sshSessCfg = zosuss.SshSession.createSshSessCfgFromArgs(cmdArgs);
            imperative.ConnectionPropsForSessCfg.resolveSessCfgProps<zosuss.ISshSession>(sshSessCfg, cmdArgs);
            this.sshSession = new zosuss.SshSession(sshSessCfg);
        } else {
            ZoweLogger.info(this.unixCmdMsgs.opCancelledMsg);
            Gui.showMessage(this.unixCmdMsgs.opCancelledMsg);
        }
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
                    Gui.showMessage(this.unixCmdMsgs.opCancelledMsg);
                    return;
                }

                sshProfile = sshProfiles.filter((temprofile) => temprofile.name === sesName)[0];
            }
        } else if (sshProfiles.length > 0) {
            sshProfile = sshProfiles[0];
        }
        return sshProfile;
    }

    private async getSshProfile(): Promise<void> {
        ZoweLogger.trace("UnixCommandHandler.getsshProfile called.");
        const profiles = await this.profileInstance.fetchAllProfilesByType("ssh");
        if (!profiles.length) {
            ZoweLogger.error(this.unixCmdMsgs.sshProfNotFoundMsg);
            Gui.errorMessage(this.unixCmdMsgs.sshProfNotFoundMsg);
            return;
        }
        if (profiles.length > 0) {
            this.sshProfile = await this.selectSshProfile(profiles);
            if (!this.sshProfile) {
                return;
            }
            if (!(this.sshProfile.profile.host && this.sshProfile.profile.port)) {
                const currentProfile = await this.profileInstance.getProfileFromConfig(this.sshProfile.name);
                const filePath = currentProfile.profLoc.osLoc[0];
                await this.profileInstance.openConfigFile(filePath);
                ZoweLogger.error(this.unixCmdMsgs.sshProfMissingInfoMsg);
                Gui.errorMessage(this.unixCmdMsgs.sshProfMissingInfoMsg);
                return;
            }
            const baseProfile = Constants.PROFILES_CACHE.getDefaultProfile("base");
            if (baseProfile.profile.user && baseProfile.profile.password) {
                this.sshProfile.profile.user = baseProfile.profile.user;
                this.sshProfile.profile.password = baseProfile.profile.password;
            }
            if (!(this.sshProfile.profile.user || this.sshProfile.profile.password) && !this.sshProfile.profile.privateKey) {
                const prompted = await this.profileInstance.promptCredentials(this.sshProfile);
                if (!prompted) {
                    return;
                }
            }
        }
    }

    private getSshCmdArgs(sshProfile: imperative.IProfile): imperative.ICommandArguments {
        const cmdArgs: imperative.ICommandArguments = {
            $0: "zowe",
            _: [""],
        };
        for (const prop of Object.keys(sshProfile)) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            cmdArgs[prop] = sshProfile[prop];
        }
        return cmdArgs;
    }

    private async userSelectProfile(): Promise<imperative.IProfileLoaded> {
        const allProfiles = this.profileInstance.allProfiles;
        const sshReq = this.checkForSshRequiredForAllTypes(allProfiles);
        const profileNamesList = ProfileManagement.getRegisteredProfileNameList(Definitions.Trees.USS);
        if (profileNamesList.length) {
            if (!sshReq) {
                const quickPickOptions: vscode.QuickPickOptions = {
                    placeHolder: vscode.l10n.t("Select the Profile to use to submit the Unix command"),
                    ignoreFocusOut: true,
                    canPickMany: false,
                };
                const sesName = await Gui.showQuickPick(profileNamesList, quickPickOptions);
                if (sesName === undefined) {
                    Gui.showMessage(this.unixCmdMsgs.opCancelledMsg);
                    return;
                }
                return allProfiles.find((temprofile) => temprofile.name === sesName);
            }
        } else {
            ZoweLogger.info(this.unixCmdMsgs.noProfilesAvailableMsg);
            Gui.showMessage(this.unixCmdMsgs.noProfilesAvailableMsg);
        }
    }

    private async getQuickPick(cwd: string): Promise<string> {
        ZoweLogger.trace("UnixCommandHandler.getQuickPick called.");
        let response = "";
        const alwaysEdit: boolean = SettingsConfig.getDirectValue(Constants.SETTINGS_COMMANDS_ALWAYS_EDIT);
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
                this.serviceProf = undefined;
                ZoweLogger.info(this.unixCmdMsgs.opCancelledMsg);
                Gui.showMessage(this.unixCmdMsgs.opCancelledMsg);
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
                this.serviceProf = undefined;
                ZoweLogger.info(this.unixCmdMsgs.opCancelledMsg);
                Gui.showMessage(this.unixCmdMsgs.opCancelledMsg);
                return;
            }
        }
        return response;
    }

    private async issueCommand(profile: imperative.IProfileLoaded, command: string, cwd: string): Promise<void> {
        ZoweLogger.trace("UnixCommandHandler.issueCommand called.");
        try {
            if (command) {
                const user: string = profile.profile.user;
                if (this.sshProfile) {
                    this.outputChannel.appendLine(`> ${user}@${this.sshProfile.name}:${cwd ? cwd : "~"}$ ${command}`);
                } else {
                    this.outputChannel.appendLine(`> ${user}:${cwd ? cwd : "~"}$ ${command}`);
                }
                const submitResponse = await Gui.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: vscode.l10n.t("Unix command submitted."),
                    },
                    () => {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                        return ZoweExplorerApiRegister.getCommandApi(profile).issueUnixCommand(command, cwd, this.sshSession);
                    }
                );
                this.outputChannel.appendLine(submitResponse);
                this.outputChannel.show(true);
                this.history.addSearchHistory(command);
                this.serviceProf = undefined;
            }
        } catch (error) {
            await AuthUtils.errorHandling(error, this.sshProfile.name);
        }
    }
}
