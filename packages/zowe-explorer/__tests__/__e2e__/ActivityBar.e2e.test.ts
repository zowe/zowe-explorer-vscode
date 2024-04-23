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

import { describe, it } from "node:test";
import { assert, browser } from "nightwatch";

describe("Activity Bar tests", () => {
    it("can click on the Zowe Explorer icon in the Activity Bar", () => {
        const zeIcon = browser.element.find('.action-item > a[aria-label="Zowe Explorer"]');
        assert.notEqual(zeIcon, undefined);
        zeIcon.click();
    });
});
