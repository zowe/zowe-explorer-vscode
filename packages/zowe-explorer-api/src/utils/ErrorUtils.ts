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

/**
 * Returns the error message if `err` is an Error, otherwise converts it to a string.
 * Replaces inline `err instanceof Error ? err.message : String(err)` ternaries.
 */
export function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

/**
 * Calls the provided callback only if `err` is an instance of Error.
 * Replaces repetitive `if (err instanceof Error) { ... }` patterns.
 */
export function handleError(err: unknown, callback: (error: Error) => void | Promise<void>): void | Promise<void> {
    if (err instanceof Error) {
        return callback(err);
    }
}
