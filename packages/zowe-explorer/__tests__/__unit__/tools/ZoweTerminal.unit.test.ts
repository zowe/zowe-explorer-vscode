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

        await iTerm.handleInput("test");
        await iTerm.handleInput(ZoweTerminal.Keys.ENTER);
        expect(spyCb).toHaveBeenCalledWith("test");
        expect((iTerm as any).mHistory as string[]).toContain("test");
        spyCb.mockClear();

        await iTerm.handleInput(ZoweTerminal.Keys.UP);
        await iTerm.handleInput("002");
        await iTerm.handleInput(ZoweTerminal.Keys.ENTER);
        expect((iTerm as any).mHistory as string[]).toContain("test002");
        spyCb.mockClear();

        await iTerm.handleInput(ZoweTerminal.Keys.UP);
        await iTerm.handleInput(ZoweTerminal.Keys.UP);
        await iTerm.handleInput(ZoweTerminal.Keys.DOWN);
        await iTerm.handleInput(ZoweTerminal.Keys.LEFT);
        await iTerm.handleInput(ZoweTerminal.Keys.LEFT);
        await iTerm.handleInput(ZoweTerminal.Keys.BACKSPACE);
        await iTerm.handleInput(ZoweTerminal.Keys.RIGHT);
        await iTerm.handleInput(ZoweTerminal.Keys.BACKSPACE);
        await iTerm.handleInput("1A");
        await iTerm.handleInput(ZoweTerminal.Keys.BACKSPACE);
        await iTerm.handleInput(ZoweTerminal.Keys.ENTER);
        expect(spyCb).toHaveBeenCalledWith("test12");
        spyCb.mockClear();

        (iTerm as any).command = "";
        await iTerm.handleInput(ZoweTerminal.Keys.ENTER);
        await iTerm.handleInput(ZoweTerminal.Keys.CTRL_C);
        await iTerm.handleInput(":clear");
        await iTerm.handleInput(ZoweTerminal.Keys.ENTER);
        await iTerm.handleInput(":exit");
        await iTerm.handleInput(ZoweTerminal.Keys.ENTER);

        expect((iTerm as any).mHistory as string[]).toEqual(["old", "test", "test002", "test12", ":clear", ":exit"]);
    });
});
