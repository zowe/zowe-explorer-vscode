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
import { ExtensionContext, l10n } from "vscode";
import { ZoweLogger } from "../tools/ZoweLogger";
import * as fs from "fs/promises";

export class ReleaseNotes extends WebView {
    private version: string;

    public constructor(context: ExtensionContext, version: string) {
        super(l10n.t("Release Notes"), "release-notes", context, {
            onDidReceiveMessage: (message: object) => this.onDidReceiveMessage(message),
        });
        this.version = version;
    }

    public async onDidReceiveMessage(message: object): Promise<void> {
        if (!("command" in message)) {
            return;
        }

        switch (message.command) {
            case "ready":
                await this.sendReleaseNotes();
                break;
            case "disable":
                // TODO: Implement the logic to disable the release notes popup until the next update
                await this.panel.dispose();
                break;
            default:
                ZoweLogger.debug(`[ReleaseNotes] Unknown command: ${message.command as string}`);
                break;
        }
    }

    public async sendReleaseNotes(): Promise<boolean> {
        const changelog = await this.getChangelog();

        return this.panel.webview.postMessage({
            releaseNotes: changelog,
        });
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
            return `No changelog entries found for version ${this.version}.`;
        }

        return matches.map((m) => m[0].trim()).join("\n\n");
    }
}
