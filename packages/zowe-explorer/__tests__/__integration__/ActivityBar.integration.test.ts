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

import { assert } from "chai";
import { ActivityBar } from "vscode-extension-tester";

describe("Activity Bar interaction tests", () => {
    let activityBar: ActivityBar;

    before(() => {
        activityBar = new ActivityBar();
    });

    it("Can select the Zowe Explorer extension in the side bar", async () => {
        const zoweExplorer = await activityBar.getViewControl("Zowe Explorer");
        assert(zoweExplorer != null);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        await zoweExplorer!.click();
    });
});
