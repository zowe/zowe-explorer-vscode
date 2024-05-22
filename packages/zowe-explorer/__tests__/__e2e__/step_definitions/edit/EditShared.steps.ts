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

Then("the user should be able to save it successfully", async function () {
    await this.editorForFile.save();
    await browser.waitUntil(async () => !(await this.editorForFile.isDirty()));
});
