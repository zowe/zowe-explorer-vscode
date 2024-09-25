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

interface NetworkErrorInfo {
    errorCode?: string;
    fullError?: string;
    tips?: string[];
}

export class NetworkError extends ImperativeError {
    public constructor(msg: string, public info?: NetworkErrorInfo) {
        super({ msg });
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

export class ErrorCorrelations {}

export class ErrorCorrelator extends Singleton {
    private errorMatches: Map<string, ApiErrors> = new Map([
        [
            "zosmf",
            {
                [ZoweExplorerApiType.Mvs]: [
                    {
                        errorCode: "403",
                        matches: [/Client is not authorized for file access\.$/],
                        summary: "Insufficient write permissions for this data set. The data set may be read-only or locked.",
                        tips: [],
                    },
                ],
                [ZoweExplorerApiType.Uss]: [
                    {
                        errorCode: "403",
                        matches: [/Client is not authorized for file access\.$/],
                        summary: "Insufficient write permissions for this file. The file may be read-only or locked.",
                        tips: [],
                    },
                ],
            },
        ],
    ]);

    public constructor() {
        super();
    }

    public correlateError(api: ZoweExplorerApiType, profileType: string, errorDetails: string): NetworkError {
        if (!this.errorMatches.has(profileType)) {
            return new NetworkError(errorDetails);
        }

        for (const apiError of [...this.errorMatches.get(profileType)[api], ...(this.errorMatches.get(profileType)[ZoweExplorerApiType.All] ?? [])]) {
            for (const match of Array.isArray(apiError.matches) ? apiError.matches : [apiError.matches]) {
                if (errorDetails.match(match)) {
                    return new NetworkError(apiError.summary, { errorCode: apiError.errorCode, fullError: errorDetails, tips: apiError?.tips });
                }
            }
        }

        return new NetworkError(errorDetails);
    }

    public async translateAndDisplayError(api: ZoweExplorerApiType, profileType: string, errorDetails: string): Promise<string> {
        const error = this.correlateError(api, profileType, errorDetails);
        const userSelection = await Gui.errorMessage(`${error.mDetails.msg.trim()} (Error Code ${error.info?.errorCode})`, {
            items: ["Retry", "More info"],
        });

        if (userSelection === "More info" && error.info?.fullError) {
            Gui.errorMessage(error.info.fullError);
        }

        return userSelection;
    }
}
