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
// Scenario: User can open Release Notes webview
//
When(/a user runs (.*) command/, async function (cmdName: string) {
    const wb = await browser.getWorkbench();
    await wb.executeCommand(`Zowe Explorer: ${cmdName}`);
});
Then(/the (.*) webview is displayed/, async function (title: string) {
    const wb = await browser.getWorkbench();
    await browser.waitUntil(async () => (await wb.getWebviewByTitle(title)) != null);
});
