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

import { Gui } from "../globals";
import { commands } from "vscode";
import Mustache = require("mustache");
import { ImperativeError } from "@zowe/imperative";

/**
 * Error match type (substring of error, or regular expression to match against error text)
 */
type ErrorMatch = string | RegExp;

export interface ExternalResource {
    href: string;
    title?: string;
}

export interface ErrorCorrelation {
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
    /**
     * Error-specific, external resources for users to help with resolution during troubleshooting.
     */
    resources?: ExternalResource[];
}

export interface CorrelatedErrorProps {
    errorCode?: string;
    correlation?: Omit<ErrorCorrelation, "matches">;
    initialError: Error | string;
}

export interface CorrelateErrorOpts {
    profileType?: string;
    templateArgs?: Record<string, string>;
}

export interface DisplayErrorOpts extends CorrelateErrorOpts {
    additionalContext?: string;
    allowRetry?: boolean;
}

export interface DisplayCorrelatedErrorOpts extends Omit<DisplayErrorOpts, "profileType"> {}

export interface HandledErrorInfo {
    correlation: CorrelatedError;
    userResponse: string | undefined;
}

/**
 * Representation of the given error as a correlated error (wrapper around the `Error` class).
 *
 * Used to cache the error info such as tips, the match that was encountered and the full error message.
 */
export class CorrelatedError {
    public errorCode?: string;
    public message: string;
    private wasCorrelated: boolean;

    public constructor(public properties: CorrelatedErrorProps) {
        this.errorCode = properties.initialError instanceof ImperativeError ? properties.initialError.errorCode : this.properties.errorCode;
        this.wasCorrelated = properties.correlation != null;

        if (this.wasCorrelated) {
            this.message = this.properties.correlation.summary;
        } else {
            this.message = this.properties.initialError instanceof Error ? this.properties.initialError.message : this.properties.initialError;
        }
    }

    public get correlationFound(): boolean {
        return this.wasCorrelated;
    }

    public get stack(): string | undefined {
        return this.initial instanceof Error ? this.initial.stack : undefined;
    }

    public get initial(): Error | string {
        return this.properties.initialError;
    }

    public asError(): Error {
        const err = new Error(this.message);
        err.stack = this.stack;
        return err;
    }

