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
import { ConfigUtils } from "./ConfigUtils";

interface ProfileLocation {
    /** Dotted profile key, e.g. "lpar1.zosmf". */
    profileKey: string;
    /** 0-based line of the profile's key token. */
    line: number;
}

/**
 * Offers a way back into the visual Config Editor while a `zowe.config*.json` file is open as
 * text: one lens for the file and one above each profile.
 */
export class ConfigEditorCodeLensProvider implements vscode.CodeLensProvider {
    public provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        const configPath = document.uri.fsPath;

        const lenses: vscode.CodeLens[] = [
            new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
                title: vscode.l10n.t("$(gear) Edit in Zowe Configuration Editor"),
                command: "zowe.configEditor",
                arguments: [document.uri],
            }),
        ];

        const profileTypes = ConfigEditorCodeLensProvider.readProfileTypes(document.getText());

        for (const { profileKey, line } of ConfigEditorCodeLensProvider.findProfileLocations(document.getText())) {
            lenses.push(
                new vscode.CodeLens(new vscode.Range(line, 0, line, 0), {
                    title: vscode.l10n.t("Edit '{0}'", profileKey),
                    command: "zowe.configEditorWithProfile",
                    // The lens already knows its profile, so pass it rather than relying on the
                    // cursor-position inference `zowe.configEditor` falls back to.
                    arguments: [profileKey, configPath, profileTypes[profileKey]],
                })
            );
        }

        return lenses;
    }

    /** Maps dotted profile key to its declared `type`, best-effort. */
    private static readProfileTypes(text: string): { [profileKey: string]: string | undefined } {
        const types: { [profileKey: string]: string | undefined } = {};
        let parsed: Record<string, any>;
        try {
            parsed = JSON.parse(ConfigUtils.stripJsoncToJson(text));
        } catch {
            return types;
        }

        const walk = (profiles: Record<string, any> | undefined, parentKey: string): void => {
            if (!profiles || typeof profiles !== "object") {
                return;
            }
            for (const [name, profile] of Object.entries(profiles)) {
                const qualifiedKey = parentKey ? `${parentKey}.${name}` : name;
                types[qualifiedKey] = typeof profile?.type === "string" ? profile.type : undefined;
                walk(profile?.profiles, qualifiedKey);
            }
        };
        walk(parsed?.profiles, "");
        return types;
    }

    /**
     * Locates each profile's key token by scanning the raw text, so line numbers stay accurate.
     * Comment-stripping shifts offsets, so the parsed JSON cannot be used for positions.
     */
    private static findProfileLocations(text: string): ProfileLocation[] {
        const locations: ProfileLocation[] = [];
        /** Enclosing objects; `isProfile` marks frames that are a profile rather than a container. */
        const stack: { key: string | null; isProfile: boolean }[] = [{ key: null, isProfile: false }];

        let line = 0;
        let pendingKey: string | null = null;
        let pendingKeyLine = 0;
        let index = 0;

        while (index < text.length) {
            const char = text[index];

            if (char === "\n") {
                line++;
                index++;
                continue;
            }

            if (char === "/" && text[index + 1] === "/") {
                while (index < text.length && text[index] !== "\n") index++;
                continue;
            }

            if (char === "/" && text[index + 1] === "*") {
                index += 2;
                while (index + 1 < text.length && !(text[index] === "*" && text[index + 1] === "/")) {
                    if (text[index] === "\n") line++;
                    index++;
                }
                index += 2;
                continue;
            }

            if (char === '"') {
                const startLine = line;
                let value = "";
                index++;
                while (index < text.length) {
                    const stringChar = text[index];
                    if (stringChar === "\\") {
                        value += text[index + 1] ?? "";
                        index += 2;
                        continue;
                    }
                    if (stringChar === '"') {
                        index++;
                        break;
                    }
                    if (stringChar === "\n") line++;
                    value += stringChar;
                    index++;
                }
                pendingKey = value;
                pendingKeyLine = startLine;
                continue;
            }

            if (char === "{") {
                const parent = stack[stack.length - 1];
                const isProfile = parent.key === "profiles";
                stack.push({ key: pendingKey, isProfile });

                if (isProfile && pendingKey) {
                    const profileKey = stack
                        .filter((frame) => frame.isProfile && frame.key)
                        .map((frame) => frame.key)
                        .join(".");
                    locations.push({ profileKey, line: pendingKeyLine });
                }

                pendingKey = null;
                index++;
                continue;
            }

            if (char === "}") {
                if (stack.length > 1) {
                    stack.pop();
                }
                pendingKey = null;
                index++;
                continue;
            }

            if (char === "," ) {
                pendingKey = null;
            }

            index++;
        }

        return locations;
    }
}
