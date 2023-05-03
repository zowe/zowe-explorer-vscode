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
import { IZoweLogger, MessageSeverity } from "../logger";
import { IZoweTree, IZoweTreeNode } from "../tree";
import { DOUBLE_CLICK_SPEED_MS } from "./Constants";

export interface GuiMessageOptions<T extends string | vscode.MessageItem> {
    severity?: MessageSeverity;
    items?: T[];
    logger?: IZoweLogger;
    vsCodeOpts?: vscode.MessageOptions;
}

export interface WebviewOptions {
    viewType: string;
    title: string;
    showOptions: vscode.ViewColumn | { viewColumn: vscode.ViewColumn; preserveFocus?: boolean };
    vscode?: vscode.WebviewPanelOptions & vscode.WebviewOptions;
}

export namespace Gui {
    /**
     * Creates a new output channel with the given name and language ID
     * @param name The desired name for the output channel
     * @param languageId Identifier associated with the language for this output channel
     * @returns The new output channel with the specified options
     *
     * @see vscode.window.createOutputChannel for more details
     */
    export function createOutputChannel(name: string, languageId?: string): vscode.OutputChannel {
        return vscode.window.createOutputChannel(name, languageId);
    }

    /**
     * Creates a QuickPick within VS Code with more flexible options than `quickPick`
     * @returns A new QuickPick object
     *
     * @see vscode.window.createQuickPick for more details
     */
    export function createQuickPick<T extends vscode.QuickPickItem>(): vscode.QuickPick<T> {
        return vscode.window.createQuickPick();
    }

    /**
     * Creates a TreeView given the specified view ID and options
     * @param viewId The ID contributed by `views`
     * @param options Any options for creating the tree view
     * @returns A new TreeView object of the provided type
     *
     * @see vscode.window.createTreeView for more details
     */
    export function createTreeView<T>(viewId: string, options: vscode.TreeViewOptions<T>): vscode.TreeView<T> {
        return vscode.window.createTreeView(viewId, options);
    }

    /**
     * Create and show a new webview panel
     * @param options Settings for the new panel (@see WebviewOptions for more info)
     *
     * @see vscode.window.createWebviewPanel for more details
     */
    export function createWebviewPanel(options: WebviewOptions): vscode.WebviewPanel {
        return vscode.window.createWebviewPanel(options.viewType, options.title, options.showOptions, options.vscode);
    }

    /**
     * Wrapper function for `showMessage` to display an error message.
     * @param message The message to display
     * @param options Additional options for the displayed message
     * @returns A thenable containing the selected item (if items were specified), or `undefined`
     */
    export function errorMessage<T extends string | vscode.MessageItem>(
        message: string,
        options?: Omit<GuiMessageOptions<T>, "severity">
    ): Thenable<T | undefined> {
        return showMessage(message, {
            ...options,
            severity: MessageSeverity.ERROR,
        });
    }

    /**
     * Wrapper function for `showMessage` to display an informational message.
     * @param message The message to display
     * @param options Additional options for the displayed message
     * @returns A thenable containing the selected item (if items were specified), or `undefined`
     */
    export function infoMessage<T extends string | vscode.MessageItem>(
        message: string,
        options?: Omit<GuiMessageOptions<T>, "severity">
    ): Thenable<T | undefined> {
        return showMessage(message, {
            ...options,
            severity: MessageSeverity.INFO,
        });
    }

    /**
     * Wrapper function for `showMessage` to display a warning message.
     * @param message The message to display
     * @param options Additional options for the displayed message
     * @returns A thenable containing the selected item (if items were specified), or `undefined`
     */
    export function warningMessage<T extends string | vscode.MessageItem>(
        message: string,
        options?: Omit<GuiMessageOptions<T>, "severity">
    ): Thenable<T | undefined> {
        return showMessage(message, {
            ...options,
            severity: MessageSeverity.WARN,
        });
    }

    /**
     * Shows an input box within VS Code using the specified options.
     * @param options All options for the input box
     * @returns The user's response, or `undefined` if the input box was dismissed.
     *
     * @see vscode.window.showInputBox for more details
     */
    export function showInputBox(options: vscode.InputBoxOptions): Thenable<string | undefined> {
        if (!options.validateInput) {
            options.validateInput = (_value): string | Thenable<string> => null;
        }

        return vscode.window.showInputBox(options);
    }