    public toString(): string {
        return this.message;
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

export type ErrorsForApiType = Map<ZoweExplorerApiType, ApiErrors>;
export type ApiErrors = Record<string, ErrorCorrelation[]>;

export class ErrorCorrelator {
    private static instance: ErrorCorrelator = null;

    private errorMatches: ErrorsForApiType = new Map([
        [
            ZoweExplorerApiType.Mvs,
            {
                zosmf: [
                    {
                        errorCode: "500",
                        matches: ["Client is not authorized for file access.", /An I\/O abend was trapped\.(.+?)\n(.+?)__code=0x0913/],
                        summary: "Insufficient write permissions for this data set. The data set may be read-only or locked.",
                        tips: [
                            "Check that your user or group has the appropriate permissions for this data set.",
                            "Ensure that the data set is not opened within a mainframe editor tool.",
                        ],
                    },
                    {
                        matches: ["ISPF LMINIT - data set not found."],
                        summary: "The specified data set cannot be found. Perhaps the data set name or member name was incorrectly specified.",
                        tips: ["Ensure that the data set and/or member name is correct and try again."],
                    },
                    {
                        matches: ["Qualifiers cannot be longer than 8 characters."],
                        summary: "The given data set name/pattern {{dsName}} has a qualifier longer than 8 characters.",
                        tips: [
                            "Each qualifier in a data set can have at most 8 characters. ".concat(
                                "Ensure that the given name or pattern has 8 characters or less in each qualifier."
                            ),
                        ],
                    },
                ],
            },
        ],
        [
            ZoweExplorerApiType.Uss,
            {
                zosmf: [
                    {
                        errorCode: "500",
                        matches: ["Client is not authorized for file access."],
                        summary: "Insufficient write permissions for this file. The file may be read-only or locked.",
                        tips: [
                            "Check that your user or group has the appropriate permissions for this file.",
                            "Ensure that the file is not in use and locked by another process on the mainframe.",
                            "Consider using the Edit Attributes feature with this file to update its permissions.",
                        ],
                    },
                    {
                        matches: ["File not found."],
                        summary: "The specified UNIX file cannot be found. Perhaps the folder or file path was incorrectly specified.",
                        tips: ["Ensure that the UNIX folder or file path is correct and try again."],
                    },
                ],
            },
        ],
        [
            ZoweExplorerApiType.Jes,
            {
                zosmf: [
                    {
                        matches: ["No job found for reference:"],
                        summary: "The job modification request specified a job that does not exist.",
                        tips: [],
                    },
                    {
                        matches: ["Submit input data does not start with a slash"],
                        summary: "The first character for the submitted job is invalid - expected a slash.",
                        tips: ["Ensure that the input data set or file contains EBCDIC data"],
                    },
                    {
                        matches: ["Job input was not recognized by system as a job"],
                        summary: "The job was submitted without a job statement or with unrecognized (non-JCL) content.",
                    },
                    {
                        errorCode: "400",
                        matches: ["Value of jobid query parameter is not valid"],
                        summary: "The given Job ID is invalid. Please verify that the job ID is correct and try again.",
                    },
                ],
            },
        ],
        [
            ZoweExplorerApiType.All,
            {
                any: [
                    {
                        errorCode: "401",
                        matches: ["Token is not valid or expired"],
                        summary:
                            // eslint-disable-next-line max-len
                            "Your connection is no longer active for profile {{profileName}}. Please log in to an authentication service to restore the connection.",
                    },
                    {
                        errorCode: "401",
                        matches: ["Username or password are not valid or expired", "All configured authentication methods failed"],
                        summary:
                            // eslint-disable-next-line max-len
                            "Invalid credentials for profile {{profileName}}. Please ensure the username and password are valid or this may lead to a lock-out.",
                    },
                ],
            },
        ],
    ]);

    private constructor() {}

    public static getInstance(): ErrorCorrelator {
        if (!ErrorCorrelator.instance) {
            ErrorCorrelator.instance = new ErrorCorrelator();
        }

        return ErrorCorrelator.instance;
    }

    /**
     * Adds a new error correlation to the map of error matches.
     *
     * @param api The API type that corresponds with the error
     * @param profileType A profile type that the error occurs within
     * @param correlation The correlation info (summary, tips, etc.)
     */
    public addCorrelation(api: ZoweExplorerApiType, profileType: string, correlation: ErrorCorrelation): void {
        const existingMatches = this.errorMatches.get(api);
        this.errorMatches.set(api, {
            ...(existingMatches ?? {}),
            [profileType]: [...(existingMatches?.[profileType] ?? []), correlation].filter(Boolean),
        });
    }

    /**
     * Attempt to correlate the error details to an error contributed to the `errorMatches` map.
     *
     * @param api The API type where the error was encountered
     * @param profileType The profile type in use
     * @param errorDetails The full error details (usually `error.message`)
     * @returns A matching `CorrelatedError`, or a generic `CorrelatedError` with the full error details as the summary
     */
    public correlateError(api: ZoweExplorerApiType, error: string | Error, opts?: CorrelateErrorOpts): CorrelatedError {
        const errorDetails = error instanceof Error ? error.message : error;
        if (!this.errorMatches.has(api)) {
            return new CorrelatedError({ initialError: error });
        }

        for (const apiError of [
            ...(opts?.profileType ? this.errorMatches.get(api)?.[opts.profileType] ?? [] : []),
            ...(this.errorMatches.get(api)?.any ?? []),
            ...this.errorMatches.get(ZoweExplorerApiType.All).any,
        ]) {
            for (const match of Array.isArray(apiError.matches) ? apiError.matches : [apiError.matches]) {
                if (errorDetails.toString().match(match)) {
                    return new CorrelatedError({
                        errorCode: apiError.errorCode,
                        initialError: error,
                        correlation: {
                            errorCode: apiError.errorCode,
                            summary: opts?.templateArgs ? Mustache.render(apiError.summary, opts.templateArgs) : apiError.summary,
                            tips: apiError.tips,
                        },
                    });
                }
            }
        }

        return new CorrelatedError({ initialError: error });
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
    public async displayCorrelatedError(error: CorrelatedError, opts?: DisplayCorrelatedErrorOpts): Promise<string | undefined> {
        const errorCodeStr = error.properties.errorCode ? ` (Error Code ${error.properties.errorCode})` : "";
        const userSelection = await Gui.errorMessage(
            `${opts?.additionalContext ? opts.additionalContext + ": " : ""}${error.message}${errorCodeStr}`.trim(),
            {
                items: [opts?.allowRetry ? "Retry" : undefined, error.correlationFound ? "More info" : "Troubleshoot"].filter(Boolean),
            }
        );

        // If the user selected "More info", show the full error details in a dialog,
        // containing "Show log" and "Troubleshoot" dialog options
        let nextSelection = userSelection;
        if (error.correlationFound && userSelection === "More info") {
            const fullErrorMsg = error.initial instanceof Error ? error.initial.message : error.initial;
            nextSelection = await Gui.errorMessage(fullErrorMsg, {
                items: ["Show log", "Troubleshoot"],
            });
        }

        switch (nextSelection) {
            // Reveal the output channel when the "Show log" option is selected
            case "Show log":
                return commands.executeCommand("zowe.revealOutputChannel");
            // Show the troubleshooting webview when the "Troubleshoot" option is selected
            case "Troubleshoot":
                return commands.executeCommand("zowe.troubleshootError", error, error.stack);
            default:
                return nextSelection;
        }
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
    public async displayError(api: ZoweExplorerApiType, errorDetails: string | Error, opts?: DisplayErrorOpts): Promise<HandledErrorInfo> {
        const error = this.correlateError(api, errorDetails, { profileType: opts?.profileType, templateArgs: opts?.templateArgs });
        return {
            correlation: error,
            userResponse: await this.displayCorrelatedError(error, { additionalContext: opts?.additionalContext, allowRetry: opts?.allowRetry }),
        };
    }
}
