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

/**
 * This decorator can be applied to a class within a __mocks__ folder so that
 * a typescript class can be more easily mocked.
 *
 * @example <caption>Class in __mocks__<caption>
 * export class TestClass {
 *   // This method will be wrapped in a jest.fn() call with the implementation
 *   // being the contents of the below function.
 *   @MockMethod()
 *   public test() {
 *     return "string";
 *   }
 * }
 *
 * // In some other file
 * const myClass = new TestClass();
 * console.log(myClass.test()); // Prints "string" to the console
 * expect(myClass.test).toHaveBeenCalledTimes(2);
 * // Fails with message
 * // Expected mock function to have been called two times, but it was called one time
 */
export function MockMethod(): (target: any, key: string, descriptor: PropertyDescriptor) => PropertyDescriptor {
    return (target: any, key: string, descriptor: PropertyDescriptor) => {
        if (descriptor === undefined) {
            descriptor = Object.getOwnPropertyDescriptor(target, key);
        }

        const originalMethod = descriptor.value;

        descriptor.value = jest.fn((...args) => {
            originalMethod.apply(this, args);
        });

        return descriptor;
    };
}
