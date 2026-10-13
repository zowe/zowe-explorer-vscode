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

import { applyProfilePanelWidth } from "../../../../src/webviews/src/config-editor/utils/panelWidths";

describe("panelWidths", () => {
    it.each([
        [100, 700, "200px"],
        [350, 700, "350px"],
        [900, 700, "700px"],
    ])("constrains %s to the caller's width policy", (desiredWidth, maxWidth, expectedWidth) => {
        const profiles = { style: { width: "", flex: "", maxWidth: "" } };
        const details = { style: { width: "300px", flex: "0", maxWidth: "300px" } };
        const panel = { querySelector: (selector: string) => (selector === ".profiles-section" ? profiles : details) } as unknown as HTMLElement;
        applyProfilePanelWidth(panel, desiredWidth as number, maxWidth as number);
        expect(profiles.style).toEqual({ width: expectedWidth, flex: "0 0 auto", maxWidth: `${maxWidth}px` });
        expect(details.style).toEqual({ width: "", flex: "1", maxWidth: "" });
    });
    it("does not resize when the details section has not mounted", () => {
        const profiles = { style: { width: "350px" } };
        const panel = { querySelector: (selector: string) => (selector === ".profiles-section" ? profiles : null) } as unknown as HTMLElement;
        applyProfilePanelWidth(panel, 500, 700);
        expect(profiles.style.width).toBe("350px");
    });
});
