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
import { Gui, imperative, errorMessage } from "@zowe/zowe-explorer-api";
import { Profiles } from "../configuration/Profiles";
import { ZoweLogger } from "../tools/ZoweLogger";
import { LocalFileManagement } from "./LocalFileManagement";

type RedactOptionKey = keyof imperative.IConfigExportRedactedOpts;

interface RedactOptionItem extends vscode.QuickPickItem {
    key: RedactOptionKey;
}

export class ConfigRedactManagement {
    private static readonly redactOptionItems: RedactOptionItem[] = [
        {
            key: "redactStrings",
            label: vscode.l10n.t("Redact string values"),
            description: vscode.l10n.t("Replace string properties (e.g. user, host) with placeholder values"),
            picked: true,
        },
        {
            key: "redactNumbers",
            label: vscode.l10n.t("Redact number values"),
            description: vscode.l10n.t("Replace numeric properties (e.g. port) with placeholder values"),
            picked: true,
        },
        {
            key: "redactBooleans",
            label: vscode.l10n.t("Redact boolean values"),
            description: vscode.l10n.t("Replace boolean properties with placeholder values"),
            picked: false,
        },
        {
            key: "redactProfileNames",
            label: vscode.l10n.t("Redact profile names"),
            description: vscode.l10n.t("Replace profile names and their references in the defaults section"),
            picked: true,
        },
        {
            key: "hideSecureFields",
            label: vscode.l10n.t("Hide secure field names"),
            description: vscode.l10n.t("Remove the list of secure property names from the output"),
            picked: false,
        },
        {
            key: "showHostPath",
            label: vscode.l10n.t("Show host and basePath values"),
            description: vscode.l10n.t("Keep host and basePath values instead of redacting them"),
            picked: false,
        },
    ];

    public static async exportRedactedConfig(): Promise<void> {
        ZoweLogger.trace("ConfigRedactManagement.exportRedactedConfig called.");
        const opts = await ConfigRedactManagement.promptForOptions();
        if (opts == null) {
            return;
        }

        const dir = await ConfigRedactManagement.promptForExportFolder();
        if (dir == null) {
            return;
        }

        try {
            const teamConfig = (await Profiles.getInstance().getProfileInfo()).getTeamConfig();
            const exportedFiles = teamConfig.api.redact.exportToDirectory(dir.fsPath, opts);
            if (exportedFiles.length === 0) {
                Gui.infoMessage(vscode.l10n.t("No configuration files were found to export."));
                return;
            }
            const openFolder = await Gui.infoMessage(
                vscode.l10n.t({
                    message:
                        "Exported {0} redacted configuration file(s) to {1}.\nAlways review the exported files before sharing them or " +
                        "placing them anywhere external or sensitive.",
                    args: [exportedFiles.length, dir.fsPath],
                    comment: ["Number of files exported", "Export directory"],
                }),
                { items: [vscode.l10n.t("Open Folder")] }
            );
            if (openFolder === vscode.l10n.t("Open Folder")) {
                await vscode.env.openExternal(dir);
            }
        } catch (err) {
            await Gui.errorMessage(
                vscode.l10n.t({
                    message: "Failed to export redacted configuration: {0}",
                    args: [errorMessage(err)],
                    comment: ["Error message"],
                })
            );
        }
    }

    private static async promptForOptions(): Promise<imperative.IConfigExportRedactedOpts | undefined> {
        const picked = await Gui.showQuickPick(ConfigRedactManagement.redactOptionItems, {
            title: vscode.l10n.t("Export Redacted Configuration"),
            placeHolder: vscode.l10n.t("Select which values to redact, then confirm"),
            canPickMany: true,
            ignoreFocusOut: true,
        });
        if (picked === undefined) {
            return undefined;
        }
        const hasRedactOption = picked.some((item) => item.key !== "showHostPath");
        if (!hasRedactOption) {
            const proceed = await Gui.warningMessage(
                vscode.l10n.t(
                    "No redact options were selected. The exported configuration will not have any values redacted and may expose sensitive information."
                ),
                {
                    items: [vscode.l10n.t("Continue")],
                    vsCodeOpts: { modal: true },
                }
            );
            if (proceed !== vscode.l10n.t("Continue")) {
                return undefined;
            }
        }
        const pickedKeys = new Set(picked.map((item) => item.key));
        const opts: imperative.IConfigExportRedactedOpts = {};
        for (const item of ConfigRedactManagement.redactOptionItems) {
            opts[item.key] = pickedKeys.has(item.key);
        }
        return opts;
    }

    private static async promptForExportFolder(): Promise<vscode.Uri | undefined> {
        const browseItem: vscode.QuickPickItem = {
            label: `$(folder) ${vscode.l10n.t("Browse for Export Folder...")}`,
            description: vscode.l10n.t("Choose the folder where the redacted configuration files will be saved"),
        };
        const picked = await Gui.showQuickPick([browseItem], {
            title: vscode.l10n.t("Select Export Folder"),
            placeHolder: vscode.l10n.t("Choose where to save the redacted configuration files"),
            ignoreFocusOut: true,
        });
        if (picked === undefined) {
            return undefined;
        }
        const dirUri = await Gui.showOpenDialog({
            title: vscode.l10n.t("Select a folder to export the redacted configuration files to"),
            openLabel: vscode.l10n.t("Select"),
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            defaultUri: LocalFileManagement.getDefaultUri(),
        });
        return dirUri?.[0];
    }
}
