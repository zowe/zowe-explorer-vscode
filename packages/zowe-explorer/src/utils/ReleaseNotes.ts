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
import { ExtensionContext, l10n, ViewColumn, Uri } from "vscode";
import { ZoweLogger } from "../tools/ZoweLogger";
import * as fs from "fs/promises";
import { SettingsConfig } from "../configuration/SettingsConfig";
import { Constants } from "../configuration/Constants";
import { ZoweLocalStorage } from "../tools/ZoweLocalStorage";
import { Definitions } from "../configuration/Definitions";

export class ReleaseNotes extends WebView {
    private version: string;
    private readonly extensionVersion: string;
    public static instance: ReleaseNotes | undefined;

    public static getExtensionVersion(context: ExtensionContext): string {
        // Get extension version (major.minor)
        const extensionVersion: string = context.extension.packageJSON.version;
        const versionRegex = /(\d+\.\d+)/;
        const majorMinorVersion = extensionVersion.match(versionRegex);
        return majorMinorVersion ? majorMinorVersion[0] : extensionVersion;
    }

    public static shouldDisplayReleaseNotes(context: ExtensionContext): { version: string; displayReleaseNotes: boolean } {
        // Get extension version (major.minor)
        const currentVersion = ReleaseNotes.getExtensionVersion(context);

        // Default: true (show after update)
        const showAfterUpdate = SettingsConfig.getDirectValue<boolean>(Constants.SETTINGS_DISPLAY_RELEASE_NOTES, true);
        const previousVersion = ZoweLocalStorage.getValue<string>(Definitions.LocalStorageKey.DISPLAY_RELEASE_NOTES_VERSION) ?? "";

        // Only show if enabled and version changed
        const displayReleaseNotes = showAfterUpdate && previousVersion !== currentVersion;

        // Update last displayed version in local storage if displaying notes
        if (displayReleaseNotes) {
            ZoweLocalStorage.setValue(Definitions.LocalStorageKey.DISPLAY_RELEASE_NOTES_VERSION, currentVersion);
        }

        return { version: currentVersion, displayReleaseNotes };
    }

    public static display(context: ExtensionContext, force = false): void {
        const { version, displayReleaseNotes } = ReleaseNotes.shouldDisplayReleaseNotes(context);
        if (force || displayReleaseNotes) {
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
                light: Uri.file(context.asAbsolutePath("resources/zowe-icon-color.png")),
                dark: Uri.file(context.asAbsolutePath("resources/zowe.svg")),
            },
        });
        this.version = version;
        this.extensionVersion = ReleaseNotes.getExtensionVersion(context);
    }

    public async onDidReceiveMessage(message: object): Promise<void> {
        if (!("command" in message)) {
            return;
        }

        const { command, checked, version } = message as { command: string; checked?: boolean; version?: string };
        if (command === "ready") {
            await this.sendReleaseNotes();
        } else if (command === "selectVersion" && version) {
            this.version = version;
            await this.sendReleaseNotes();
        } else if (command === "toggleDisplayAfterUpdate" && typeof checked === "boolean") {
            SettingsConfig.setDirectValue(Constants.SETTINGS_DISPLAY_RELEASE_NOTES, checked);
        }
    }

    public async sendReleaseNotes(): Promise<boolean> {
        const releaseNotes = await this.getReleaseNotes();
        const changelog = await this.getChangelog();
        const displayAfterUpdate = SettingsConfig.getDirectValue(Constants.SETTINGS_DISPLAY_RELEASE_NOTES, true);
        const versionOptions = await this.getAllMajorMinorVersions();

        return this.panel.webview.postMessage({
            releaseNotes,
            changelog,
            version: this.version,
            displayAfterUpdate,
            versionOptions,
        });
    }

    public async getReleaseNotes(): Promise<string> {
        const releaseNotesPath = this.context.asAbsolutePath(`src/webviews/dist/resources/release-notes.md`);
        try {
            const releaseNotes = await fs.readFile(releaseNotesPath, { encoding: "utf8" });
            return this.extractCurrentVersionNotes(releaseNotes, "release notes");
        } catch (error) {
            ZoweLogger.error(`[ReleaseNotes] Error reading release notes file: ${String(error)}`);
            return l10n.t("No release notes found for this version.");
        }
    }

    public async getChangelog(): Promise<string> {
        const changelogPath = this.context.asAbsolutePath("CHANGELOG.md");
        try {
            const changelog = await fs.readFile(changelogPath, { encoding: "utf8" });
            return this.extractCurrentVersionNotes(changelog, "changelog");
        } catch (error) {
            ZoweLogger.error(`[ReleaseNotes] Error reading changelog file: ${String(error)}`);
            return l10n.t("No changelog entries found for this version.");
        }
    }

    public extractCurrentVersionNotes(changelog: string, type: string): string {
        const regex = new RegExp(`## \`(${this.version}\\.\\d+)\`[\\s\\S]*?(?=^## \`(?!${this.version}\\.\\d+))`, "gm");
        const matches = [...changelog.matchAll(regex)];
        if (matches.length === 0) {
            return l10n.t("No {0} entries found for this version.", type);
        }

        return matches.map((m) => m[0].trim()).join("\n\n");
    }

    public async getAllMajorMinorVersions(): Promise<string[]> {
        const changelogPath = this.context.asAbsolutePath("CHANGELOG.md");
        try {
            const changelog = await fs.readFile(changelogPath, { encoding: "utf8" });
            // Filter lines that start with '##' to improve efficiency
            const lines = changelog.split("\n").filter((line) => line.startsWith("##"));
            const regex = /^## `(\d+\.\d+)\.\d+`/;
            const versions = new Set<string>();
            for (const line of lines) {
                const match = regex.exec(line);
                if (match) {
                    versions.add(match[1]);
                }
            }

            versions.add(this.version);
            versions.add(this.extensionVersion);

            // Sort descending
            return Array.from(versions).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
        } catch (error) {
            ZoweLogger.error(`[ReleaseNotes] Error parsing changelog for versions: ${String(error)}`);
            return [];
        }
    }
}
