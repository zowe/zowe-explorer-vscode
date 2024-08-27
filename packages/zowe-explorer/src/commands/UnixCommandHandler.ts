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
import { ZoweExplorerApiRegister } from "../extending/ZoweExplorerApiRegister";
import { ZoweLogger } from "../tools/ZoweLogger";
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

    public readonly defaultDialogText: string = vscode.l10n.t("$(plus) Create a new Unix command");
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
        cwdRedirectingMsg: vscode.l10n.t("Redirecting to Home Directory"),
    };

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
            // await this.checkCurrentProfile(node);
            this.serviceProf = node.getProfile();
            cwd = node.fullPath;
        }
        if (!this.serviceProf) {
            this.serviceProf = await this.selectNodeProfile(Definitions.Trees.USS);
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
                this.serviceProf = undefined;
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
                const profiles = await this.profileInstance.fetchAllProfilesByType("ssh");
                this.sshProfile = await this.selectServiceProfile(profiles);

                const cmdArgs: imperative.ICommandArguments = this.getSshCmdArgs(this.sshProfile.profile);
                // create the ssh session
                const sshSessCfg = zosuss.SshSession.createSshSessCfgFromArgs(cmdArgs);
                imperative.ConnectionPropsForSessCfg.resolveSessCfgProps<zosuss.ISshSession>(sshSessCfg, cmdArgs);
                this.sshSession = new zosuss.SshSession(sshSessCfg);

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

    private async issueCommand(profile: imperative.IProfileLoaded, command: string, cwd: string): Promise<void> {
        ZoweLogger.trace("UnixCommandHandler.issueCommand called.");
        const profName = this.sshProfile !== undefined ? this.sshProfile.name : profile.name;
        try {
            if (command) {
                const user: string = profile.profile.user;
                if (this.serviceProf) {
                    this.outputChannel.appendLine(`> ${user}@${this.serviceProf.name}:${cwd ? cwd : "~"}$ ${command}`);
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
            await AuthUtils.errorHandling(error, profName);
        }
    }
}
