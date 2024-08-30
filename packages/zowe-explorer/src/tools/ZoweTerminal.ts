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

export class ZoweTerminal implements vscode.Pseudoterminal {
    public static readonly mTermX = ">";
    public static readonly Keys = {
        EMPTY_LINE: `${this.mTermX} `,
        CLEAR_ALL: "\x1b[2J\x1b[3J\x1b[;H",
        CLEAR_LINE: `\x1b[2K\r${this.mTermX} `,
        DEL: "\x1b[P",
        ENTER: "\r",
        NEW_LINE: "\r\n",
        UP: "\x1b[A",
        DOWN: "\x1b[B",
        RIGHT: "\x1b[C",
        LEFT: "\x1b[D",
        BACKSPACE: "\x7f",
    };

    public constructor(terminalName: string, message?: string, history: string[] = []) {
        this.mTerminalName = terminalName;
        this.mMessage = message ?? `Welcome to the ${this.mTerminalName} Terminal!`;
        this.mHistory = history;
        this.historyIndex = history.length;
    }

    private mMessage: string;
    protected mTerminalName: string = "";
    protected mHistory: string[];
    private historyIndex: number;

    private writeEmitter = new vscode.EventEmitter<string>();
    protected write(text: string) {
        this.writeEmitter.fire(text);
    }
    protected writeLine(text: string) {
        this.write(text);
        this.write(ZoweTerminal.Keys.NEW_LINE);
        this.write(ZoweTerminal.Keys.EMPTY_LINE);
    }
    protected refreshCmd() {
        this.write(ZoweTerminal.Keys.CLEAR_LINE);
        this.write(this.command);
    }
    protected clear() {
        this.write(ZoweTerminal.Keys.CLEAR_ALL);
        this.writeLine(this.mMessage);
    }

    protected command: string = "";
    protected cursorPosition = 0;

    public onDidWrite: vscode.Event<string> = this.writeEmitter.event;

    private closeEmitter = new vscode.EventEmitter<void>();
    public onDidClose?: vscode.Event<void> = this.closeEmitter.event;

    // Start is called when the terminal is opened
    public open(initialDimensions: vscode.TerminalDimensions | undefined): void {
        this.writeLine(this.mMessage);
    }

    // Close is called when the terminal is closed
    public close(): void {
        this.closeEmitter.fire();
    }

    // Handle input from the terminal
    public handleInput(data: string): void {
        console.log(data, this.historyIndex, this.mHistory);
        if (data === ZoweTerminal.Keys.UP) {
            this.historyIndex = Math.max(0, this.historyIndex - 1);
            this.command = this.mHistory[this.historyIndex] ?? "";
            this.cursorPosition = this.command.length;
            this.refreshCmd();
            return;
        }
        if (data === ZoweTerminal.Keys.DOWN) {
            if (this.historyIndex === this.mHistory.length) {
                this.command = "";
            } else {
                this.historyIndex = Math.min(this.mHistory.length, this.historyIndex + 1);
                this.command = this.mHistory[this.historyIndex] ?? "";
            }
            this.cursorPosition = this.command.length;
            this.refreshCmd();
            return;
        }
        if (data === ZoweTerminal.Keys.LEFT) {
            this.cursorPosition = Math.max(0, this.cursorPosition - 1);
            if (this.cursorPosition > 0) {
                this.write(ZoweTerminal.Keys.LEFT);
            }
            return;
        }
        if (data === ZoweTerminal.Keys.RIGHT) {
            this.cursorPosition = Math.min(this.command.length, this.cursorPosition + 1);
            if (this.cursorPosition < this.command.length) {
                this.write(ZoweTerminal.Keys.RIGHT);
            }
            return;
        }
        if (data === ZoweTerminal.Keys.BACKSPACE) {
            if (this.command.length === 0) {
                return;
            }
            this.write(ZoweTerminal.Keys.LEFT);
            this.write(ZoweTerminal.Keys.DEL);

            const tmp = this.command.split("");
            tmp.splice(this.cursorPosition - 1, 1);
            this.command = tmp.join("");

            this.cursorPosition = Math.max(0, this.cursorPosition - 1);

            // this.refreshCmd();
            return;
        }
        if (data === ZoweTerminal.Keys.ENTER) {
            this.write(ZoweTerminal.Keys.NEW_LINE);
            if (this.command.length === 0) {
                this.write(ZoweTerminal.Keys.EMPTY_LINE);
                return;
            }
            if (this.command === "hello") {
                this.writeLine("Hello there!");
            } else if (this.command === ":clear") {
                this.clear();
            } else if (this.command === "date") {
                this.writeLine(`Current date: ${new Date().toLocaleString()}`);
            } else if (this.command === ":exit") {
                this.writeLine("Exiting...");
                this.closeEmitter.fire();
            } else {
                this.writeLine(`Unknown command: ${this.command}`);
            }

            this.mHistory.push(this.command);
            this.historyIndex = this.mHistory.length;
            this.cursorPosition = 0;
            this.command = "";
            return;
        }

        this.write(data);
        this.command += data;
        this.cursorPosition = Math.min(this.command.length, this.cursorPosition + 1);
    }
}
