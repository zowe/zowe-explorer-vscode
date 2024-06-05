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

import { Then, When } from "@cucumber/cucumber";

//
// Scenario: User can locate Zowe Explorer settings
//
When("a user navigates to VS Code Settings", async function () {
    const wb = await browser.getWorkbench();
    this.settingsEditor = await wb.openSettings();
    await this.settingsEditor.wait();
});
Then("the user can access the Zowe Explorer settings section", async function () {
    const zeSettings = this.settingsEditor.findSetting("Secure Credentials Enabled", "Zowe", "Security");
    await expect(zeSettings).toBeDefined();
});
