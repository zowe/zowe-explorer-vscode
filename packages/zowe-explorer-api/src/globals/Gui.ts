/*
 * This program and the accompanying materials are made available under the terms of the *
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at *
 * https://www.eclipse.org/legal/epl-v20.html                                      *
 *                                                                                 *
 * SPDX-License-Identifier: EPL-2.0                                                *
 *                                                                                 *
 * Copyright Contributors to the Zowe Project.                                     *
 *                                                                                 *
 */

import * as vscode from "vscode";
import { IZoweLogger, MessageSeverity } from "../logger";

export interface GuiMessageOptions {
    severity?: MessageSeverity;
    items?: string[];
    logger?: IZoweLogger;
    vsCodeOpts?: vscode.MessageOptions;
}

export class Gui {
    /**
     * Shows an input box within VS Code using the specified options.
     * @param options All options for the input box
     * @returns The user's response, or `undefined` if the input box was dismissed.
     */
    public static async inputBox(options: vscode.InputBoxOptions): Promise<string> {
        if (!options.validateInput) {
            options.validateInput = (_value): string | Thenable<string> => null;
        }

        return await vscode.window.showInputBox(options);
    }

    /**
     * Creates a QuickPick within VS Code with more flexible options than `quickPick`
     * @returns A new QuickPick object
     */
    public static createQuickPick<T extends vscode.QuickPickItem>(): vscode.QuickPick<T> {
        return vscode.window.createQuickPick();
    }

    /**
     * Builds the specified QuickPick result based on user interaction.
     * @param quickpick The QuickPick object to resolve
     * @returns A promise containing the result of the QuickPick
     */
    public static resolveQuickPick(
        quickpick: vscode.QuickPick<vscode.QuickPickItem>
    ): Promise<vscode.QuickPickItem | undefined> {
        return new Promise<vscode.QuickPickItem | undefined>((c) => {
            quickpick.onDidAccept(() => c(quickpick.activeItems[0]));
            quickpick.onDidHide(() => c(undefined));
        });
    }

    /**
     *
     * @param items An array of items, or a promise that resolves to an array of items
     * @param options VS Code options for the quick pick's behavior
     * @param token A token used to signal cancellation for the quick pick
     */
    public static quickPick<T extends string>(
        items: readonly T[] | Thenable<readonly T[]>,
        options?: vscode.QuickPickOptions,
        token?: vscode.CancellationToken
    ): Thenable<T | undefined>;
    public static quickPick<T extends string>(
        items: readonly T[] | Thenable<readonly T[]>,
        options?: vscode.QuickPickOptions & { canPickMany: true },
        token?: vscode.CancellationToken
    ): Thenable<T[] | undefined>;
    public static quickPick<T extends vscode.QuickPickItem>(
        items: readonly T[] | Thenable<readonly T[]>,
        options?: vscode.QuickPickOptions,
        token?: vscode.CancellationToken
    ): Thenable<T | undefined>;
    public static quickPick<T extends vscode.QuickPickItem>(
        items: readonly T[] | Thenable<readonly T[]>,
        options?: vscode.QuickPickOptions & { canPickMany: true },
        token?: vscode.CancellationToken
    ): Thenable<T[] | undefined> {
        return vscode.window.showQuickPick(items, options, token);
    }

    /**
     * Displays a message to the user, including any specified options.
     * @param message The message to display
     * @param options Any additional options for the message
     * @returns A thenable containing the selected item (if items were specified), or `undefined`
     */
    public static showMessage(message: string, options?: GuiMessageOptions): Thenable<string> {
        const severity = options?.severity ?? MessageSeverity.INFO;

        if (options?.logger != null) {
            options.logger.logImperativeMessage(message, severity);
        }

        const errorMessage = options?.logger ? `${options.logger.getExtensionName()}: ${message}` : message;
        if (severity < MessageSeverity.WARN) {
            return vscode.window.showInformationMessage(
                errorMessage,
                options?.vsCodeOpts ?? undefined,
                ...(options?.items ?? [])
            );
        } else if (severity === MessageSeverity.WARN) {
            return vscode.window.showWarningMessage(
                errorMessage,
                options?.vsCodeOpts ?? undefined,
                ...(options?.items ?? [])
            );
        }

        return vscode.window.showErrorMessage(
            errorMessage,
            options?.vsCodeOpts ?? undefined,
            ...(options?.items ?? [])
        );
    }
}

export default Gui;
