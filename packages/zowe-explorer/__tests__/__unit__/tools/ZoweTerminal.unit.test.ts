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

    it("should send the entered command to the callback function", async () => {
        const spyCb = jest.fn().mockImplementation(async (cmd: string) => Promise.resolve("test-output"));
        const iTerm = new ZoweTerminal("test", spyCb, { history: ["old"] });
        iTerm.open();

        await iTerm.handleInput("testABC");
        await iTerm.handleInput(ZoweTerminal.Keys.ENTER);
        expect(spyCb).toHaveBeenCalledWith("testABC");
        spyCb.mockClear();

        await iTerm.handleInput(ZoweTerminal.Keys.UP);                  // testABC|
        await iTerm.handleInput(ZoweTerminal.Keys.UP);                  // old|
        await iTerm.handleInput(ZoweTerminal.Keys.DOWN);                // testABC|
        await iTerm.handleInput(ZoweTerminal.Keys.LEFT);                // testAB|C
        await iTerm.handleInput(ZoweTerminal.Keys.LEFT);                // testA|BC
        await iTerm.handleInput(ZoweTerminal.Keys.BACKSPACE);           // test|BC
        await iTerm.handleInput(ZoweTerminal.Keys.RIGHT);               // testB|C
        await iTerm.handleInput(ZoweTerminal.Keys.BACKSPACE);           // test|C
        // handle multiple characters in sequence (CPU delay / copy+paste)
        await iTerm.handleInput("1A"); // test1A|C
        await iTerm.handleInput(ZoweTerminal.Keys.BACKSPACE);           // test1|C
        // Handle double byte characters
        await iTerm.handleInput("🙏🙏");                                 // test1🙏🙏|C
        await iTerm.handleInput(ZoweTerminal.Keys.BACKSPACE);           // test1🙏|C
        // Handle unicode "hello"
        await iTerm.handleInput("\u0048\u0065\u006C\u006C\u006F");      // test1🙏Hello|C
        await iTerm.handleInput(ZoweTerminal.Keys.ENTER);
        expect(spyCb).toHaveBeenCalledWith("test1🙏HelloC");
        spyCb.mockClear();

        (iTerm as any).command = "";
        await iTerm.handleInput(ZoweTerminal.Keys.ENTER);
        await iTerm.handleInput(ZoweTerminal.Keys.CTRL_C);
        await iTerm.handleInput(":clear");
        await iTerm.handleInput(ZoweTerminal.Keys.ENTER);
        await iTerm.handleInput(":exit");
        await iTerm.handleInput(ZoweTerminal.Keys.ENTER);

        expect((iTerm as any).mHistory as string[]).toEqual(["old", "testABC", "test1🙏HelloC", ":clear", ":exit"]);
    });
});
