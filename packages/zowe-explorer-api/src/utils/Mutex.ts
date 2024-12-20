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

import { DeferredPromise } from "./DeferredPromise";

/**
 * @brief
 * A class for managing mutual exclusion in asynchronous operations,
 * ensuring that only one asynchronous function can access a critical section at a time.
 *
 * @details
 * The lock state of the mutex is determined by the presence of a pending promise in the `mDeferred` property (deferred promise).
 * If the lock is available, `mDeferred` is `null`.
 */
export class Mutex {
    private mDeferred: DeferredPromise<void> | null = null;

    /**
     * Attempt to lock the mutex if possible.
     * @returns Whether the mutex was successfully locked
     */
    public tryLock(): boolean {
        if (this.mDeferred === null) {
            this.mDeferred = new DeferredPromise<void>();
            return true;
        }

        return false;
    }

    /**
     * Waits for the mutex to be available and immediately locks it thereafter.
     */
    public async lock(): Promise<void> {
        while (this.mDeferred !== null) {
            await this.mDeferred.promise;
        }
        this.mDeferred = new DeferredPromise<void>();
    }

    /**
     * Unlocks the mutex, resolving or rejecting the promise depending on whether an error is provided.
     * @param error {string} An optional error message. When provided, the deferred promise is rejected - otherwise it is resolved.
     */
    public unlock(error?: string): void {
        if (this.mDeferred !== null) {
            if (error) {
                this.mDeferred.reject(error);
            } else {
                this.mDeferred.resolve();
            }
            this.mDeferred = null;
        } else {
            throw new Error("Cannot unlock a lock that hasn't been acquired.");
        }
    }

    /**
     * @returns {boolean} whether the mutex is locked
     */
    public get locked(): boolean {
        if (this.mDeferred === null) {
            return false;
        }

        return true;
    }
}
