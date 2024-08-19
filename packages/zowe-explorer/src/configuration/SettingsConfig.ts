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
import { Gui, PersistenceSchemaEnum } from "@zowe/zowe-explorer-api";
import { Constants } from "./Constants";
import { ZoweLocalStorage } from "../tools/ZoweLocalStorage";
import { Definitions } from "./Definitions";
import { ZoweLogger } from "../tools/ZoweLogger";

export class SettingsConfig {
    /**
     * Retrieves a generic setting either in user or workspace.
     * <pre>{@code
     *  SettingsConfig.getDirectValue<boolean>("zowe.commands.alwaysEdit");
     * }</pre>
     * @param {string} key - The config property that needs retrieving
     * @param {T} defaultValue - Default value if config property is undefined
     */
    public static getDirectValue<T>(key: string, defaultValue?: T): T {
        const [first, ...rest] = key.split(".");
        return vscode.workspace.getConfiguration(first).get(rest.join("."), defaultValue);
    }

    /**
     * Updates a generic setting either in user or workspace.
     * <pre>{@code
     *  SettingsConfig.setDirectValue("zowe.commands.alwaysEdit", true);
     * }</pre>
     * @param {string} key - The config property that needs updating
     * @param {any} value - The value to assign for the config property
     * @param target - VS Code configuration target (global or workspace)
     */
    public static setDirectValue(key: string, value: any, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Thenable<void> {
        const [first, ...rest] = key.split(".");
        return vscode.workspace.getConfiguration(first).update(rest.join("."), value, target);
    }

    public static isConfigSettingSetByUser(key: string): boolean {
        const [first, ...rest] = key.split(".");
        const inspect = vscode.workspace.getConfiguration(first).inspect(rest.join("."));
        if (inspect === undefined) {
            return false;
        }

        return (
            inspect.globalValue !== undefined ||
            inspect.workspaceValue !== undefined ||
            inspect.workspaceFolderValue !== undefined ||
            inspect.globalLanguageValue !== undefined ||
            inspect.workspaceLanguageValue !== undefined ||
            inspect.workspaceFolderLanguageValue !== undefined
        );
    }

    /**
     * Checks if the Zowe Explorer major version does not match
     * the version defined in the user's `settings.json` file.
     *
     * @param userVersion The user's version defined in settings.json
     * @param versionString The current version string for Zowe Explorer
     * @returns false if the version *roughly* matches, true otherwise - e.g.:
     *
     * `majorVersionMismatch("2.6.1", "2")` will return `false`
     *
     * `majorVersionMismatch("3", "2")` will return `true`
     */
    public static majorVersionMismatch(userVersion: string, versionString: string): boolean {
        if (userVersion == null) {
            return true;
        }

        if (userVersion.startsWith(versionString)) {
            return false;
        }

        return userVersion !== versionString;
    }

    public static async standardizeSettings(): Promise<void> {
        // uncomment next line to mock setting being false for dev & test if local storage already been activated.
        // ZoweLocalStorage.setValue<boolean>(Definitions.LocalStorageKey.SETTINGS_LOCAL_STORAGE_MIGRATED, false);

        const localStorageIsMigrated = ZoweLocalStorage.getValue<boolean>(Definitions.LocalStorageKey.SETTINGS_LOCAL_STORAGE_MIGRATED);
        const globalIsMigrated = ZoweLocalStorage.getValue<boolean>(Definitions.LocalStorageKey.SETTINGS_OLD_SETTINGS_MIGRATED);
        const workspaceIsMigrated = SettingsConfig.configurations.inspect(Definitions.LocalStorageKey.SETTINGS_OLD_SETTINGS_MIGRATED).workspaceValue;
        const workspaceIsOpen = vscode.workspace.workspaceFolders !== undefined;
        const zoweSettingsExist = SettingsConfig.zoweOldConfigurations.length > 0;

        if (!localStorageIsMigrated) {
            await SettingsConfig.migrateToLocalStorage();
        }

        if (!zoweSettingsExist) {
            ZoweLocalStorage.setValue<boolean>(Definitions.LocalStorageKey.SETTINGS_OLD_SETTINGS_MIGRATED, true);
            return;
        }

        if (!workspaceIsMigrated && workspaceIsOpen) {
            await SettingsConfig.standardizeWorkspaceSettings();
        }

        if (!globalIsMigrated) {
            await SettingsConfig.standardizeGlobalSettings();
        }
    }

    private static get configurations(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration();
    }

    private static get zoweOldConfigurations(): string[] {
        return Object.keys(SettingsConfig.configurations).filter((key) => key.match(new RegExp("Zowe-*|Zowe\\s*", "g")));
    }

    private static async promptReload(): Promise<void> {
        // Prompt user to reload VS Code window
        const reloadButton = vscode.l10n.t("Reload Window");
        const infoMsg = vscode.l10n.t(
            // eslint-disable-next-line max-len
            "Settings have been successfully migrated for Zowe Explorer version 2 and above. To apply these settings, please reload your VS Code window."
        );
        await Gui.showMessage(infoMsg, { items: [reloadButton] })?.then(async (selection) => {
            if (selection === reloadButton) {
                await vscode.commands.executeCommand("workbench.action.reloadWindow");
            }
        });
    }

    private static async standardizeGlobalSettings(): Promise<void> {
        let globalIsMigrated = ZoweLocalStorage.getValue<boolean>(Definitions.LocalStorageKey.SETTINGS_OLD_SETTINGS_MIGRATED);

        // Standardize global settings when old Zowe settings were found
        if (SettingsConfig.zoweOldConfigurations.length > 0) {
            for (const configuration of SettingsConfig.zoweOldConfigurations) {
                const globalValue = SettingsConfig.configurations.inspect(configuration).globalValue;
                const newSetting = Constants.configurationDictionary[configuration];

                if (globalValue !== undefined && newSetting !== undefined) {
                    await SettingsConfig.setDirectValue(newSetting, globalValue);
                    globalIsMigrated = true;
                }
            }
        }

        if (globalIsMigrated) {
            ZoweLocalStorage.setValue<boolean>(Definitions.LocalStorageKey.SETTINGS_OLD_SETTINGS_MIGRATED, true);
            await SettingsConfig.promptReload();
        }
    }

    private static async standardizeWorkspaceSettings(): Promise<void> {
        let workspaceIsMigrated = false;
        // Standardize workspace settings when old Zowe settings were found
        if (SettingsConfig.zoweOldConfigurations.length > 0) {
            // filter to only supported workspace configurations in scope
            const filteredConfigurations = SettingsConfig.zoweOldConfigurations.filter(
                (c) => !c.match(new RegExp("Zowe-[A-Za-z]+-Persistent|Zowe Commands: History", "g"))
            );

            for (const configuration of filteredConfigurations) {
                const workspaceValue = SettingsConfig.configurations.inspect(configuration).workspaceValue;
                const newSetting = Constants.configurationDictionary[configuration];

                if (workspaceValue !== undefined && newSetting !== undefined) {
                    await SettingsConfig.setDirectValue(newSetting, workspaceValue, vscode.ConfigurationTarget.Workspace);
                    workspaceIsMigrated = true;
                }
            }
        }

        if (workspaceIsMigrated) {
            await SettingsConfig.setDirectValue(
                Definitions.LocalStorageKey.SETTINGS_OLD_SETTINGS_MIGRATED,
                true,
                vscode.ConfigurationTarget.Workspace
            );
        }
    }

    private static async migrateToLocalStorage(): Promise<void> {
        // Migrate persistent settings to new LocalStorage solution
        const persistentSettings = [
            PersistenceSchemaEnum.Dataset,
            PersistenceSchemaEnum.USS,
            PersistenceSchemaEnum.Job,
            PersistenceSchemaEnum.Commands,
            Definitions.LocalStorageKey.CLI_LOGGER_SETTING_PRESENTED,
        ];
        const vscodePersistentSettings = persistentSettings.filter((setting) => {
            return SettingsConfig.configurations.inspect(setting).globalValue;
        });
        if (vscodePersistentSettings.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            vscodePersistentSettings.forEach(async (setting) => {
                ZoweLogger.debug(setting.toString());
                if (setting === PersistenceSchemaEnum.Dataset) {
                    await this.setMigratedDsTemplates();
                }
                ZoweLocalStorage.setValue(setting, SettingsConfig.configurations.inspect(setting).globalValue);
                SettingsConfig.setDirectValue(setting, undefined, vscode.ConfigurationTarget.Global);
            });
            ZoweLocalStorage.setValue(Definitions.LocalStorageKey.SETTINGS_LOCAL_STORAGE_MIGRATED, true);
            await SettingsConfig.promptReload();
        }
    }

    public static async setMigratedDsTemplates(): Promise<void> {
        const settings: any = this.getDirectValue(PersistenceSchemaEnum.Dataset);
        for (const key in settings) {
            if (key === "templates") {
                const templateSetting = settings[key];
                await this.setDirectValue(Constants.SETTINGS_DS_TEMPLATES, templateSetting);
            }
        }
    }

    public static getCliLoggerSetting(): boolean {
        return ZoweLocalStorage.getValue(Definitions.LocalStorageKey.CLI_LOGGER_SETTING_PRESENTED) ?? false;
    }

    public static setCliLoggerSetting(setting: boolean): void {
        ZoweLocalStorage.setValue(Definitions.LocalStorageKey.CLI_LOGGER_SETTING_PRESENTED, setting);
    }
}
