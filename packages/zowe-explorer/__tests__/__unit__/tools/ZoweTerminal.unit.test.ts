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
import { PersistenceSchemaEnum } from "@zowe/zowe-explorer-api";
import { ZoweTerminal } from "../../../src/tools/ZoweTerminal";

describe("ZoweTerminal Unit Tests", () => {

  it("should not change the keys", () => {
    expect(ZoweTerminal.Keys).toMatchSnapshot();
  });

  it ("should send the entered command to the callback function", () => {
    const spyCb = jest.fn().mockResolvedValue("testOutput");
    const iTerm = new ZoweTerminal("test", spyCb, {history: ["old"]});
    iTerm.open();

    iTerm.handleInput("test");
    iTerm.handleInput(ZoweTerminal.Keys.ENTER);
    expect(spyCb).toHaveBeenCalledWith("test");
    expect((iTerm as any).mHistory as string[]).toContain("old");
    // expect((iTerm as any).mHistory as string[]).toContain("test");
    spyCb.mockClear();

    iTerm.handleInput(ZoweTerminal.Keys.UP);
    iTerm.handleInput("002");
    iTerm.handleInput(ZoweTerminal.Keys.ENTER);
    expect(spyCb).toHaveBeenCalledWith("old002");
    // expect((iTerm as any).mHistory as string[]).toContain("old002");
    spyCb.mockClear();

    iTerm.handleInput(ZoweTerminal.Keys.UP);
    iTerm.handleInput(ZoweTerminal.Keys.DOWN);
    iTerm.handleInput(ZoweTerminal.Keys.LEFT);
    iTerm.handleInput(ZoweTerminal.Keys.LEFT);
    iTerm.handleInput(ZoweTerminal.Keys.BACKSPACE);
    iTerm.handleInput(ZoweTerminal.Keys.RIGHT);
    iTerm.handleInput(ZoweTerminal.Keys.BACKSPACE);
    iTerm.handleInput("11");
    iTerm.handleInput(ZoweTerminal.Keys.ENTER);
    expect(spyCb).toHaveBeenCalledWith("11");
    spyCb.mockClear();

    iTerm.handleInput(ZoweTerminal.Keys.CTRL_C);
  });
});