    /**
     * Shows a file open dialog to the user which allows for file selection
     * @param options Configure the behavior of the open file dialog
     * @returns A promise containing the selected resource(s) or `undefined`
     *
     * @see vscode.window.showOpenDialog for more details
     */
    export function showOpenDialog(options?: vscode.OpenDialogOptions): Thenable<vscode.Uri[]> {
        return vscode.window.showOpenDialog(options);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export function setStatusBarMessage(text: string, hideAfterTimeout: Thenable<any>): vscode.Disposable;
    export function setStatusBarMessage(text: string, hideAfterTimeout: number): vscode.Disposable;
    export function setStatusBarMessage(text: string): vscode.Disposable;
    /**
     * Set a message for the status bar.
     * @param text The text to display within the status bar
     * @param timeoutOrThenable A timeout in milliseconds, or a thenable (after completion, the message is disposed).
     * @returns A disposable that hides the status bar message
     *
     * @see vscode.window.setStatusBarMessage for more details
     */
    // Disabling no-explicit-any as it is defined as such within VS Code
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export function setStatusBarMessage(text: string, timeoutOrThenable?: number | Thenable<any>): vscode.Disposable {
        if (typeof timeoutOrThenable === "number") {
            return vscode.window.setStatusBarMessage(text, timeoutOrThenable);
        }
        return vscode.window.setStatusBarMessage(text, timeoutOrThenable ?? undefined);
    }

    /**
     * Builds the specified QuickPick result based on user interaction.
     * @param quickpick The QuickPick object to resolve
     * @returns A promise containing the result of the QuickPick
     */
    export function resolveQuickPick(quickpick: vscode.QuickPick<vscode.QuickPickItem>): Promise<vscode.QuickPickItem | undefined> {
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
     *
     * @see vscode.window.showQuickPick for more details
     */
    export function showQuickPick<T extends string>(
        items: readonly T[] | Thenable<readonly T[]>,
        options?: vscode.QuickPickOptions,
        token?: vscode.CancellationToken
    ): Thenable<T | undefined>;
    export function showQuickPick<T extends string>(
        items: readonly T[] | Thenable<readonly T[]>,
        options?: vscode.QuickPickOptions & { canPickMany: true },
        token?: vscode.CancellationToken
    ): Thenable<T[] | undefined>;
    export function showQuickPick<T extends vscode.QuickPickItem>(
        items: readonly T[] | Thenable<readonly T[]>,
        options?: vscode.QuickPickOptions,
        token?: vscode.CancellationToken
    ): Thenable<T | undefined>;
    export function showQuickPick<T extends vscode.QuickPickItem>(
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
    export function showMessage<T extends string | vscode.MessageItem>(message: string, options?: GuiMessageOptions<T>): Thenable<T | undefined> {
        const severity = options?.severity ?? MessageSeverity.INFO;

        if (options?.logger != null) {
            options.logger.logImperativeMessage(message, severity);
        }

        const msg = options?.logger ? `${options.logger.getExtensionName()}: ${message}` : message;
        if (severity < MessageSeverity.WARN) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
            return vscode.window.showInformationMessage(msg, options?.vsCodeOpts ?? undefined, ...((options?.items as any[]) ?? [])) as Thenable<T>;
        } else if (severity === MessageSeverity.WARN) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
            return vscode.window.showWarningMessage(msg, options?.vsCodeOpts ?? undefined, ...((options?.items as any[]) ?? [])) as Thenable<T>;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
        return vscode.window.showErrorMessage(msg, options?.vsCodeOpts ?? undefined, ...((options?.items as any[]) ?? [])) as Thenable<T>;
    }

    /**
     * Helper type guard to check if a document object belong to VS Code's `TextDocument` interface
     * @param doc The object that may or may not be a `vscode.TextDocument`
     * @returns Whether `doc` is a `vscode.TextDocument`
     */
    export function isTextDocument(doc): doc is vscode.TextDocument {
        return doc != null && typeof doc === "object" && "uri" in doc;
    }

    /**
     * Show the given document in a text editor.
     * @param docOrUri The document or URI object to display
     * @param options Any options for the behavior of the text document
     * @returns A promise that resolves to an editor
     *
     * @see vscode.window.showTextDocument for more details
     */
    export function showTextDocument(
        docOrUri: vscode.TextDocument | vscode.Uri,
        options?: vscode.TextDocumentShowOptions
    ): Thenable<vscode.TextEditor> {
        if (isTextDocument(docOrUri)) {
            return vscode.window.showTextDocument(docOrUri, options);
        }

        return vscode.window.showTextDocument(docOrUri, options);
    }

    /**
     * Show progress in the editor.
     * @param options Location and other details for the progress
     * @param task A callback that returns a promise
     * @returns The promise that the task callback returned
     *
     * @see @see vscode.window.withProgress for more details
     */
    export function withProgress<R>(
        options: vscode.ProgressOptions,
        task: (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => Thenable<R>
    ): Thenable<R> {
        return vscode.window.withProgress(options, task);
    }

    /**
     * Reports the progress of a Gui.withProgress action results in visual update for users.
     *
     * @export
     * @param {any} progress - Gui.withProgress progress
     * @param {number} valueLength - values array length used to calculate progress
     * @param {number} index - withProgress loop array's index
     * @param {string} action - the action the progress is reported for, ie. Uploading
     */
    export function reportProgress(progress: any, valueLength: number, index: number, action: string): void {
        progress.report({
            message: `${action} ${index + 1} of ${valueLength}`,
            // eslint-disable-next-line no-magic-numbers
            increment: 100 / valueLength,
        });
    }

    export namespace utils {
        /**
         * Determines whether a node has been double-clicked within a tree view.
         *
         * @param node The node that was just clicked
         * @param provider The tree provider that the node belongs to
         * @returns Whether the node has been double-clicked.
         */
        export function wasDoubleClicked<T>(node: IZoweTreeNode, provider: IZoweTree<T>): boolean {
            const timeOfClick = new Date();
            if (provider.lastOpened?.node === node) {
                const timeDelta = timeOfClick.getTime() - provider.lastOpened.date.getTime();
                provider.lastOpened.date = timeOfClick;

                // If the time (in ms) between clicks is less than the defined DOUBLE_CLICK_SPEED_MS,
                // recognize the action as a double-click.
                return timeDelta <= DOUBLE_CLICK_SPEED_MS;
            }

            provider.lastOpened = {
                node,
                date: timeOfClick,
            };

            return false;
        }
    }
}
