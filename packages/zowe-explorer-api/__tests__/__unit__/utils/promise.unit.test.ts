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

import { createDeferredPromise, DeferredPromise } from "../../../src/utils/promise";

const isDeferredPromise = (obj: any): obj is DeferredPromise => {
    return "reject" in obj && "resolve" in obj && "promise" in obj;
};

describe("utils/promise.ts - Unit tests", () => {
    describe("createDeferredPromise", () => {
        it("creates a new promise object", () => {
            const deferredPromise = createDeferredPromise();
            expect(deferredPromise.promise).toBeDefined();
            expect(isDeferredPromise(deferredPromise)).toBe(true);
        });
    });
});
