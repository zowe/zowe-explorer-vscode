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
import { ICommandProviderDialogs, ZoweCommandProvider } from "./ZoweCommandProvider";
import { Gui, IZoweTreeNode, PersistenceSchemaEnum, Validation, imperative } from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../extending/ZoweExplorerApiRegister";
import { ZoweLogger } from "../tools/ZoweLogger";
import { AuthUtils } from "../utils/AuthUtils";
import { Definitions } from "../configuration/Definitions";
import { ZowePersistentFilters } from "../tools/ZowePersistentFilters";

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

    public history: ZowePersistentFilters;
    private static instance: UnixCommandHandler;
    private nodeProfile: imperative.IProfileLoaded = undefined;
    private unixCmdMsgs = {
        issueCmdNotSupportedMsg: (profileType: string) =>
            vscode.l10n.t({
                message: "Issuing commands is not supported for this profile type, {0}.",
                args: [profileType],
                comment: ["Profile type"],
            }),
        issueUnixCmdNotSupportedMsg: (profileType: string) =>
            vscode.l10n.t({
                message: "Issuing UNIX commands is not supported for this profile type, {0}.",
                args: [profileType],
                comment: ["Profile type"],
            }),
        sshSessionErrorMsg: vscode.l10n.t("Error preparing SSH connection for issuing UNIX commands, please check SSH profile for correctness."),
        cwdRedirectingMsg: vscode.l10n.t("Redirecting to Home Directory"),
        sshProfMissingInfoMsg: vscode.l10n.t("SSH profile missing connection details. Please update."),
        sshProfNotFoundMsg: vscode.l10n.t("No SSH profile found. Please create an SSH profile."),
    };

    public sshCwd: string;
    public sshSession: zosuss.SshSession;
    public sshProfile: imperative.IProfileLoaded;
    public isSshRequiredForProf: boolean = false;

    public readonly dialogs: ICommandProviderDialogs = {
        commandSubmitted: vscode.l10n.t("Unix command submitted."),
        defaultText: vscode.l10n.t("$(plus) Create a new Unix command"),
        selectProfile: vscode.l10n.t("Select an SSH profile for this command"),
        searchCommand: vscode.l10n.t("Enter or update the Unix command"),
        writeCommand: (options) =>
            vscode.l10n.t({
                message: "Select a Unix command to run against {0} (An option to edit will follow)",
                args: options,
                comment: ["Current work directory"],
            }),
        selectCommand: (options) =>
            vscode.l10n.t({
                message: "Select a Unix command to run immediately against {0}",
                args: options,
                comment: ["Current work directory"],
            }),
    };

    public constructor() {
        super(vscode.l10n.t("Zowe Unix Command"));
        this.history = new ZowePersistentFilters(PersistenceSchemaEnum.UssCommands, ZoweCommandProvider.totalFilters);
    }

    public async issueUnixCommand(node?: IZoweTreeNode, command?: string): Promise<void> {
        ZoweLogger.trace("UnixCommandHandler.issueUnixCommand called.");

        if (node) {
            await this.checkCurrentProfile(node);
            this.nodeProfile = node.getProfile();
            this.sshCwd = node.fullPath;
        }
        if (!this.nodeProfile) {
            this.nodeProfile = await this.selectNodeProfile(Definitions.Trees.USS);
            if (!this.nodeProfile) {
                return;
            }
        }
        try {
            // check for availability of all needed ZE APIs for issuing UNIX commands
            const commandApi = ZoweExplorerApiRegister.getInstance().getCommandApi(this.nodeProfile);
            if (!commandApi) {
                ZoweLogger.error(this.unixCmdMsgs.issueCmdNotSupportedMsg(this.nodeProfile.type));
                Gui.errorMessage(this.unixCmdMsgs.issueCmdNotSupportedMsg(this.nodeProfile.type));
                return;
            }
            if (!ZoweExplorerApiRegister.getCommandApi(this.nodeProfile).issueUnixCommand) {
                ZoweLogger.error(this.unixCmdMsgs.issueUnixCmdNotSupportedMsg(this.nodeProfile.type));
                Gui.errorMessage(this.unixCmdMsgs.issueUnixCmdNotSupportedMsg(this.nodeProfile.type));
                this.nodeProfile = undefined;
                return;
            }
            try {
                this.isSshRequiredForProf = ZoweExplorerApiRegister.getCommandApi(this.nodeProfile).sshProfileRequired();
                ZoweLogger.info(
                    vscode.l10n.t("An SSH profile will be used for issuing UNIX commands with the profile {0}.", [this.nodeProfile?.name])
                );
            } catch (e) {
                // error would be due to missing API, assuming SSH profile not required
                ZoweLogger.warn(
                    vscode.l10n.t(
                        "Error checking if SSH profile type required for issuing UNIX commands, setting requirement to false for profile {0}.",
                        [this.nodeProfile?.name]
                    )
                );
            }

            await this.profileInstance.checkCurrentProfile(this.nodeProfile);
            if (this.profileInstance.validProfile === Validation.ValidationType.INVALID) {
                Gui.errorMessage(vscode.l10n.t("Profile is invalid"));
                return;
            }

            if (this.isSshRequiredForProf) {
                await this.getSshProfile();
                if (!this.sshProfile) {
                    return;
                }
                const cmdArgs: imperative.ICommandArguments = this.getSshCmdArgs(this.sshProfile.profile);
                // create the ssh session
                const sshSessCfg = zosuss.SshSession.createSshSessCfgFromArgs(cmdArgs);
                imperative.ConnectionPropsForSessCfg.resolveSessCfgProps<zosuss.ISshSession>(sshSessCfg, cmdArgs);
                this.sshSession = new zosuss.SshSession(sshSessCfg);

                const profileStatus = await this.profileInstance.profileValidationHelper(
                    this.sshProfile,
                    async (prof: imperative.IProfileLoaded, type: string): Promise<string> => {
                        if (type !== "ssh" || prof.profile.host !== this.sshSession.ISshSession.hostname) return "unverified";
                        if (await zosuss.Shell.isConnectionValid(this.sshSession)) {
                            return "active";
                        }
                        return "inactive";
                    }
                );

                if (!this.sshSession || profileStatus !== "active") {
                    this.nodeProfile = undefined;
                    ZoweLogger.error(this.unixCmdMsgs.sshSessionErrorMsg);
                    Gui.errorMessage(this.unixCmdMsgs.sshSessionErrorMsg);
                    return;
                }
            }

            if (!this.sshCwd) {
                const options: vscode.InputBoxOptions = {
                    prompt: vscode.l10n.t("Enter the path of the directory in order to execute the command"),
                };
                this.sshCwd = await Gui.showInputBox(options);
                if (this.sshCwd === "") {
                    ZoweLogger.info(this.unixCmdMsgs.cwdRedirectingMsg);
                    Gui.showMessage(this.unixCmdMsgs.cwdRedirectingMsg);
                }
                if (this.sshCwd == undefined) {
                    this.nodeProfile = undefined;
                    ZoweLogger.info(this.operationCancelled);
                    return;
                }
            }
            if (!command) {
                command = await this.getQuickPick([this.sshCwd]);
            }
            await this.issueCommand(this.nodeProfile, command);
        } catch (error) {
            if (error.toString().includes("non-existing")) {
                ZoweLogger.error(error);
                Gui.errorMessage(
                    vscode.l10n.t({
                        message: "Not implemented yet for profile of type: {0}",
                        args: [this.nodeProfile.type],
                        comment: ["Profile type"],
                    })
                );
            } else {
                await AuthUtils.errorHandling(error, this.nodeProfile.name);
            }
        }
    }

    private async getSshProfile(): Promise<void> {
        const profiles = await this.profileInstance.fetchAllProfilesByType("ssh");
        if (!profiles.length) {
            ZoweLogger.error(this.unixCmdMsgs.sshProfNotFoundMsg);
            Gui.errorMessage(this.unixCmdMsgs.sshProfNotFoundMsg);
            return;
        }
        this.sshProfile = await this.selectServiceProfile(profiles);
        if (!this.sshProfile) {
            return;
        }
        if (!(this.sshProfile.profile.host && this.sshProfile.profile.port)) {
            const currentProfile = await this.profileInstance.getProfileFromConfig(this.sshProfile.name);
            const filePath = currentProfile.profLoc.osLoc?.[0];
            await this.profileInstance.openConfigFile(filePath);
            ZoweLogger.error(this.unixCmdMsgs.sshProfMissingInfoMsg);
            Gui.errorMessage(this.unixCmdMsgs.sshProfMissingInfoMsg);
            return;
        }
        if (!(this.sshProfile.profile.user || this.sshProfile.profile.password) && !this.sshProfile.profile.privateKey) {
            const prompted = await this.profileInstance.promptCredentials(this.sshProfile);
            if (!prompted) {
                return;
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

    public formatCommandLine(command: string, profile?: imperative.IProfileLoaded): string {
        const prof = this.nodeProfile ?? profile;
        const user: string = prof?.profile.user;
        if (prof) {
            return `> ${user}@${prof.name}:${this.sshCwd ?? "~"} $ ${command}`;
        } else {
            return `> ${user}:${this.sshCwd ?? "~"} $ ${command}`;
        }
    }

    public runCommand(profile: imperative.IProfileLoaded, command: string): Promise<string> {
        // Clear path and selected profile for follow up commands from the command palette
        this.nodeProfile = undefined;
        return ZoweExplorerApiRegister.getCommandApi(profile).issueUnixCommand(command, this.sshCwd, this.sshSession);
    }
}
