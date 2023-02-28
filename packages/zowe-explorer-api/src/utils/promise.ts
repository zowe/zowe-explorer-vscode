/*
 * This program and the accompanying materials are made available under the terms of the *
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at *
 * https://www.eclipse.org/legal/epl-v20.html                                      *
 *                                                                                 *
 * SPDX-License-Identifier: EPL-2.0                                                *
 *                                                                                 *
 * Copyright Contributors to the Zowe Project.                                     *
 *                                                                                 *
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RejectFn = (reason?: any) => void;
type ResolveFn = (val: unknown) => void;

export type DeferredPromise = {
    promise: Promise<unknown>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reject: RejectFn;
    resolve: ResolveFn;
};

/**
 * Create a deferred promise that can be resolved or rejected at any point.
 * @returns The promise object alongside its resolve/reject functions.
 */
export function createDeferredPromise(): DeferredPromise {
    let resolve: ResolveFn, reject: RejectFn;
    const promise = new Promise((res, rej) => {
        [resolve, reject] = [res, rej];
    });
    return { promise, reject, resolve };
}
