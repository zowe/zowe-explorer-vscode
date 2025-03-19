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

export function createTeamConfigMock(): imperative.IConfig {
    return {
        $schema: "./zowe.schema.json",
        profiles: {
            zosmf: {
                type: "zosmf",
                properties: {
                    port: 443,
                },
                secure: [],
            },
            tso: {
                type: "tso",
                properties: {
                    account: "",
                    codePage: "1047",
                    logonProcedure: "IZUFPROC",
                },
                secure: [],
            },
            ssh: {
                type: "ssh",
                properties: {
                    port: 22,
                },
                secure: [],
            },
            base: {
                type: "base",
                properties: {
                    host: "sample.com",
                    rejectUnauthorized: true,
                },
                secure: ["user", "password"],
            },
        },
        defaults: {
            zosmf: "zosmf",
            tso: "tso",
            ssh: "ssh",
            base: "base",
        },
        autoStore: true,
    };
}
