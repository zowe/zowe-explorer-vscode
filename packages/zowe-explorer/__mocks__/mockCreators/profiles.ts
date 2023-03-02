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

import { imperative } from "@zowe/cli";

export function createTestSchemas() {
    const schema1: {} = {
        host: { type: "string", optionDefinition: { description: "description" } },
        port: { type: "number", optionDefinition: { description: "description", defaultValue: 443 } },
        user: { type: "string", secure: true, optionDefinition: { description: "description" } },
        password: { type: "string", secure: true, optionDefinition: { description: "description" } },
        rejectUnauthorized: { type: "boolean", optionDefinition: { description: "description" } },
        basePath: { type: "string", optionDefinition: { description: "description" } },
    };
    const schema2: {} = {
        host: { type: "string", optionDefinition: { description: "description" } },
        port: { type: "number", optionDefinition: { description: "description", defaultValue: 123 } },
        user: { type: "string", secure: true, optionDefinition: { description: "description" } },
        password: { type: "string", secure: true, optionDefinition: { description: "description" } },
        basePath: { type: "string", optionDefinition: { description: "description" } },
        aBoolean: { type: ["boolean", "null"], optionDefinition: { description: "description" } },
        aNumber: { type: "number", optionDefinition: { description: "description", defaultValue: 123 } },
    };
    const schema3: {} = {
        host: { type: "string", optionDefinition: { description: "description" } },
        port: { type: "number", optionDefinition: { description: "description" } },
        aNumber: { type: ["number", "null"], optionDefinition: { description: "description" } },
        aOther: { type: ["string", "null"], optionDefinition: { description: "description" } },
    };
    const schema4 = {
        host: {
            type: "string",
            optionDefinition: {
                name: "host",
                aliases: ["H"],
                description: "The z/OSMF server host name.",
                type: "string",
                required: true,
                group: "Zosmf Connection Options",
            },
        },
        port: {
            type: "number",
            optionDefinition: {
                name: "port",
                aliases: ["P"],
                description: "The z/OSMF server port.",
                type: "number",
                defaultValue: 443,
                group: "Zosmf Connection Options",
            },
        },
        user: {
            type: "string",
            secure: true,
            optionDefinition: {
                name: "user",
                aliases: ["u"],
                description: "Mainframe (z/OSMF) user name, which can be the same as your TSO login.",
                type: "string",
                required: true,
                group: "Zosmf Connection Options",
            },
        },
        password: {
            type: "string",
            secure: true,
            optionDefinition: {
                name: "password",
                aliases: ["pass", "pw"],
                description: "Mainframe (z/OSMF) password, which can be the same as your TSO password.",
                type: "string",
                group: "Zosmf Connection Options",
                required: true,
            },
        },
        rejectUnauthorized: {
            type: "boolean",
            optionDefinition: {
                name: "reject-unauthorized",
                aliases: ["ru"],
                description: "Reject self-signed certificates.",
                type: "boolean",
                defaultValue: true,
                group: "Zosmf Connection Options",
            },
        },
        basePath: {
            type: "string",
            optionDefinition: {
                name: "base-path",
                aliases: ["bp"],
                description:
                    "The base path for your API mediation layer instance. Specify this option to prepend the base path to all z/OSMF resources when making REST requests. Do not specify this option if you are not using an API mediation layer.",
                type: "string",
                group: "Zosmf Connection Options",
            },
        },
    };
    const schema5: {} = {
        host: { type: "string", optionDefinition: { description: "description" } },
        port: { type: "number", optionDefinition: { description: "description", defaultValue: 123 } },
        user: { type: "string", secure: true, optionDefinition: { description: "description" } },
        password: { type: "string", secure: true, optionDefinition: { description: "description" } },
        basePath: { type: "string", optionDefinition: { description: "description" } },
        aBoolean: { type: ["boolean", "null"], optionDefinition: { description: "description" } },
        aNumber: { type: "number", optionDefinition: { description: "description", defaultValue: null } },
    };
    const schemaArray = [schema1, schema2, schema3, schema4, schema5];
    return schemaArray;
}

