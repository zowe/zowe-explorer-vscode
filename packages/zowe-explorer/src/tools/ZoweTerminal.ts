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

import { imperative } from "@zowe/zowe-explorer-api";
import * as vscode from "vscode";

export class ZoweTerminal implements vscode.Pseudoterminal {
    public static readonly mTermX = ">";
    public static readonly invalidChar = "�";
    public static readonly Keys = {
        EMPTY_LINE: `${this.mTermX} `,
        CLEAR_ALL: "\x1b[2J\x1b[3J\x1b[;H",
        CLEAR_LINE: `\x1b[2K\r`,
        END: "\x1b[F",
        HOME: "\x1b[H",
        CMD_LEFT: "\x01", // MacOS HOME
        CTRL_C: "\x03",
        CTRL_D: "\x04",
        CMD_RIGHT: "\x05", // MacOS END
        CTRL_BACKSPACE: "\x08",
        TAB: "\x09",
        CMD_BACKSPACE: "\x15",
        OPT_BACKSPACE: "\x17",
        OPT_CMD_BACKSPACE: "\x1b\x7F",
        BACKSPACE: "\x7f",
        INSERT: "\x1b[2~",
        DEL: "\x1b[3~",
        PAGE_UP: "\x1b[5~",
        PAGE_DOWN: "\x1b[6~",
        ENTER: "\r",
        NEW_LINE: "\r\n",
        UP: "\x1b[A",
        DOWN: "\x1b[B",
        RIGHT: "\x1b[C",
        LEFT: "\x1b[D",
        hasModKey: (key: string): boolean => {
            if (key.startsWith("\x1b[1;") || key.startsWith("\x1b[3;")) return true;
            return false;
        },
    };

    public constructor(
        terminalName: string,
        private processCmd: (cmd: string) => Promise<string>,
        private controller: AbortController,
        options?: { startup?: string; message?: string; history?: string[]; formatCommandLine?: (cmd: string) => string }
    ) {
        this.mTerminalName = terminalName;
        this.mMessage = options?.message ?? this.mTerminalName;
        this.mHistory = options?.history ?? [];
        this.historyIndex = this.mHistory.length;
        this.command = options?.startup ?? "";
        this.charArrayCmd = [];
        this.cursorPosition = this.charArrayCmd.length;
        this.formatCommandLine = options?.formatCommandLine ?? ((cmd: string) => `${ZoweTerminal.Keys.EMPTY_LINE}${cmd}`);
        this.chalk = imperative.TextUtils.chalk;
    }

