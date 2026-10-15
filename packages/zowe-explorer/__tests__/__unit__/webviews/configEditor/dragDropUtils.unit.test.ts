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

import { vi } from "vitest";
import { suppressClickAfterDrag } from "../../../../src/webviews/src/config-editor/utils/dragDropUtils";

describe("suppressClickAfterDrag", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("blocks the release click before it reaches a row or background selection handler", () => {
        const target = new EventTarget();
        const listen = vi.spyOn(target, "addEventListener");
        const click = new Event("click", { bubbles: true, cancelable: true });
        const stop = vi.spyOn(click, "stopPropagation");

        suppressClickAfterDrag(target);
        expect(listen).toHaveBeenCalledWith("click", expect.any(Function), { capture: true, once: true });
        expect(target.dispatchEvent(click)).toBe(false);
        expect(click.defaultPrevented).toBe(true);
        expect(stop).toHaveBeenCalledOnce();

        const nextClick = new Event("click", { cancelable: true });
        expect(target.dispatchEvent(nextClick)).toBe(true);
        expect(nextClick.defaultPrevented).toBe(false);
    });

    it("allows the next deliberate click when the drag emitted no release click", () => {
        const target = new EventTarget();
        suppressClickAfterDrag(target);
        vi.runOnlyPendingTimers();

        const click = new Event("click", { cancelable: true });
        const stop = vi.spyOn(click, "stopPropagation");
        expect(target.dispatchEvent(click)).toBe(true);
        expect(click.defaultPrevented).toBe(false);
        expect(stop).not.toHaveBeenCalled();
    });
});