export function newTestSchemas() {
    return {
        host: { type: "string", optionDefinition: { description: "description" } },
        port: { type: "number", optionDefinition: { description: "description", defaultValue: 443 } },
        user: { type: "string", secure: true, optionDefinition: { description: "description" } },
        password: { type: "string", secure: true, optionDefinition: { description: "description" } },
        rejectUnauthorized: { type: "boolean", optionDefinition: { description: "description" } },
        tokenType: { type: "string" },
        tokenValue: { type: "string" },
    };
}

export function createProfileManager() {
    const newManager = Object.create({
        configurations: [
            {
                type: "zosmf",
                schema: {
                    type: "object",
                    title: "z/OSMF Profile",
                    description: "z/OSMF Profile",
                    properties: {
                        host: {
                            type: "string",
                            optionDefinition: {
                                name: "host",
                                aliases: ["H"],
                                description: "The z/OSMF server host name.",
                                type: "string",
                                required: true,
                                group: "Zosmf Connection Options",
                            },
                        },
                        port: {
                            type: "number",
                            optionDefinition: {
                                name: "port",
                                aliases: ["P"],
                                description: "The z/OSMF server port.",
                                type: "number",
                                defaultValue: 443,
                                group: "Zosmf Connection Options",
                            },
                        },
                        user: {
                            type: "string",
                            secure: true,
                            optionDefinition: {
                                name: "user",
                                aliases: ["u"],
                                description: "Mainframe (z/OSMF) user name, which can be the same as your TSO login.",
                                type: "string",
                                required: true,
                                group: "Zosmf Connection Options",
                            },
                        },
                        password: {
                            type: "string",
                            secure: true,
                            optionDefinition: {
                                name: "password",
                                aliases: ["pass", "pw"],
                                description: "Mainframe (z/OSMF) password, which can be the same as your TSO password.",
                                type: "string",
                                group: "Zosmf Connection Options",
                                required: true,
                            },
                        },
                        rejectUnauthorized: {
                            type: "boolean",
                            optionDefinition: {
                                name: "reject-unauthorized",
                                aliases: ["ru"],
                                description: "Reject self-signed certificates.",
                                type: "boolean",
                                defaultValue: true,
                                group: "Zosmf Connection Options",
                            },
                        },
                        basePath: {
                            type: "string",
                            optionDefinition: {
                                name: "base-path",
                                aliases: ["bp"],
                                description:
                                    "The base path for your API mediation layer instance. Specify this option to prepend the base path to all z/OSMF resources when making REST requests. Do not specify this option if you are not using an API mediation layer.",
                                type: "string",
                                group: "Zosmf Connection Options",
                            },
                        },
                    },
                    required: ["host"],
                },
                createProfileExamples: [
                    {
                        options: "zos123 --host zos123 --port 1443 --user ibmuser --password myp4ss",
                        description: "Create a zosmf profile called 'zos123' to connect to z/OSMF at host zos123 and port 1443",
                    },
                    {
                        options: "zos124 --host zos124 --user ibmuser --password myp4ss --reject-unauthorized false",
                        description:
                            "Create a zosmf profile called 'zos124' to connect to z/OSMF at the host zos124 (default port - 443) and allow self-signed certificates",
                    },
                    {
                        options:
                            "zosAPIML --host zosAPIML --port 2020 --user ibmuser --password myp4ss --reject-unauthorized false --base-path basePath",
                        description:
                            "Create a zosmf profile called 'zos124' to connect to z/OSMF at the host zos124 (default port - 443) and allow self-signed certificates",
                    },
                ],
                updateProfileExamples: [
                    {
                        options: "zos123 --user newuser --password newp4ss",
                        description: "Update a zosmf profile named 'zos123' with a new username and password",
                    },
                ],
            },
        ],
    }) as imperative.CliProfileManager;
    return newManager;
}
