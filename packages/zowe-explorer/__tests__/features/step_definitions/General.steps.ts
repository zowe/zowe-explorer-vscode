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

When("a user locates the Zowe Explorer icon in the side bar", async () => {
    (await browser.getWorkbench()).getSideBar();
    expect($('.action-item > a[aria-label="Zowe Explorer"]')).toExist();
});

Then("the user can click on the Zowe Explorer icon", () => {
    $('.action-item > a[aria-label="Zowe Explorer"]').click();
});
