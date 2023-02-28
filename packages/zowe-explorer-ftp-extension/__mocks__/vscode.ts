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

export namespace window {
    /**
     * Show an information message to users. Optionally provide an array of items which will be presented as
     * clickable buttons.
     *
     * @param message The message to show.
     * @param items A set of items that will be rendered as actions in the message.
     * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
     */
    export function showInformationMessage(_message: string, ..._items: string[]): undefined {
        return undefined;
    }

    export function showErrorMessage(_message: string, ..._items: string[]): undefined {
        return undefined;
    }

    export function setStatusBarMessage(_message: string, ..._items: string[]): undefined {
        return undefined;
    }

    /**
     * Options to configure the behavior of the message.
     *
     * @see [showInformationMessage](#window.showInformationMessage)
     * @see [showWarningMessage](#window.showWarningMessage)
     * @see [showErrorMessage](#window.showErrorMessage)
     */
    export interface MessageOptions {
        /**
         * Indicates that this message should be modal.
         */
        modal?: boolean;
    }

    export interface MessageItem {
        /**
         * A short title like 'Retry', 'Open Log' etc.
         */
        title: string;

        /**
         * A hint for modal dialogs that the item should be triggered
         * when the user cancels the dialog (e.g. by pressing the ESC
         * key).
         *
         * Note: this option is ignored for non-modal messages.
         */
        isCloseAffordance?: boolean;
    }
}
