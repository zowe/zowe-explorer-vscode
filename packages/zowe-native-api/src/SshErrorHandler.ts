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
import { ErrorCorrelator, type ZoweExplorerApiType } from "@zowe/zowe-explorer-api";
import { RpcErrorCode, SshErrors } from "zowex-sdk";

/**
 * Enhanced error handling utility for SSH operations using Zowe Explorer's ErrorCorrelator
 */
export class SshErrorHandler {
    private static instance: SshErrorHandler;
    private constructor() {}
    public static getInstance(): SshErrorHandler {
        if (!SshErrorHandler.instance) {
            SshErrorHandler.instance = new SshErrorHandler();
        }
        return SshErrorHandler.instance;
    }

    /**
     * Handles and displays an SSH error using error correlation if available
     * @param error The error that occurred
     * @param apiType The API type where the error occurred
     * @param context Additional context about the operation
     * @param allowRetry Whether to allow retrying the operation
     * @returns The user's response ("Retry", "Troubleshoot", etc.)
     */
    public async handleError(
        error: Error | string,
        apiType: ZoweExplorerApiType,
        context?: string,
        allowRetry: boolean = false
    ): Promise<string | undefined> {
        const result = await ErrorCorrelator.getInstance().displayError(apiType, error, {
            profileType: "ssh",
            additionalContext: context,
            allowRetry,
        });
        return result.userResponse;
    }

    /**
     * Checks if an error is a timeout error
     * @param error The error to check
     * @returns True if the error is a timeout error
     */
    public isTimeoutError(error: Error | string): boolean {
        if (error instanceof ImperativeError) {
            const errorCode = error.errorCode;
            if (errorCode === "ETIMEDOUT" || Number(errorCode) === RpcErrorCode.REQUEST_TIMEOUT) {
                return true;
            }
        }

        // Fall back to message pattern matching if error code checks aren't satisfied
        const errorMessage = error instanceof Error ? error.message : error;
        const timeoutMatches = SshErrors.REQUEST_TIMEOUT.matches;

        return timeoutMatches.some((match) => {
            if (typeof match === "string") {
                return errorMessage.includes(match);
            }
            return match.test(errorMessage);
        });
    }

    /**
     * Checks if an error is a fatal SSH error that should terminate the connection
     * @param error The error to check
     * @returns True if the error is fatal
     */
    public isFatalError(error: Error | string): boolean {
        const errorMessage = error instanceof Error ? error.message : error;

        // Timeout errors are not fatal - they should allow retry
        if (this.isTimeoutError(error)) {
            return false;
        }

        // Check for fatal OpenSSH error codes
        const fatalErrorCodes = Object.keys(SshErrors);

        return fatalErrorCodes.some((code) => errorMessage.includes(code));
    }

    /**
     * Extracts the OpenSSH error code from an error message
     * @param error The error message
     * @returns The error code if found, undefined otherwise
     */
    public extractErrorCode(error: Error | string): string | undefined {
        const errorMessage = error instanceof Error ? error.message : error;
        const match = errorMessage.match(/FOTS\d{4}|FSUM\d{4}/);
        return match?.[0];
    }

    /**
     * Creates an error callback for use with SDK functions like installServer
     * @param apiType The API type for error correlation
     * @param context Additional context for the operation
     * @returns An error callback function that handles errors with correlation
     */
    public createErrorCallback(apiType: ZoweExplorerApiType, context?: string): (error: Error, operationContext: string) => Promise<boolean> {
        return async (error: Error, operationContext: string): Promise<boolean> => {
            const fullContext = context ? `${context} (${operationContext})` : operationContext;
            const userResponse = await SshErrorHandler.getInstance().handleError(error, apiType, fullContext, true);

            // Return true if user chose to retry, false otherwise
            return userResponse === "Retry";
        };
    }
}
