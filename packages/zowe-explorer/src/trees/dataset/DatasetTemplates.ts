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
import { Types } from "@zowe/zowe-explorer-api";
import { ZoweLogger } from "../../tools/ZoweLogger";
import { SettingsConfig } from "../../configuration/SettingsConfig";
import { Constants } from "../../configuration/Constants";

export class DataSetTemplates {
    public static getDsTemplates(): Types.DataSetAllocTemplate[] {
        ZoweLogger.trace(vscode.l10n.t("Getting data set templates."));
        return SettingsConfig.getDirectValue(Constants.SETTINGS_DS_TEMPLATES);
    }

    public static async resetDsTemplateSetting(): Promise<void> {
        ZoweLogger.trace(vscode.l10n.t("Resetting data set templates array."));
        await this.updateDsTemplateSetting();
    }

    public static async updateDsTemplateSetting(templates: Types.DataSetAllocTemplate[] = []): Promise<void> {
        ZoweLogger.trace(vscode.l10n.t("Updating data set templates."));
        await SettingsConfig.setDirectValue(Constants.SETTINGS_DS_TEMPLATES, templates);
    }

    public static async addDsTemplateSetting(criteria: Types.DataSetAllocTemplate): Promise<void> {
        if (criteria) {
            let newTemplateName: string;
            Object.entries(criteria).forEach(([key]) => {
                newTemplateName = key;
            });
            ZoweLogger.info(vscode.l10n.t("Adding new data set template {0}.", newTemplateName));
            let templateSettings = this.getDsTemplates();
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
            await this.updateDsTemplateSetting(templateSettings);
        }
    }
}
