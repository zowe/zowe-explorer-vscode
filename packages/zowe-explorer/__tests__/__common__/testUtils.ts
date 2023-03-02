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

export interface ITestContext {
    context: { subscriptions: any[] } | any;
    value: any;
    _: any;
    [key: string]: any;
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
            if (mock.ret) {
                mock.spy.mockClear().mockReturnValueOnce(mock.ret);
            } else {
                mock.spy.mockClear().mockImplementation(jest.fn());
            }
        });
    });
}

export function processSubscriptions(subscriptions: IJestIt[], test: ITestContext) {
    const getName = (str: string) => {
        return str.indexOf(":") >= 0 ? str.substring(0, str.indexOf(":")) : str;
    };
    subscriptions.forEach((sub) => {
        it(sub.title ?? `Test: ${sub.name}`, async () => {
            const parms = sub.parm ?? [test.value];
            await test.context.subscriptions.find((s) => Object.keys(s)[0] === getName(sub.name))?.[getName(sub.name)](...parms);
            sub.mock.forEach((mock) => {
                expect(mock.spy).toHaveBeenCalledWith(...mock.arg);
            });
        });
    });
}
