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

import "./setup"; // installs vscode mock before any other imports
import { PassThrough } from "node:stream";
import { beforeAll, bench, describe } from "vitest";
import { RANDOM_STR, setupTargets, targets, USS_DIR } from "./setup";

beforeAll(() => setupTargets(), 60000);

describe("USS", () => {
    describe("List directory", () => {
        for (const target of targets) {
            bench(
                target.name,
                async () => {
                    await target.uss.fileList(USS_DIR);
                },
                { iterations: 1, throws: true }
            );
        }
    });

    describe("List directory with attributes", () => {
        for (const target of targets) {
            bench(
                target.name,
                async () => {
                    await target.uss.fileList(USS_DIR, { attributes: true });
                },
                { iterations: 1, throws: true }
            );
        }
    });

    describe("Read/write file", () => {
        for (const target of targets) {
            bench(
                target.name,
                async () => {
                    const ussFile = `${USS_DIR}/bench-${RANDOM_STR}.txt`;
                    await target.uss.create(ussFile, "file");
                    try {
                        await target.uss.uploadFromBuffer(Buffer.from("HELLO BENCH"), ussFile);
                        await target.uss.getContents(ussFile, { stream: new PassThrough() });
                    } finally {
                        await target.uss.delete(ussFile);
                    }
                },
                { iterations: 1, throws: true }
            );
        }
    });
});
