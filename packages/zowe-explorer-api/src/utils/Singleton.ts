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

export abstract class Singleton {
    private static instances: Map<any, any> = new Map();

    protected constructor() {}
    public static getInstance<T extends Singleton>(this: new () => T): T {
        if (!Singleton.instances.has(this)) {
            Singleton.instances.set(this, new this());
        }
        return Singleton.instances.get(this) as T;
    }
}
