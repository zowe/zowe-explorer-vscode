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
import { Gui, Types, ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import { ZoweLogger } from "../../tools/ZoweLogger";
import { SettingsConfig } from "../../configuration/SettingsConfig";
import { Constants } from "../../configuration/Constants";
import { FilterItem } from "../../management/FilterManagement";

export class DataSetTemplates {
    public static getDsTemplates(): Types.DataSetAllocTemplate[] {
        ZoweLogger.trace(vscode.l10n.t("Getting data set templates."));
        return SettingsConfig.getDirectValue(Constants.SETTINGS_DS_TEMPLATES);
    }

    public static async resetDsTemplateSetting(): Promise<void> {
        ZoweLogger.trace(vscode.l10n.t("Resetting data set templates array."));
        await this.updateDsTemplateSetting();
    }

    public static async updateDsTemplateSetting(
        templates: Types.DataSetAllocTemplate[] = [],
        target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global
    ): Promise<void> {
        ZoweLogger.trace(vscode.l10n.t("Updating data set templates."));
        await SettingsConfig.setDirectValue(Constants.SETTINGS_DS_TEMPLATES, templates, target);
    }

    public static async addDsTemplateSetting(criteria: Types.DataSetAllocTemplate): Promise<void> {
        if (criteria) {
            let newTemplateName: string;
            Object.entries(criteria).forEach(([key]) => {
                newTemplateName = key;
            });
            let userPick;

            const workspacePath = ZoweVsCodeExtension.workspaceRoot?.uri.fsPath;
            if (workspacePath) {
                userPick = await this.promptForSaveLocation();
            }
            let target = vscode.ConfigurationTarget.Global;
            if (userPick?.label.includes("Workspace")) {
                target = vscode.ConfigurationTarget.Workspace;
            }
            let templateSettings = this.getTemplatesPerLocation(target);
            // Remove any entries that match
            templateSettings = templateSettings.filter((template) => {
                let historyName: string;
                Object.entries(template).forEach(([key]) => {
                    historyName = key;
                });
                return historyName !== newTemplateName;
            });
            // Add value to front of stack
            templateSettings.unshift(criteria);
            ZoweLogger.info(vscode.l10n.t("Adding new data set template {0}.", newTemplateName));
            await this.updateDsTemplateSetting(templateSettings, target);
        }
    }

    private static promptForSaveLocation(): Thenable<vscode.QuickPickItem | undefined> {
        const qpOptions: vscode.QuickPickOptions = {
            title: vscode.l10n.t("Data Set Template Save Location"),
            placeHolder: vscode.l10n.t("Choose the setting location to save the data set template..."),
            ignoreFocusOut: true,
            canPickMany: false,
        };
        const qpItems: vscode.QuickPickItem[] = [];
        qpItems.push(new FilterItem({ text: vscode.l10n.t("Save as User setting"), show: true }));
        qpItems.push(new FilterItem({ text: vscode.l10n.t("Save as Workspace setting"), show: true }));
        return Gui.showQuickPick(qpItems, qpOptions);
    }

    private static getTemplatesPerLocation(target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Types.DataSetAllocTemplate[] {
        const key = Constants.SETTINGS_DS_TEMPLATES;
        const [first, ...rest] = key.split(".");
        const config = vscode.workspace.getConfiguration(first).inspect(rest.join("."));
        if (target === vscode.ConfigurationTarget.Global) {
            return (config.globalValue ?? []) as Types.DataSetAllocTemplate[];
        } else {
            return (config.workspaceValue ?? []) as Types.DataSetAllocTemplate[];
        }
    }
}
