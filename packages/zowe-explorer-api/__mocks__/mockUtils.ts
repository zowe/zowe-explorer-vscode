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

// Used for the MockedProperty class (polyfills for Symbol.{asyncDispose, dispose})
require("disposablestack/auto");

// Idea is borrowed from: https://github.com/kulshekhar/ts-jest/blob/master/src/util/testing.ts
export const mocked = <T extends (..._args: any[]) => any>(fn: T): jest.Mock<ReturnType<T>> => fn as any;

enum MockedValueType {
    Primitive,
    Ref,
    Function,
}

/**
 *  _Please use this when possible instead of Object.defineProperty!_
 *
 * A safer approach to "mocking" the value for a property that cannot be easily mocked using Jest.\
 * Uses TypeScript 5.2's Explicit Resource Management to restore the original value for the given object and property key.
 */
export class MockedProperty {
    #mocked: jest.ReplaceProperty<any>;
    #value: any;

    constructor(object: any, key: PropertyKey, descriptor?: PropertyDescriptor, value?: any) {
        this.#value = descriptor ? descriptor?.get ?? descriptor.set ?? descriptor.value : value;
        this.#mocked = jest.replaceProperty(object, key, this.#value);
    }

    [Symbol.dispose](): void {
        this.#mocked.restore();
    }

    public get value() {
        return this.#mocked;
    }

    public valueAs<T>() {
        return this.#mocked as T;
    }
}

export function isMockedProperty(val: any): val is MockedProperty {
    return "Symbol.dispose" in val;
}

export class MockCollection {
    #obj: Record<string, MockedProperty | unknown>;

    constructor(obj: Record<string, unknown>) {
        this.#obj = obj;
    }

    [Symbol.dispose](): void {
        for (const k of Object.keys(this.#obj)) {
            const property = this.#obj[k];
            if (isMockedProperty(property)) {
                property[Symbol.dispose]();
            }
        }
    }

    public dispose() {
        this[Symbol.dispose]();
    }
}
