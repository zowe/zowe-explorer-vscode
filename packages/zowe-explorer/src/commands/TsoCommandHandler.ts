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
import * as zostso from "@zowe/zos-tso-for-zowe-sdk";
import { Gui, Validation, imperative, IZoweTreeNode } from "@zowe/zowe-explorer-api";
import { ZoweCommandProvider } from "./ZoweCommandProvider";
import { ZoweLogger } from "../tools/ZoweLogger";
import { Profiles } from "../configuration/Profiles";
import { ZoweExplorerApiRegister } from "../extending/ZoweExplorerApiRegister";
import { AuthUtils } from "../utils/AuthUtils";
import { Definitions } from "../configuration/Definitions";

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

    private static instance: TsoCommandHandler;
    public outputChannel: vscode.OutputChannel;

    public readonly defaultDialogText: string = vscode.l10n.t("$(plus) Create a new TSO command");

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
            profile = await this.selectNodeProfile(Definitions.Trees.MVS);
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
                await AuthUtils.errorHandling(error, profile.name);
            }
        }
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
                await AuthUtils.errorHandling(error, profile.name);
            }
        }
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
            tsoProfile = await this.selectServiceProfile(profiles.map((p) => imperative.ProfileInfo.profAttrsToProfLoaded(p)));
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