    private charArrayCmd: string[];
    private mMessage: string;
    protected mTerminalName: string = "";
    protected mHistory: string[];
    private historyIndex: number;
    private isCommandRunning = false;
    private pressedCtrlC = false;
    private chalk;

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
        this.command = this.sanitizeInput(this.command);
        this.pressedCtrlC = false;
        if (!this.charArrayCmd.length || this.charArrayCmd.join("") !== this.command) {
            this.charArrayCmd = Array.from(this.command);
        }
        this.clearLine();
        this.writeCmd();
        if (this.charArrayCmd.length > this.cursorPosition) {
            const getPos = (char: string) => {
                if (char === ZoweTerminal.invalidChar) return 1;
                const charBytes = Buffer.from(char).length;
                return charBytes > 2 ? 2 : 1;
            };
            const offset = this.charArrayCmd.slice(this.cursorPosition).reduce((total, curr) => total + getPos(curr), 0);
            [...Array(offset)].map(() => this.write(ZoweTerminal.Keys.LEFT));
        }
    }
    protected clear() {
        this.write(ZoweTerminal.Keys.CLEAR_ALL);
        this.writeLine(this.chalk.dim.italic(this.mMessage));
    }

    protected command: string;
    protected formatCommandLine: (cmd: string) => string;
    protected cursorPosition: number;

    public onDidWrite: vscode.Event<string> = this.writeEmitter.event;

    private closeEmitter = new vscode.EventEmitter<void>();
    public onDidClose?: vscode.Event<void> = this.closeEmitter.event;

    public open(_initialDimensions?: vscode.TerminalDimensions | undefined): void {
        this.writeLine(this.chalk.dim.italic(this.mMessage));
        if (this.command.length > 0) {
            this.handleInput(ZoweTerminal.Keys.ENTER);
        }
    }

    public close(): void {
        this.closeEmitter.fire();
    }

    private navigateHistory(offset: number): void {
        this.historyIndex = Math.max(0, Math.min(this.mHistory.length, this.historyIndex + offset));
        this.command = this.mHistory[this.historyIndex] ?? "";
        this.charArrayCmd = Array.from(this.command);
        this.cursorPosition = this.charArrayCmd.length;
        this.refreshCmd();
    }

    private moveCursor(offset: number): void {
        this.cursorPosition = Math.max(0, Math.min(this.charArrayCmd.length, this.cursorPosition + offset));
        this.refreshCmd();
    }

    private moveCursorTo(position: number): void {
        this.cursorPosition = position < 0 ? 0 : Math.min(this.charArrayCmd.length, position);
        this.refreshCmd();
    }

    private isPrintable(char: string): boolean {
        const codePoint = char.codePointAt(0);
        if (codePoint === undefined) return false;
        if (codePoint >= 0x20 && codePoint <= 0x7e) return true;
        if (codePoint >= 0xa0 && codePoint <= 0xd7ff) return true; // Control characters
        if (codePoint >= 0xe000 && codePoint <= 0xfffd) return true; // Private use area
        if (codePoint >= 0x10000 && codePoint <= 0x10ffff) return true; // Supplemental planes
        return false;
    }

    private sanitizeInput(input: string): string {
        return Array.from(input)
            .map((char) => (this.isPrintable(char) ? char : ZoweTerminal.invalidChar))
            .join("");
    }

    private deleteCharacter(offset: number): void {
        const deleteIndex = this.cursorPosition + offset;

        if (deleteIndex >= 0 && deleteIndex < this.charArrayCmd.length) {
            this.charArrayCmd.splice(deleteIndex, 1);
            this.command = this.charArrayCmd.join("");

            if (offset === -1) {
                this.cursorPosition--;
                this.write(ZoweTerminal.Keys.LEFT);
            } else if (offset === 0) {
                this.write(ZoweTerminal.Keys.DEL);
            }
            this.refreshCmd();
        }
    }

    private async handleEnter() {
        this.write(ZoweTerminal.Keys.NEW_LINE);
        const cmd = this.command;
        this.command = "";
        this.charArrayCmd = [];
        if (cmd.length === 0) {
            this.writeCmd();
            return;
        }

        if (cmd[0] === ":") {
            if (cmd === ":clear") {
                this.clear();
            } else if (cmd === ":exit") {
                this.close();
            }
        } else {
            this.isCommandRunning = true;

            const output = await Promise.race([
                this.processCmd(cmd),
                new Promise<null>((resolve, _reject) => {
                    this.controller.signal.addEventListener("abort", () => {
                        this.isCommandRunning = false;
                        resolve(null);
                    });
                    if (!this.isCommandRunning) resolve(null);
                }),
            ]);
            this.isCommandRunning = false;
            if (output === null) {
                this.writeLine(this.chalk.italic.red("Operation cancelled!"));
            } else {
                this.writeLine(output.trim().split("\n").join("\r\n"));
            }
        }
        this.mHistory.push(cmd);
        this.historyIndex = this.mHistory.length;
        this.cursorPosition = 0;
    }

    // Handle input from the terminal
    public async handleInput(data: string): Promise<void> {
        console.log("data", data, Buffer.from(data));
        if (this.isCommandRunning) {
            if ([ZoweTerminal.Keys.CTRL_C, ZoweTerminal.Keys.CTRL_D].includes(data)) this.controller.abort();
            if (data === ZoweTerminal.Keys.CTRL_D) this.close();
            else this.pressedCtrlC = true;
            return;
        }
        if (ZoweTerminal.Keys.hasModKey(data)) return;
        switch (data) {
            case ZoweTerminal.Keys.CTRL_C:
                if (this.pressedCtrlC) this.close();
                if (this.command.length > 0) {
                    this.command = "";
                    this.handleEnter();
                } else {
                    this.writeLine(this.chalk.italic("(To exit, press Ctrl+C again or Ctrl+D or type :exit)"));
                    this.pressedCtrlC = true;
                }
                break;
            case ZoweTerminal.Keys.CTRL_D:
                this.close();
                break;
            case ZoweTerminal.Keys.UP:
            case ZoweTerminal.Keys.PAGE_UP:
                this.navigateHistory(-1);
                break;
            case ZoweTerminal.Keys.DOWN:
            case ZoweTerminal.Keys.PAGE_DOWN:
                this.navigateHistory(1);
                break;
            case ZoweTerminal.Keys.LEFT:
                this.moveCursor(-1);
                break;
            case ZoweTerminal.Keys.RIGHT:
                this.moveCursor(1);
                break;
            case ZoweTerminal.Keys.HOME:
            case ZoweTerminal.Keys.CMD_LEFT:
                this.moveCursorTo(0);
                break;
            case ZoweTerminal.Keys.END:
            case ZoweTerminal.Keys.CMD_RIGHT:
                this.moveCursorTo(this.charArrayCmd.length);
                break;
            case ZoweTerminal.Keys.DEL:
                this.deleteCharacter(0);
                break;
            case ZoweTerminal.Keys.BACKSPACE:
            case ZoweTerminal.Keys.CTRL_BACKSPACE:
            case ZoweTerminal.Keys.CMD_BACKSPACE:
            case ZoweTerminal.Keys.OPT_BACKSPACE:
            case ZoweTerminal.Keys.OPT_CMD_BACKSPACE:
                this.deleteCharacter(-1);
                break;
            case ZoweTerminal.Keys.ENTER:
                await this.handleEnter();
                break;
            case ZoweTerminal.Keys.TAB:
            case ZoweTerminal.Keys.INSERT:
                // Do nothing
                break;
            default: {
                const charArray = this.charArrayCmd;
                this.command = charArray.slice(0, Math.max(0, this.cursorPosition)).join("") + data + charArray.slice(this.cursorPosition).join("");
                this.charArrayCmd = Array.from(this.command);
                this.cursorPosition = Math.min(this.charArrayCmd.length, this.cursorPosition + Array.from(data).length);
                this.write(data);
                this.refreshCmd();
            }
        }
    }
}
