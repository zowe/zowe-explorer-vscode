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

import { ImperativeError } from "@zowe/imperative";
import { Singleton } from "./Singleton";
import { Gui } from "../globals";
import { commands } from "vscode";

/**
 * Error match type (substring of error, or regular expression to match against error text)
 */
type ErrorMatch = string | RegExp;

interface ErrorCorrelation {
    /**
     * An optional error code returned from the server.
     * @type {string}
     */
    errorCode?: string;
    /**
     * One or more patterns to check for within the error message.
     * @type {ErrorMatch | ErrorMatch[]}
     */
    matches: ErrorMatch | ErrorMatch[];
    /**
     * Human-readable, brief summary of the error that was encountered.
     * @type {string}
     */
    summary: string;
    /**
     * Troubleshooting tips for end users that encounter the given error.
     * @type {string[]}
     */
    tips?: string[];
}

interface NetworkErrorInfo extends Omit<ErrorCorrelation, "matches"> {
    /**
     * The full error details sent by the server.
     * @type {string}
     */
    fullError?: string;
}

/**
 * Network error wrapper around the `ImperativeError` class.
 *
 * Used to cache the error info such as tips, the match that was encountered and the full error message.
 */
export class NetworkError extends ImperativeError {
    public constructor(public info: NetworkErrorInfo) {
        super({ msg: info.summary });
    }
}

export enum ZoweExplorerApiType {
    Mvs = "mvs",
    Jes = "jes",
    Uss = "uss",
    Command = "cmd",
    /* errors that match all API types */
    All = "all",
}

export type ApiErrors = Partial<Record<ZoweExplorerApiType, ErrorCorrelation[]>>;

export class ErrorCorrelator extends Singleton {
    private errorMatches: Map<string, ApiErrors> = new Map([
        [
            "zosmf",
            {
                [ZoweExplorerApiType.Mvs]: [
                    {
                        errorCode: "500",
                        matches: [/Client is not authorized for file access\.$/],
                        summary: "Insufficient write permissions for this data set. The data set may be read-only or locked.",
                        tips: [
                            "Check that your user or group has the appropriate permissions for this data set.",
                            "Ensure that the data set is not opened within a mainframe editor tool.",
                        ],
                    },
                ],
                [ZoweExplorerApiType.Uss]: [
                    {
                        errorCode: "500",
                        matches: [/Client is not authorized for file access\.$/],
                        summary: "Insufficient write permissions for this file. The file may be read-only or locked.",
                        tips: [
                            "Check that your user or group has the appropriate permissions for this file.",
                            "Ensure that the file is not in use and locked by another process on the mainframe.",
                            "Consider using the Edit Attributes feature with this file to update its permissions.",
                        ],
                    },
                ],
            },
        ],
    ]);

    public constructor() {
        super();
    }

    /**
     * Adds a new error correlation to the map of error matches.
     *
     * @param api The API type that corresponds with the error
     * @param profileType A profile type that the error occurs within
     * @param correlation The correlation info (summary, tips, etc.)
     */
    public addCorrelation(api: ZoweExplorerApiType, profileType: string, correlation: ErrorCorrelation): void {
        const existingMatches = this.errorMatches.get(profileType);
        this.errorMatches.set(profileType, {
            ...(existingMatches ?? {}),
            [api]: [...(existingMatches?.[api] ?? []), correlation].filter(Boolean),
        });
    }

    /**
     * Attempt to correlate the error details to an error contributed to the `errorMatches` map.
     *
     * @param api The API type where the error was encountered
     * @param profileType The profile type in use
     * @param errorDetails The full error details (usually `error.message`)
     * @returns A matching `NetworkError`, or a generic `NetworkError` with the full error details as the summary
     */
    public correlateError(api: ZoweExplorerApiType, profileType: string, errorDetails: string): NetworkError {
        if (!this.errorMatches.has(profileType)) {
            return new NetworkError({ summary: errorDetails });
        }

        for (const apiError of [...this.errorMatches.get(profileType)[api], ...(this.errorMatches.get(profileType)[ZoweExplorerApiType.All] ?? [])]) {
            for (const match of Array.isArray(apiError.matches) ? apiError.matches : [apiError.matches]) {
                if (errorDetails.match(match)) {
                    return new NetworkError({
                        errorCode: apiError.errorCode,
                        fullError: errorDetails,
                        summary: apiError.summary,
                        tips: apiError?.tips,
                    });
                }
            }
        }

        return new NetworkError({ summary: errorDetails });
    }

    /**
     * Translates a detailed error message to a user-friendly summary.
     * Full error details are available through the "More info" dialog option.
     *
     * @param api The API type where the error was encountered
     * @param profileType The profile type in use
     * @param errorDetails The full error details (usually `error.message`)
     * @param allowRetry Whether to allow retrying the action
     * @returns The user selection ("Retry" [if enabled] or "Troubleshoot")
     */
    public async displayError(
        api: ZoweExplorerApiType,
        profileType: string,
        errorDetails: string,
        opts?: { allowRetry?: boolean; stackTrace?: string }
    ): Promise<string | undefined> {
        const error = this.correlateError(api, profileType, errorDetails);
        const userSelection = await Gui.errorMessage(`${error.mDetails.msg.trim()} (Error Code ${error.info?.errorCode})`, {
            items: [opts?.allowRetry ? "Retry" : undefined, "More info"].filter(Boolean),
        });

        // If the user selected "More info", show the full error details in a dialog,
        // containing "Show log" and "Troubleshoot" dialog options
        if (userSelection === "More info" && error.info?.fullError) {
            const secondDialogSelection = await Gui.errorMessage(error.info.fullError, {
                items: ["Show log", "Troubleshoot"],
            });

            switch (secondDialogSelection) {
                // Reveal the output channel when the "Show log" option is selected
                case "Show log":
                    return commands.executeCommand("zowe.revealOutputChannel");
                // Show the troubleshooting webview when the "Troubleshoot" option is selected
                case "Troubleshoot":
                    return commands.executeCommand("zowe.troubleshootError", error, opts?.stackTrace);
                default:
                    return;
            }
        }

        return userSelection;
    }
}
