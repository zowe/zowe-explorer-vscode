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

import { ZoweTerminal } from "../../../src/tools/ZoweTerminal";

describe("ZoweTerminal Unit Tests", () => {
    it("should not change the keys", () => {
        expect(ZoweTerminal.Keys).toMatchSnapshot();
    });

    it("should handle ctrl_c to cancel a running command", async () => {
        const spyCb = jest.fn().mockImplementation(async (cmd: string) => Promise.resolve("test-output"));
        const signalSpy = jest.fn().mockImplementation((_event, cb) => cb());
        const iTerm = new ZoweTerminal("test", spyCb, { abort: jest.fn(), signal: { addEventListener: signalSpy } } as any, { history: ["old"] });
        (iTerm as any).command = "open";
        iTerm.open();

        await iTerm.handleInput(ZoweTerminal.Keys.ENTER);
        (iTerm as any).isCommandRunning = true;
        await iTerm.handleInput(ZoweTerminal.Keys.CTRL_D);
        expect(spyCb).toHaveBeenCalledWith("open");
        spyCb.mockClear();

        expect((iTerm as any).mHistory as string[]).toEqual(["old", "open"]);
    });

    it("should send the entered command to the callback function", async () => {
        const spyCb = jest.fn().mockImplementation(async (cmd: string) => Promise.resolve("test-output"));
        const iTerm = new ZoweTerminal("test", spyCb, { signal: { addEventListener: jest.fn() } } as any, { history: ["old"] });
        iTerm.open();

        await iTerm.handleInput("testABC");
        await iTerm.handleInput(ZoweTerminal.Keys.ENTER);
        expect(spyCb).toHaveBeenCalledWith("testABC");
        spyCb.mockClear();

        await iTerm.handleInput(ZoweTerminal.Keys.HOME); // |testABC
        await iTerm.handleInput(ZoweTerminal.Keys.END); // testABC|
        await iTerm.handleInput(ZoweTerminal.Keys.CMD_LEFT); // |testABC
        await iTerm.handleInput(ZoweTerminal.Keys.CMD_RIGHT); // testABC|
        await iTerm.handleInput(ZoweTerminal.Keys.UP); // testABC|
        await iTerm.handleInput(ZoweTerminal.Keys.UP); // old|
        await iTerm.handleInput(ZoweTerminal.Keys.DOWN); // testABC|
        await iTerm.handleInput(ZoweTerminal.Keys.LEFT); // testAB|C
        await iTerm.handleInput(ZoweTerminal.Keys.LEFT); // testA|BC
        await iTerm.handleInput(ZoweTerminal.Keys.BACKSPACE); // test|BC
        await iTerm.handleInput(ZoweTerminal.Keys.RIGHT); // testB|C
        await iTerm.handleInput(ZoweTerminal.Keys.BACKSPACE); // test|C
        // handle multiple characters in sequence (CPU delay / copy+paste)
        await iTerm.handleInput("1A"); // test1A|C
        await iTerm.handleInput(ZoweTerminal.Keys.BACKSPACE); // test1|C
        // Handle double byte characters
        await iTerm.handleInput("🙏🙏"); // test1🙏🙏|C
        await iTerm.handleInput(ZoweTerminal.Keys.BACKSPACE); // test1🙏|C
        // Handle unicode "Hello"
        await iTerm.handleInput("\u0048\u0065\u006C\u006C\u006F"); // test1🙏Hello|C
        await iTerm.handleInput(ZoweTerminal.Keys.DEL); // test1🙏Hello|
        await iTerm.handleInput(ZoweTerminal.Keys.ENTER);
        expect(spyCb).toHaveBeenCalledWith("test1🙏Hello");
        spyCb.mockClear();

        (iTerm as any).command = "";
        await iTerm.handleInput(ZoweTerminal.Keys.INSERT); // do nothing
        await iTerm.handleInput(ZoweTerminal.Keys.TAB); // do nothing
        await iTerm.handleInput("\x1b[1;A"); // Shift+Up // do nothing
        await iTerm.handleInput("\x1b[3;A"); // fn+option+shift+up // do nothing
        await iTerm.handleInput(ZoweTerminal.Keys.ENTER);
        await iTerm.handleInput(ZoweTerminal.Keys.UP); // "test1🙏Hello"
        await iTerm.handleInput(ZoweTerminal.Keys.CTRL_C); // Clear the terminal
        await iTerm.handleInput(ZoweTerminal.Keys.CTRL_C); // Present the "(to exit ...)" message
        await iTerm.handleInput(ZoweTerminal.Keys.CTRL_C); // close
        await iTerm.handleInput(ZoweTerminal.Keys.CTRL_D); // close
        await iTerm.handleInput(":clear");
        await iTerm.handleInput(ZoweTerminal.Keys.ENTER);
        await iTerm.handleInput(":exit");
        await iTerm.handleInput(ZoweTerminal.Keys.ENTER);

        expect((iTerm as any).mHistory as string[]).toEqual(["old", "testABC", "test1🙏Hello", ":clear", ":exit"]);
    });
});
