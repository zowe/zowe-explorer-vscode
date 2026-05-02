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

import { MockInstance, vi } from "vitest";

export interface ITestContext {
    context: { subscriptions: any[] } | any;
    value: any;
    _: any;
    [key: string]: any;
}

export interface IJestMock {
    spy: MockInstance;
    arg: any[];
    ret?: any;
}
export interface IJestIt {
    name: string;
    mock: IJestMock[];
    parm?: any[];
    title?: string;
}

function spyOnSubscription(sub: IJestIt): void {
    const spyMap = new Map<MockInstance, IJestMock[]>();

    sub.mock.forEach((mock) => {
        if (!spyMap.has(mock.spy)) {
            spyMap.set(mock.spy, []);
        }
        spyMap.get(mock.spy)!.push(mock);
    });

    spyMap.forEach((mocks, spy) => {
        spy.mockClear();
        mocks.forEach((mock) => {
            if (mock.ret != null) {
                spy.mockReturnValueOnce(mock.ret);
            } else {
                spy.mockImplementationOnce(vi.fn());
            }
        });
    });
}

export function processSubscriptions(subscriptions: IJestIt[], test: ITestContext): void {
    const getName = (str: string): string => {
        return str.indexOf(":") >= 0 ? str.substring(0, str.indexOf(":")) : str;
    };
    subscriptions.forEach((sub) => {
        it(sub.title ?? `Test: ${sub.name}`, async () => {
            spyOnSubscription(sub);
            const parms = sub.parm ?? [test.value];
            await test.context.subscriptions
                .filter(Boolean)
                .find((s) => Object.keys(s)[0] === getName(sub.name))
                ?.[getName(sub.name)](...parms);
            sub.mock.forEach((mock) => {
                expect(mock.spy).toHaveBeenCalledWith(...mock.arg);
            });
        });
    });
}
