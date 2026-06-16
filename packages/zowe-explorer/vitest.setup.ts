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

import { expect } from "vitest";

vi.mock("vscode", () => import("./__tests__/__mocks__/vscode.ts"));
vi.mock("fs", () => import("./__tests__/__mocks__/fs.ts"));
vi.mock("fs-extra", () => import("./__tests__/__mocks__/fs-extra.ts"));
vi.mock("isbinaryfile", () => import("./__tests__/__mocks__/isbinaryfile.ts"));
// Replicate Jest's automatic use of the manual mock in `__tests__/__mocks__/@zowe/imperative.ts`
// for any file that does not explicitly opt-out via `vi.unmock("@zowe/imperative")` or override.
vi.mock("@zowe/imperative", () => import("./__tests__/__mocks__/@zowe/imperative.ts"));

// Bridge several Jest behaviors that the legacy tests in this package rely on.
//
// 1. `vi.spyOn` is made idempotent. Vitest 3.x creates a new spy each time
//    `vi.spyOn` is invoked on the same target/method, but the tests captured
//    spy references at module-load time and assume Jest's behavior of
//    returning the *same* spy on subsequent calls.
// 2. `mockRestore()` is patched to restore the property to whatever was there
//    *immediately* before `vi.spyOn` was first called for that method (rather
//    than going all the way back to the absolute original implementation).
//    This preserves any `vi.mock` auto-mock that was applied beforehand,
//    matching Jest's semantics where `restoreAllMocks` does not undo
//    `jest.mock` declarations.
// 3. `vi.restoreAllMocks()` is patched to only restore mocks created via
//    `vi.spyOn`, matching Jest's documented behavior. Vitest's default also
//    resets stand-alone `vi.fn()` mocks (clobbering any `mockReturnValue`).
const __originalSpyOn = vi.spyOn.bind(vi);
const __originalRestoreAllMocks = vi.restoreAllMocks.bind(vi);
const __spyRegistry = new WeakMap<object, Map<PropertyKey, any>>();
const __spyPrevValues = new WeakMap<any, { target: any; method: PropertyKey; prev: any }>();
const __trackedSpies = new Set<any>();
(vi as any).spyOn = function spyOn(target: any, method: any, accessType?: any): any {
    if (target == null || (typeof target !== "object" && typeof target !== "function") || accessType !== undefined) {
        const spy = __originalSpyOn(target, method, accessType);
        __trackedSpies.add(spy);
        return spy;
    }
    let methodMap = __spyRegistry.get(target);
    if (!methodMap) {
        methodMap = new Map();
        __spyRegistry.set(target, methodMap);
    }
    const cached = methodMap.get(method);
    if (cached && target[method] === cached) {
        return cached;
    }
    const previousValue = target[method];
    const spy = __originalSpyOn(target, method);
    __trackedSpies.add(spy);
    __spyPrevValues.set(spy, { target, method, prev: previousValue });
    spy.mockRestore = function jestCompatRestore() {
        try {
            spy.mockReset();
        } catch {
            // ignore
        }
        const info = __spyPrevValues.get(spy);
        if (info) {
            try {
                Object.defineProperty(info.target, info.method, {
                    value: info.prev,
                    configurable: true,
                    writable: true,
                });
            } catch {
                try {
                    info.target[info.method] = info.prev;
                } catch {
                    // ignore
                }
            }
            const map = __spyRegistry.get(info.target);
            if (map?.get(info.method) === spy) {
                map.delete(info.method);
            }
        }
        __trackedSpies.delete(spy);
    };
    methodMap.set(method, spy);
    return spy;
};

(vi as any).restoreAllMocks = function jestCompatRestoreAllMocks() {
    for (const spy of [...__trackedSpies]) {
        try {
            spy.mockRestore();
        } catch {
            // ignore
        }
    }
    return vi;
};

// Provide a Jest-compatible `fail` global so that legacy test code that expects
// `fail(reason)` continues to work under Vitest (which does not ship one).
(globalThis as any).fail = (reason: unknown): never => {
    expect.fail(reason instanceof Error ? reason.message : String(reason));
};

process.on("unhandledRejection", (reason) => {
    (globalThis as any).fail(reason);
});
