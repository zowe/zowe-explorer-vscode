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

import { DeferredPromise, DeferredPromiseStatus } from "../../../src";

describe("DeferredPromise constructor", () => {
    it("sets resolve and reject functions", () => {
        const deferred = new DeferredPromise();
        expect(deferred.promise).toBeInstanceOf(Promise);
        expect(deferred.reject).toBeInstanceOf(Function);
        expect(deferred.resolve).toBeInstanceOf(Function);
    });
});

describe("DeferredPromise.status", () => {
    it("returns pending when not yet resolved", () => {
        const deferred = new DeferredPromise();
        expect(deferred.status).toBe(DeferredPromiseStatus.Pending);
    });

    it("returns resolved when resolved", () => {
        const deferred = new DeferredPromise();
        deferred.resolve(null);
        expect(deferred.status).toBe(DeferredPromiseStatus.Resolved);
    });

    it("returns rejected when rejected", async () => {
        const deferred = new DeferredPromise();
        let errorCaught = false;
        setImmediate(() => deferred.reject());
        try {
            await deferred.promise;
        } catch (err) {
            errorCaught = true;
        }
        expect(deferred.status).toBe(DeferredPromiseStatus.Rejected);
        expect(errorCaught).toBe(true);
    });
});
