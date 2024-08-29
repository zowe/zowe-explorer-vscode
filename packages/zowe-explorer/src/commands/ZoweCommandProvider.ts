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
import { Gui, imperative, IZoweTreeNode, PersistenceSchemaEnum, Validation } from "@zowe/zowe-explorer-api";
import { ZowePersistentFilters } from "../tools/ZowePersistentFilters";
import { ZoweLogger } from "../tools/ZoweLogger";
import { SharedContext } from "../trees/shared/SharedContext";
import { Profiles } from "../configuration/Profiles";
import { Constants } from "../configuration/Constants";
import { IconGenerator } from "../icons/IconGenerator";
import { IconUtils } from "../icons/IconUtils";
import { AuthUtils } from "../utils/AuthUtils";
import { ProfileManagement } from "../management/ProfileManagement";
import { Definitions } from "../configuration/Definitions";
import { SettingsConfig } from "../configuration/SettingsConfig";
import { FilterDescriptor, FilterItem } from "../management/FilterManagement";

export interface ICommandProviderDialogs {
    commandSubmitted: string;
    searchCommand: string;
    selectCommand: (args: string[]) => string;
    writeCommand: (args: string[]) => string;
    defaultText: string;
    selectProfile: string;
}

class ZoweTerminal implements vscode.Pseudoterminal {
    public static readonly termX = ">";
    public static readonly Keys = {
        EMPTY_LINE: `${this.termX} `,
        CLEAR_ALL: "\x1b[2J\x1b[3J\x1b[;H",
        CLEAR_LINE: `\x1b[2K\r${this.termX} `,
        DEL: "\x1b[P",
        ENTER: "\r",
        NEW_LINE: "\r\n",
        UP: "\x1b[A",
        DOWN: "\x1b[B",
        RIGHT: "\x1b[C",
        LEFT: "\x1b[D",
        BACKSPACE: "\x7f",
    };

    public runCommand: () => string;
    public constructor(public terminalName: string) {}

    protected command = "";
    protected history: string[] = [];
    private historyIndex = 0;

    private writeEmitter = new vscode.EventEmitter<string>();
    protected write(text: string) {
        this.writeEmitter.fire(text);
    }
    protected writeLine(text: string) {
        this.write(text);
        this.writeEmitter.fire(ZoweTerminal.Keys.NEW_LINE);
        this.writeEmitter.fire(ZoweTerminal.Keys.EMPTY_LINE);
    }
    protected refreshCmd() {
        this.write(ZoweTerminal.Keys.CLEAR_LINE);
        this.write(this.command);
    }
    private cursorPosition = 0;

    public onDidWrite: vscode.Event<string> = this.writeEmitter.event;

    private closeEmitter = new vscode.EventEmitter<void>();
    public onDidClose?: vscode.Event<void> = this.closeEmitter.event;

    // Start is called when the terminal is opened
    public open(initialDimensions: vscode.TerminalDimensions | undefined): void {
        this.writeLine(`Welcome to the ${this.terminalName} Terminal!`);
    }

    // Close is called when the terminal is closed
    public close(): void {
        this.closeEmitter.fire();
    }

    // Handle input from the terminal
    public handleInput(data: string): void {
        console.log(data, this.historyIndex, this.history);
        if (data === ZoweTerminal.Keys.UP) {
            this.command = this.history[this.historyIndex] ?? "";
            this.historyIndex = Math.max(0, this.historyIndex - 1);
            this.cursorPosition = this.command.length;
            this.refreshCmd();
            return;
        }
        if (data === ZoweTerminal.Keys.DOWN) {
            if (this.historyIndex === this.history.length - 1) {
                this.command = "";
            } else {
                this.historyIndex = Math.min(Math.max(0, this.history.length - 1), this.historyIndex + 1);
                this.command = this.history[this.historyIndex] ?? "";
            }
            this.cursorPosition = this.command.length;
            this.refreshCmd();
            return;
        }
        if (data === ZoweTerminal.Keys.LEFT) {
            this.cursorPosition = Math.max(0, this.cursorPosition - 1);
            this.write(ZoweTerminal.Keys.LEFT);
            return;
        }
        if (data === ZoweTerminal.Keys.RIGHT) {
            this.cursorPosition = Math.min(Math.max(0, this.command.length - 1), this.cursorPosition + 1);
            this.write(ZoweTerminal.Keys.RIGHT);
            return;
        }
        if (data === ZoweTerminal.Keys.BACKSPACE) {
            if (this.command.length === 0) {
                return;
            }
            const tmp = this.command.split("");
            tmp.splice(this.cursorPosition - 1, 1);
            this.cursorPosition--;
            this.command = tmp.join("");
            this.write(ZoweTerminal.Keys.LEFT);
            this.write(ZoweTerminal.Keys.DEL);
            // this.refreshCmd();
            return;
        }
        if (data === ZoweTerminal.Keys.ENTER) {
            this.write(ZoweTerminal.Keys.NEW_LINE);
            if (this.command.length === 0) {
                this.write(ZoweTerminal.Keys.EMPTY_LINE);
                return;
            }
            if (this.command === "hello") {
                this.writeLine("Hello there!");
            } else if (this.command === "date") {
                this.writeLine(`Current date: ${new Date().toLocaleString()}`);
            } else if (this.command === "exit") {
                this.writeLine("Exiting...");
                this.closeEmitter.fire();
            } else {
                this.writeLine(`Unknown command: ${this.command}`);
            }

            if (this.command !== this.history[this.historyIndex]) {
                this.historyIndex = this.history.length;
                this.history.push(this.command);
            }
            this.command = "";
            this.cursorPosition = 0;
            return;
        }

        this.writeEmitter.fire(data.trim());
        this.command += data.trim();
        this.cursorPosition++;
    }
}
export abstract class ZoweCommandProvider {
    // eslint-disable-next-line no-magic-numbers
    private static readonly totalFilters: number = 10;
    private readonly operationCancelled: string = vscode.l10n.t("Operation cancelled");
    public profileInstance: Profiles;
    public history: ZowePersistentFilters;
    // Event Emitters used to notify subscribers that the refresh event has fired
    public mOnDidChangeTreeData: vscode.EventEmitter<IZoweTreeNode | void> = new vscode.EventEmitter<IZoweTreeNode | undefined>();
    public readonly onDidChangeTreeData: vscode.Event<IZoweTreeNode | void> = this.mOnDidChangeTreeData.event;

