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

export function createConfigInstance() {
    return {
        load: jest.fn(),
    } as any;
}

export function createConfigLoad() {
    return {
        configName: "zowe.config.json",
        api: {
            layers: {
                merge: jest.fn(),
                activate: jest.fn(),
            },
        },
        layers: [
            {
                path: "file://globalPath/.zowe/zowe.config.json",
                exists: true,
                properties: undefined,
                global: true,
                user: false,
            },
            {
                path: "file://projectPath/zowe.config.user.json",
                exists: true,
                properties: undefined,
                global: false,
                user: true,
            },
        ],
        setSchema: jest.fn(),
        save: jest.fn(),
    } as any;
}
