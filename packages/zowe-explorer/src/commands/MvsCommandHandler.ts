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
import { Validation, imperative, IZoweTreeNode, Gui } from "@zowe/zowe-explorer-api";
import { ICommandProviderDialogs, ZoweCommandProvider } from "./ZoweCommandProvider";
import { ZoweLogger } from "../tools/ZoweLogger";
import { Profiles } from "../configuration/Profiles";
import { ZoweExplorerApiRegister } from "../extending/ZoweExplorerApiRegister";
import { AuthUtils } from "../utils/AuthUtils";
import { Definitions } from "../configuration/Definitions";

/**
 * Provides a class that manages submitting a command on the server
 *
 * @export
 * @class MvsCommandHandler
 */
export class MvsCommandHandler extends ZoweCommandProvider {
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

    public readonly dialogs: ICommandProviderDialogs = {
        commandSubmitted: vscode.l10n.t("MVS command submitted."),
        defaultText: vscode.l10n.t("$(plus) Create a new MVS command"),
        selectProfile: vscode.l10n.t("Select an MVS profile for this command"),
        searchCommand: vscode.l10n.t("Enter or update the MVS command"),
        writeCommand: (options) =>
            vscode.l10n.t({
                message: "Select an MVS command to run against {0} (An option to edit will follow)",
                args: options,
                comment: ["Host name"],
            }),
        selectCommand: (options) =>
            vscode.l10n.t({
                message: "Select an MVS command to run immediately against {0}",
                args: options,
                comment: ["Host name"],
            }),
    };

    private static instance: MvsCommandHandler;

    public constructor() {
        super(vscode.l10n.t("Zowe MVS Command"));
    }

    /**
     * Allow the user to submit a MVS Console command to the selected server. Response is written
     * to the output channel.
     * @param session the session the command is to run against (optional) user is prompted if not supplied
     * @param command the command string (optional) user is prompted if not supplied
     */
    public async issueMvsCommand(session?: imperative.Session, command?: string, node?: IZoweTreeNode): Promise<void> {
        ZoweLogger.trace("MvsCommandHandler.issueMvsCommand called.");
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
                    let command1: string = command;
                    if (!command) {
                        command1 = await this.getQuickPick([session && session.ISession ? session.ISession.hostname : "unknown"]);
                    }
                    await this.issueCommand(profile, command1);
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

    public formatCommandLine(command: string): string {
        if (command.startsWith("/")) {
            command = command.substring(1);
        }
        return `> ${command}`;
    }

    public async runCommand(profile: imperative.IProfileLoaded, command: string): Promise<string> {
        if (command.startsWith("/")) {
            command = command.substring(1);
        }
        const response = await ZoweExplorerApiRegister.getCommandApi(profile).issueMvsCommand(command, profile.profile?.consoleName);
        return response.commandResponse;
    }
}