    public abstract dialogs: ICommandProviderDialogs;
    private useIntegratedTerminals: boolean;
    public outputChannel: vscode.OutputChannel;
    public terminal: vscode.Terminal;
    public pseudoTerminal: ZoweTerminal;

    public constructor(terminalName: string) {
        this.history = new ZowePersistentFilters(PersistenceSchemaEnum.Commands, ZoweCommandProvider.totalFilters);
        this.profileInstance = Profiles.getInstance();

        this.useIntegratedTerminals = SettingsConfig.getDirectValue(Constants.SETTINGS_COMMANDS_INTEGRATED_TERMINALS) ?? true;
        if (this.useIntegratedTerminals) {
            // this.pseudoTerminal = new CustomPseudoterminal();
            this.pseudoTerminal = new ZoweTerminal(terminalName);
            this.terminal = vscode.window.createTerminal({ name: terminalName, pty: this.pseudoTerminal });
        } else {
            // Initialize terminal or output channel
            this.outputChannel = Gui.createOutputChannel(terminalName);
        }
    }

    public abstract formatCommandLine(command: string): string;
    public abstract runCommand(profile: imperative.IProfileLoaded, command: string): Promise<string>;

    public async issueCommand(profile: imperative.IProfileLoaded, command: string): Promise<void> {
        ZoweLogger.trace("MvsCommandHandler.issueCommand called.");
        try {
            if (!this.useIntegratedTerminals) this.outputChannel.appendLine(this.formatCommandLine(command));

            const response = await Gui.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: this.dialogs.commandSubmitted,
                },
                () => {
                    return this.runCommand(profile, command);
                }
            );
            if (this.useIntegratedTerminals) {
                // this.terminal.sendText(response);
                this.terminal.show(true);
            } else {
                this.outputChannel.appendLine(response);
                this.outputChannel.show(true);
            }
        } catch (error) {
            await AuthUtils.errorHandling(error, profile.name);
        }
        this.history.addSearchHistory(command);
    }

    public async selectNodeProfile(cmdTree: Definitions.Trees): Promise<imperative.IProfileLoaded> {
        ZoweLogger.trace("ZoweCommandProvider.selectNodeProfile called.");

        const profileNamesList = ProfileManagement.getRegisteredProfileNameList(cmdTree);
        if (profileNamesList.length > 0) {
            const quickPickOptions: vscode.QuickPickOptions = {
                placeHolder: this.dialogs.selectProfile,
                ignoreFocusOut: true,
                canPickMany: false,
            };
            const sesName = await Gui.showQuickPick(profileNamesList, quickPickOptions);
            if (sesName === undefined) {
                Gui.showMessage(this.operationCancelled);
                return;
            }
            const profile = this.profileInstance.allProfiles.find((tempProfile) => tempProfile.name === sesName);
            await this.profileInstance.checkCurrentProfile(profile);
            if (this.profileInstance.validProfile === Validation.ValidationType.INVALID) {
                Gui.errorMessage(vscode.l10n.t("Profile is invalid"));
                return;
            }
            return profile;
        } else {
            const noProfAvailable = vscode.l10n.t("No profiles available");
            ZoweLogger.info(noProfAvailable);
            Gui.showMessage(noProfAvailable);
        }
    }

    public async selectServiceProfile(profiles: imperative.IProfileLoaded[] = []): Promise<imperative.IProfileLoaded> {
        ZoweLogger.trace("ZoweCommandProvider.selectServiceProfile called.");
        let profile: imperative.IProfileLoaded;
        if (profiles.length > 1) {
            const profileNamesList = profiles.map((tempProfile) => {
                return tempProfile.name;
            });
            const quickPickOptions: vscode.QuickPickOptions = {
                placeHolder: this.dialogs.selectProfile,
                ignoreFocusOut: true,
                canPickMany: false,
            };
            const sesName = await Gui.showQuickPick(profileNamesList, quickPickOptions);
            if (sesName === undefined) {
                Gui.showMessage(this.operationCancelled);
                return;
            }
            profile = profiles.filter((tempProfile) => tempProfile.name === sesName)[0];
        } else if (profiles.length > 0) {
            profile = profiles[0];
        }
        return profile;
    }

    public async getQuickPick(dialogOptions: string[]): Promise<string> {
        ZoweLogger.trace("ZoweCommandProvider.getQuickPick called.");
        let response = "";
        const alwaysEdit: boolean = SettingsConfig.getDirectValue(Constants.SETTINGS_COMMANDS_ALWAYS_EDIT);
        if (this.history.getSearchHistory().length > 0) {
            const createPick = new FilterDescriptor(this.dialogs.defaultText);
            const items: vscode.QuickPickItem[] = this.history.getSearchHistory().map((element) => new FilterItem({ text: element }));
            const quickpick = Gui.createQuickPick();
            quickpick.placeholder = alwaysEdit ? this.dialogs.writeCommand(dialogOptions) : this.dialogs.selectCommand(dialogOptions);
            quickpick.items = [createPick, ...items];
            quickpick.ignoreFocusOut = true;
            quickpick.show();
            const choice = await Gui.resolveQuickPick(quickpick);
            quickpick.hide();
            if (!choice) {
                Gui.showMessage(this.operationCancelled);
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
            // manually entering a search
            const options2: vscode.InputBoxOptions = {
                prompt: this.dialogs.searchCommand,
                value: response,
                valueSelection: response ? [response.length, response.length] : undefined,
            };
            // get user input
            response = await Gui.showInputBox(options2);
            if (!response) {
                Gui.showMessage(this.operationCancelled);
                return;
            }
        }
        return response;
    }

    /**
     * Called whenever the tree needs to be refreshed, and fires the data change event
     *
     */
    public refreshElement(element: IZoweTreeNode): void {
        ZoweLogger.trace("ZoweCommandProvider.refreshElement called.");
        element.dirty = true;
        this.mOnDidChangeTreeData.fire(element);
    }

    /**
     * Called whenever the tree needs to be refreshed, and fires the data change event
     *
     */
    public refresh(): void {
        ZoweLogger.trace("ZoweCommandProvider.refresh called.");
        this.mOnDidChangeTreeData.fire();
    }

    public async checkCurrentProfile(node: IZoweTreeNode): Promise<Validation.IValidationProfile> {
        ZoweLogger.trace("ZoweCommandProvider.checkCurrentProfile called.");
        const profile = node.getProfile();
        const profileStatus = await Profiles.getInstance().checkCurrentProfile(profile);
        if (profileStatus.status === "inactive") {
            if (
                SharedContext.isSessionNotFav(node) &&
                (node.contextValue.toLowerCase().includes("session") || node.contextValue.toLowerCase().includes("server"))
            ) {
                node.contextValue = node.contextValue.replace(/(?<=.*)(_Active|_Inactive|_Unverified)$/, "");
                node.contextValue = node.contextValue + Constants.INACTIVE_CONTEXT;
                const inactiveIcon = IconGenerator.getIconById(IconUtils.IconId.sessionInactive);
                if (inactiveIcon) {
                    node.iconPath = inactiveIcon.path;
                }
            }

            await AuthUtils.errorHandling(
                vscode.l10n.t({
                    message:
                        "Profile Name {0} is inactive. Please check if your Zowe server is active or if the URL and port in your profile is correct.",
                    args: [profile.name],
                    comment: ["Profile name"],
                })
            );
        } else if (profileStatus.status === "active") {
            if (
                SharedContext.isSessionNotFav(node) &&
                (node.contextValue.toLowerCase().includes("session") || node.contextValue.toLowerCase().includes("server"))
            ) {
                node.contextValue = node.contextValue.replace(/(?<=.*)(_Active|_Inactive|_Unverified)$/, "");
                node.contextValue = node.contextValue + Constants.ACTIVE_CONTEXT;
                const activeIcon = IconGenerator.getIconById(IconUtils.IconId.sessionActive);
                if (activeIcon) {
                    node.iconPath = activeIcon.path;
                }
            }
        } else if (profileStatus.status === "unverified") {
            if (
                SharedContext.isSessionNotFav(node) &&
                (node.contextValue.toLowerCase().includes("session") || node.contextValue.toLowerCase().includes("server"))
            ) {
                node.contextValue = node.contextValue.replace(/(?<=.*)(_Active|_Inactive|_Unverified)$/, "");
                node.contextValue = node.contextValue + Constants.UNVERIFIED_CONTEXT;
            }
        }
        this.refresh();
        return profileStatus;
    }
}
