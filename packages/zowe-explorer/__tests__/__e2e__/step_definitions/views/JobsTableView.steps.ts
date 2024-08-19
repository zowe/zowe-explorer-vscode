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

import { Then } from "@cucumber/cucumber";
import { ContextMenu } from "wdio-vscode-service";

Then('the user can right-click on the jobs profile and select "Show as Table"', async function () {
    const ctxMenu: ContextMenu = await this.profileNode.openContextMenu();
    await ctxMenu.wait();
    const showAsTableItem = await ctxMenu.getItem("Show as Table");
    await (await showAsTableItem.elem).click();
    const bottomBar = (await browser.getWorkbench()).getBottomBar();
    await bottomBar.toggle(true);
    await (bottomBar as any).openTab("Zowe Resources");
    await (await $("#webviewRoot > div")).waitForExist();
});
