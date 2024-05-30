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

import { ViewContent, ViewControl, ViewSection } from "wdio-vscode-service";

/* Helper functions */

export async function getZoweExplorerContainer(): Promise<ViewControl> {
    const activityBar = (await browser.getWorkbench()).getActivityBar();
    const zeContainer = await activityBar.getViewControl("Zowe Explorer");
    await expect(zeContainer).toBeDefined();

    return zeContainer;
}

export async function paneDivForTree(tree: string): Promise<ViewSection> {
    const zeContainer = await getZoweExplorerContainer();
    // specifying type here as eslint fails to deduce return type
    const sidebarContent: ViewContent = (await zeContainer.openView()).getContent();
    switch (tree.toLowerCase()) {
        case "data sets":
            return sidebarContent.getSection("DATA SETS");
        case "uss":
        case "unix system services (uss)":
            return sidebarContent.getSection("UNIX SYSTEM SERVICES (USS)");
        case "jobs":
        default:
            return sidebarContent.getSection("JOBS");
    }
}
