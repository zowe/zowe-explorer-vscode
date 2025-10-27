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
import { Workbench } from "wdio-vscode-service";

Then("a user can view the Edit History panel", async function () {
    this.workbench = await browser.getWorkbench();
    this.editHistoryView = (await (this.workbench as Workbench).getAllWebviews())[0];
    await this.editHistoryView.wait();
    await this.editHistoryView.open();
});

Then("navigate to the various Edit History tabs", async function () {
    for (const panel of ["uss", "jobs", "cmds", "ds"]) {
        const elemId = `vscode-panel-tab#${panel}-panel-tab`;
        const elem = await $(elemId);
        await elem.waitForClickable();
        await elem.click();
        await browser.pause(1000);
    }
});
