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

/* Status of the deferred promise */
export type DeferredPromiseStatus = "pending" | "fulfilled" | "rejected";

/**
 * @brief Externally control the resolution and rejection of a promise.
 *
 * @details
 * Creates a promise with accessible `resolve` and `reject` methods, enabling external entities to
 * settle the promise based on custom logic or asynchronous events. This is particularly useful when
 * the promise's outcome depends on factors outside the immediate context.
 */
export class DeferredPromise<T> {
    private mStatus: DeferredPromiseStatus = "pending";

    public promise: Promise<T>;
    public resolve: (value: T | PromiseLike<T>) => void;
    public reject: (reason?: any) => void;

    public constructor() {
        this.promise = new Promise<T>((resolve, reject) => {
            this.resolve = (value) => {
                this.mStatus = "fulfilled";
                resolve(value);
            };
            this.reject = (err) => {
                this.mStatus = "rejected";
                reject(err);
            };
        });
    }

    /**
     * @returns {PromiseStatus} The status of the deferred promise
     */
    public get status(): DeferredPromiseStatus {
        return this.mStatus;
    }
}
