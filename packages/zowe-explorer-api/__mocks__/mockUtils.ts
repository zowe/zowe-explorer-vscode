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
    #key: PropertyKey;
    #val: any;
    #valType: MockedValueType;
    #objRef: any;
    #originalDescriptor?: PropertyDescriptor;

    private initValueType() {
        if (typeof this.#val === "function" || jest.isMockFunction(this.#val)) {
            this.#valType = MockedValueType.Function;
        } else if (typeof this.#val === "object" || Array.isArray(this.#val)) {
            this.#valType = MockedValueType.Ref;
        } else {
            this.#valType = MockedValueType.Primitive;
        }
    }

    constructor(object: any, key: PropertyKey, descriptor?: PropertyDescriptor, value?: any) {
        if (object == null) {
            throw new Error("Null or undefined object passed to MockedProperty");
        }
        this.#objRef = object;
        this.#originalDescriptor = descriptor ?? Object.getOwnPropertyDescriptor(object, key);

        if (!value) {
            this.#val = jest.fn();
            this.#valType = MockedValueType.Function;
            Object.defineProperty(object, key, {
                value: this.#val,
                configurable: true,
            });
            return;
        }

        const isValFn = typeof value === "function";

        if (isValFn || (typeof descriptor?.value === "function" && value == null)) {
            // wrap provided function around a Jest function, if needed
            this.#val = jest.isMockFunction(value) ? value : jest.fn().mockImplementation(value);
        } else {
            this.#val = value;
        }

        this.initValueType();

        Object.defineProperty(object, key, {
            value: this.#val,
            configurable: true,
        });
    }

    [Symbol.dispose](): void {
        const isObjValid = this.#objRef != null;
        if (isObjValid && !this.#originalDescriptor) {
            // didn't exist to begin with, just delete it
            delete this.#objRef[this.#key];
            return;
        }

        if (this.#valType === MockedValueType.Function && jest.isMockFunction(this.#val)) {
            this.#val.mockRestore();
        }

        if (isObjValid) {
            Object.defineProperty(this.#objRef, this.#key, this.#originalDescriptor!);
        }
    }

    public get mock() {
        if (!jest.isMockFunction(this.#val)) {
            throw Error("MockedValue.mock called, but mocked value is not a Jest function");
        }

        return this.#val;
    }

    public get value() {
        return this.#val;
    }

    public valueAs<T>() {
        return this.#val as T;
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
