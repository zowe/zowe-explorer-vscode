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

export interface ITestContext {
    context: { subscriptions: any[] } | any;
    value: any;
    _: any;
}

export interface IJestMock {
    spy: jest.SpyInstance;
    arg: any[];
    ret?: any;
}
export interface IJestIt {
    name: string;
    mock: IJestMock[];
    parm?: any[];
    title?: string;
}

export function spyOnSubscriptions(subscriptions: any[]) {
    subscriptions.forEach((sub) => {
        sub.mock.forEach((mock) => {
            mock.spy.mockClear().mockImplementation(mock.ret ? jest.fn((_) => mock.ret) : jest.fn());
        });
    });
}

export function processSubscriptions(subscriptions: IJestIt[], test: ITestContext) {
    subscriptions.forEach((sub, index) => {
        it(sub.title ?? `Test: ${sub.name}`, async () => {
            const parms = sub.parm ?? [test.value];
            await test.context.subscriptions[index][sub.name](...parms);
            sub.mock.forEach((mock) => {
                expect(mock.spy).toHaveBeenCalledWith(...mock.arg);
            });
        });
    });
}
