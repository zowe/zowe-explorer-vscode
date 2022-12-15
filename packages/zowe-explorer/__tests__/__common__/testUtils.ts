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
export interface ISubscriptionTesting {
    name: string;
    mock: jest.SpyInstance[];
    args: any[][];
    returnValue?: any[];
    parm?: any[];
}

export function spyOnSubscriptions(commands: any[]) {
    commands.forEach((cmd) => {
        cmd.mock.forEach((spy, index) => {
            spy.mockImplementation(
                cmd.returnValue?.[index] ? jest.fn((_) => cmd.returnValue[index]) : jest.fn()
            );
        });
    });
}

export function processSubscriptions(commands: ISubscriptionTesting[], test: ITestContext) {
    commands.forEach((command, index) => {
        it(`Test: ${command.name}`, async () => {
            const parms = command.parm ?? [test.value];
            await test.context.subscriptions[index][command.name](...parms);
            command.mock.forEach((spy, mockIndex) => {
                expect(spy).toHaveBeenCalledWith(...command.args[mockIndex]);
            });
        });
    });
}