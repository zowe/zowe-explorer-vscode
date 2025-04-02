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
    // --- Static Constants (Escape Sequences, etc.) ---
    public static readonly mTermX = ">";
    public static readonly invalidChar = "�";
    public static readonly Keys = {
        EMPTY_LINE: `${this.mTermX} `,
        CLEAR_ALL: "\x1b[2J\x1b[H", // clears entire screen AND resets cursor
        NEW_LINE: "\r\n",
        LEFT: "\x1b[D",
        RIGHT: "\x1b[C",
        HOME: "\x1b[H",
        END: "\x1b[F",
        CMD_LEFT: "\x01", // MacOS HOME
        CTRL_C: "\x1b", // kept original
        CTRL_D: "\x1b", // kept original
        CMD_RIGHT: "\x1b", // MacOS END
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
        OPT_LEFT: "\x1bb",
        OPT_RIGHT: "\x1bf",
        UP: "\x1b[A",
        DOWN: "\x1b[B",
        hasModKey: (key: string): boolean => {
            return key.startsWith("\x1b[1;") || key.startsWith("\x1b[3;");
        },
    };

    // --- Instance Variables ---
    private screenBuffer: string[] = []; // Buffer that holds all output (one line per element)
    private charArrayCmd: string[] = [];
    private mMessage: string;
    protected mTerminalName: string = "";
    protected mHistory: string[];
    private historyIndex: number;
    private isCommandRunning = false;
    private pressedCtrlC = false;
    private chalk;
    protected command: string;
    protected formatCommandLine: (cmd: string) => string;
    protected cursorPosition: number;

    private writeEmitter = new vscode.EventEmitter<string>();
    public onDidWrite: vscode.Event<string> = this.writeEmitter.event;

    private closeEmitter = new vscode.EventEmitter<void>();
    public onDidClose?: vscode.Event<void> = this.closeEmitter.event;

    // --- Constructor ---
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
        this.cursorPosition = this.command.length;
        this.formatCommandLine = options?.formatCommandLine ?? ((cmd: string) => `${ZoweTerminal.Keys.EMPTY_LINE}${cmd}`);
        this.chalk = imperative.TextUtils.chalk;
    }

    // --- Public Methods ---
    public open(_initialDimensions?: vscode.TerminalDimensions | undefined): void {
        if (this.screenBuffer.length === 0) {
            this.writeLine(this.chalk.dim.italic(this.mMessage));
        }
        if (this.command.length > 0) {
            this.handleInput(ZoweTerminal.Keys.ENTER);
        }
    }

    public close(): void {
        this.closeEmitter.fire();
    }

    public async handleInput(data: string): Promise<void> {
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
            case ZoweTerminal.Keys.OPT_LEFT:
            case ZoweTerminal.Keys.LEFT:
                if (this.cursorPosition > 0) {
                    this.cursorPosition--;
                    this.write(ZoweTerminal.Keys.LEFT);
                }
                break;
            case ZoweTerminal.Keys.OPT_RIGHT:
            case ZoweTerminal.Keys.RIGHT:
                if (this.cursorPosition < this.charArrayCmd.length) {
                    this.cursorPosition++;
                    this.write(ZoweTerminal.Keys.RIGHT);
                }
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
                // Do nothing for now.
                break;
            default: {
                // Insert new data at the current cursor position.
                this.command =
                    this.charArrayCmd.slice(0, this.cursorPosition).join("") +
                    data +
                    this.charArrayCmd.slice(this.cursorPosition).join("");
                this.charArrayCmd = Array.from(this.command);
                this.cursorPosition += Array.from(data).length;
                this.refreshCmd();
                break;
            }
        }
    }

    // --- Rendering Helpers ---
    // Append text to the output buffer only.
    private appendToBuffer(text: string): void {
        this.screenBuffer.push(text);
    }

    // Write text to the terminal output.
    protected write(text: string) {
        this.writeEmitter.fire(text);
    }

    // Write text to terminal and add it to the output buffer.
    protected writeLine(text: string) {
        this.appendToBuffer(text);
        this.write(text + ZoweTerminal.Keys.NEW_LINE);
        this.writeCmd();
    }

    // Perform a full screen refresh: clear the terminal, reprint history, and display the prompt.
    private fullRefresh(): void {
        this.write(ZoweTerminal.Keys.CLEAR_ALL);
        for (const line of this.screenBuffer) {
            this.write(line + ZoweTerminal.Keys.NEW_LINE);
        }
        this.write(this.formatCommandLine(this.command));
    }

    // Refresh the command prompt display and adjust the hardware cursor.
    protected refreshCmd(): void {
        this.command = this.sanitizeInput(this.command);
        this.pressedCtrlC = false;
        if (!this.charArrayCmd.length || this.charArrayCmd.join("") !== this.command) {
            this.charArrayCmd = Array.from(this.command);
        }
        this.fullRefresh();

        const promptPrefix = ZoweTerminal.Keys.EMPTY_LINE; // e.g., "> "
        const promptLength = promptPrefix.length;
        const cursor = promptLength + this.command.length;
        const desiredCol = promptLength + this.cursorPosition;
        const moveLeft = cursor - desiredCol;
        if (moveLeft > 0) {
            this.write(`\x1b[${moveLeft}D`);
        }
    }

    // Write the prompt line without adding it to the buffer.
    protected writeCmd() {
        this.write(this.formatCommandLine(this.command));
    }

    // Clear the output buffer and reprint the welcome message.
    protected clear() {
        this.screenBuffer = [];
        this.write(ZoweTerminal.Keys.CLEAR_ALL);
        this.writeLine(this.chalk.dim.italic(this.mMessage));
    }

    // --- Input Processing Helpers ---
    private navigateHistory(offset: number): void {
        this.historyIndex = Math.max(0, Math.min(this.mHistory.length, this.historyIndex + offset));
        this.command = this.mHistory[this.historyIndex] ?? "";
        this.charArrayCmd = Array.from(this.command);
        this.cursorPosition = this.charArrayCmd.length;
        this.refreshCmd();
    }

    private moveCursorTo(position: number): void {
        this.cursorPosition = Math.max(0, Math.min(this.charArrayCmd.length, position));
        this.refreshCmd();
    }

    private deleteCharacter(offset: number): void {
        const deleteIndex = this.cursorPosition + offset;
        if (deleteIndex >= 0 && deleteIndex < this.charArrayCmd.length) {
            this.charArrayCmd.splice(deleteIndex, 1);
            this.command = this.charArrayCmd.join("");
            if (offset === -1) {
                this.cursorPosition--;
            }
            this.refreshCmd();
        }
    }

    private async handleEnter() {
        this.write(ZoweTerminal.Keys.NEW_LINE);
        const cmd = this.command;
        this.appendToBuffer(this.formatCommandLine(cmd));
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
                this.appendToBuffer(this.chalk.italic.red("Operation cancelled!"));
            } else {
                this.appendToBuffer(output.trim().split("\n").join("\r\n"));
            }
        }
        this.mHistory.push(cmd);
        this.historyIndex = this.mHistory.length;
        this.cursorPosition = 0;
        // Fixed an issue where history navigation and multi-line commands were adding permanent new lines
        // by ensuring the command block is correctly cleared and re-rendered.
        this.fullRefresh();
    }

    // --- Utility Functions ---
    private isPrintable(char: string): boolean {
        const codePoint = char.codePointAt(0);
        if (codePoint === undefined) return false;
        if (codePoint >= 0x20 && codePoint <= 0x7e) return true;
        if (codePoint >= 0xa0 && codePoint <= 0xd7ff) return true;
        if (codePoint >= 0xe000 && codePoint <= 0xfffd) return true;
        if (codePoint >= 0x10000 && codePoint <= 0x10ffff) return true;
        return false;
    }

    private sanitizeInput(input: string): string {
        return Array.from(input)
            .map((char) => (this.isPrintable(char) ? char : ZoweTerminal.invalidChar))
            .join("");
    }
}
