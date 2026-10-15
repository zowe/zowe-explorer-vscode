/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 * SPDX-License-Identifier: EPL-2.0
 * Copyright Contributors to the Zowe Project.
 */

/** Block the click emitted after mouseup, including clicks on a drag's common ancestor. */
export function suppressClickAfterDrag(target: EventTarget = document): void {
    const suppressClick = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
    };
    target.addEventListener("click", suppressClick, { capture: true, once: true });
    // Some drags emit no click. Expire the guard so the next deliberate click still works.
    setTimeout(() => target.removeEventListener("click", suppressClick, { capture: true }), 0);
}
