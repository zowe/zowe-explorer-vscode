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
        CLEAR_LINE: `\x1b[2K\r`,
        CTRL_C: "\x03",
        DEL: "\x1b[P",
        ENTER: "\r",
        NEW_LINE: "\r\n",
        UP: "\x1b[A",
        DOWN: "\x1b[B",
        RIGHT: "\x1b[C",
        LEFT: "\x1b[D",
        BACKSPACE: "\x7f",
    };

    public constructor(
        terminalName: string,
        private processCmd: (cmd: string) => Promise<string>,
        options?: { startup?: string; message?: string; history?: string[]; formatCommandLine?: (cmd: string) => string }
    ) {
        this.mTerminalName = terminalName;
        this.mMessage = options?.message ?? `Welcome to the ${this.mTerminalName} Terminal!`;
        this.mHistory = options?.history ?? [];
        this.historyIndex = this.mHistory.length;
        this.command = options?.startup ?? "";
        this.cursorPosition = this.command.length;
        this.formatCommandLine = options?.formatCommandLine ?? ((cmd: string) => `${ZoweTerminal.Keys.EMPTY_LINE}${cmd}`);
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
        this.writeCmd();
    }
    protected clearLine() {
        this.write(ZoweTerminal.Keys.CLEAR_LINE);
    }
    protected writeCmd(cmd?: string) {
        this.write(this.formatCommandLine ? this.formatCommandLine(cmd ?? this.command) : cmd ?? this.command);
    }
    protected refreshCmd() {
        this.clearLine();
        this.writeCmd();
        if (this.command.length !== this.cursorPosition) {
            this.write(`\x1B[${this.command.length - this.cursorPosition}D`);
        }
    }
    protected clear() {
        this.write(ZoweTerminal.Keys.CLEAR_ALL);
        this.writeLine(this.mMessage);
    }

    protected command: string;
    protected formatCommandLine: (cmd: string) => string;
    protected cursorPosition: number;

    public onDidWrite: vscode.Event<string> = this.writeEmitter.event;

    private closeEmitter = new vscode.EventEmitter<void>();
    public onDidClose?: vscode.Event<void> = this.closeEmitter.event;

    // Start is called when the terminal is opened
    public open(initialDimensions?: vscode.TerminalDimensions | undefined): void {
        this.writeLine(this.mMessage);
        if (this.command.length > 0) {
            this.handleInput(ZoweTerminal.Keys.ENTER);
        }
    }

    // Close is called when the terminal is closed
    public close(): void {
        this.closeEmitter.fire();
    }

    private navigateHistory(offset: number): void {
        this.historyIndex = Math.max(0, Math.min(this.mHistory.length, this.historyIndex + offset));
        this.command = this.mHistory[this.historyIndex] ?? "";
        this.cursorPosition = this.command.length;
        this.refreshCmd();
    }

    private moveCursor(offset: number): void {
        this.cursorPosition = Math.max(0, Math.min(this.command.length, this.cursorPosition + offset));
        this.refreshCmd();
    }

    // Handle input from the terminal
    public async handleInput(data: string): Promise<void> {
        switch (data) {
            case ZoweTerminal.Keys.CTRL_C:
                this.close();
                break;
            case ZoweTerminal.Keys.UP:
                this.navigateHistory(-1);
                break;
            case ZoweTerminal.Keys.DOWN:
                this.navigateHistory(1);
                break;
            case ZoweTerminal.Keys.LEFT:
                this.moveCursor(-1);
                break;
            case ZoweTerminal.Keys.RIGHT:
                this.moveCursor(1);
                break;
            case ZoweTerminal.Keys.BACKSPACE: {
                if (this.command.length === 0 || this.cursorPosition === 0) {
                    return;
                }
                this.write(ZoweTerminal.Keys.LEFT);
                this.write(ZoweTerminal.Keys.DEL);

                this.cursorPosition = Math.max(0, this.cursorPosition - 1);

                const tmp = this.command.split("");
                tmp.splice(this.cursorPosition, 1);
                this.command = tmp.join("");
                break;
            }
            case ZoweTerminal.Keys.ENTER: {
                this.write(ZoweTerminal.Keys.NEW_LINE);
                const cmd = this.command;
                this.command = "";
                if (cmd.length === 0) {
                    this.writeCmd();
                    return;
                }

                if (cmd[0] === ":") {
                    if (cmd === ":clear") {
                        this.clear();
                    } else if (cmd === ":exit") {
                        this.closeEmitter.fire();
                    }
                } else {
                    const output = await this.processCmd(cmd);
                    this.writeLine(output.trim().split("\n").join("\r\n"));
                }
                this.mHistory.push(cmd);
                this.historyIndex = this.mHistory.length;
                this.cursorPosition = 0;
                break;
            }
            default: {
                this.command = this.command.slice(0, Math.max(0, this.cursorPosition)) + data + this.command.slice(this.cursorPosition);
                this.write(data);
                this.cursorPosition = Math.min(this.command.length, this.cursorPosition + 1);
                this.refreshCmd();
            }
        }
    }
}
