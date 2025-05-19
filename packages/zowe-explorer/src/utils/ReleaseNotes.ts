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

import { WebView } from "@zowe/zowe-explorer-api";
import { ExtensionContext, l10n, ViewColumn } from "vscode";
import { ZoweLogger } from "../tools/ZoweLogger";
import * as fs from "fs/promises";
import { SettingsConfig } from "../configuration/SettingsConfig";
import { Constants } from "../configuration/Constants";
import { ZoweLocalStorage } from "../tools/ZoweLocalStorage";
import { Definitions } from "../configuration/Definitions";

export class ReleaseNotes extends WebView {
    private version: string;
    public static instance: ReleaseNotes | undefined;

    public static shouldShowReleaseNotes(context: ExtensionContext): { version: string; showReleaseNotes: boolean } {
        // Get extension version (major.minor)
        const extensionVersion: string = context.extension.packageJSON.version;
        const versionRegex = /(\d+\.\d+)/;
        const majorMinorVersion = extensionVersion.match(versionRegex);
        const currentVersion: string = majorMinorVersion ? majorMinorVersion[0] : extensionVersion;

        // Get user setting for release notes display
        const showSetting = SettingsConfig.getDirectValue<string>(Constants.SETTINGS_SHOW_RELEASE_NOTES, Constants.RELEASE_NOTES_OPTS.ALWAYS_SHOW);

        // Get last shown version from local storage
        const previousVersion = ZoweLocalStorage.getValue<string>(Definitions.LocalStorageKey.SHOW_RELEASE_NOTES_VERSION) ?? "";

        // Logic:
        // - "ALWAYS_SHOW" (default): always show release notes
        // - "NEVER_SHOW": never show release notes
        // - "DISABLE_FOR_THIS_VERSION": only show if version changed
        let showReleaseNotes = true;
        if (showSetting === Constants.RELEASE_NOTES_OPTS.NEVER_SHOW) {
            showReleaseNotes = false;
        } else if (showSetting === Constants.RELEASE_NOTES_OPTS.DISABLE_FOR_THIS_VERSION) {
            showReleaseNotes = previousVersion !== currentVersion;
        } // else "ALWAYS_SHOW" or unknown, show

        // Update last shown version in local storage if version changed and showing notes
        if (showReleaseNotes && previousVersion !== currentVersion) {
            ZoweLocalStorage.setValue(Definitions.LocalStorageKey.SHOW_RELEASE_NOTES_VERSION, currentVersion);
        }

        return { version: currentVersion, showReleaseNotes };
    }

    public static show(context: ExtensionContext, force = false): void {
        const { version, showReleaseNotes } = ReleaseNotes.shouldShowReleaseNotes(context);
        if (force || showReleaseNotes) {
            if (ReleaseNotes.instance) {
                ReleaseNotes.instance.panel?.reveal();
            } else {
                ReleaseNotes.instance = new ReleaseNotes(context, version);
                ReleaseNotes.instance.panel?.onDidDispose(() => {
                    ReleaseNotes.instance = undefined;
                });
            }
        }
    }

    public constructor(context: ExtensionContext, version: string) {
        super(Constants.RELEASE_NOTES_PANEL_TITLE, "release-notes", context, {
            onDidReceiveMessage: (message: object) => this.onDidReceiveMessage(message),
            retainContext: true,
            viewColumn: ViewColumn.Active,
            iconPath: {
                light: context.asAbsolutePath("resources/zowe-icon-color.png"),
                dark: context.asAbsolutePath("resources/zowe.svg"),
            },
        });
        this.version = version;
    }

    public async onDidReceiveMessage(message: object): Promise<void> {
        if (!("command" in message)) {
            return;
        }

        const { command } = message as { command: string };
        if (command === "ready") {
            await this.sendReleaseNotes();
        } else if (Object.values(Constants.RELEASE_NOTES_OPTS).includes(command)) {
            SettingsConfig.setDirectValue(Constants.SETTINGS_SHOW_RELEASE_NOTES, command);
        }
    }

    public async sendReleaseNotes(): Promise<boolean> {
        const releaseNotes = await this.getReleaseNotes();
        const changelog = await this.getChangelog();
        const showReleaseNotesSetting = SettingsConfig.getDirectValue(Constants.SETTINGS_SHOW_RELEASE_NOTES);

        return this.panel.webview.postMessage({
            releaseNotes: releaseNotes,
            changelog: changelog,
            version: this.version,
            showReleaseNotesSetting: showReleaseNotesSetting,
            dropdownOptions: Constants.RELEASE_NOTES_OPTS,
        });
    }

    public async getReleaseNotes(): Promise<string> {
        const releaseNotesPath = this.context.asAbsolutePath(`src/webviews/dist/resources/release-notes-${this.version}.md`);
        try {
            const changelog = await fs.readFile(releaseNotesPath, { encoding: "utf8" });
            return changelog;
        } catch (error) {
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            ZoweLogger.error(`[ReleaseNotes] Error reading release notes file: ${error}`);
            return l10n.t("Error reading release notes file.");
        }
    }

    public async getChangelog(): Promise<string> {
        const changelogPath = this.context.asAbsolutePath("CHANGELOG.md");
        try {
            const changelog = await fs.readFile(changelogPath, { encoding: "utf8" });
            return this.extractCurrentVersionNotes(changelog);
        } catch (error) {
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            ZoweLogger.error(`[ReleaseNotes] Error reading changelog file: ${error}`);
            return l10n.t("Error reading changelog file.");
        }
    }

    public extractCurrentVersionNotes(changelog: string): string {
        const regex = new RegExp(`## \`(${this.version}\\.\\d+)\`[\\s\\S]*?(?=^## \`(?!${this.version}\\.\\d+))`, "gm");
        const matches = [...changelog.matchAll(regex)];
        if (matches.length === 0) {
            return l10n.t("No changelog entries found for this version.");
        }

        return matches.map((m) => m[0].trim()).join("\n\n");
    }
}
