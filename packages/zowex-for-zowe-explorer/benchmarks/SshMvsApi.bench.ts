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
import { CreateDataSetTypeEnum, CreateDefaults } from "@zowe/zos-files-for-zowe-sdk";
import { beforeAll, bench, describe } from "vitest";
import { PREFIX, RANDOM_STR, setupTargets, targets } from "./setup";

beforeAll(() => setupTargets(), 60000);

describe("Data Sets", () => {
    describe("List data sets", () => {
        for (const target of targets) {
            bench(
                target.name,
                async () => {
                    await target.mvs.dataSet("SYS1.*");
                },
                { iterations: 1, throws: true },
            );
        }
    });

    describe("List data sets with attributes", () => {
        for (const target of targets) {
            bench(
                target.name,
                async () => {
                    await target.mvs.dataSet("SYS1.*", { attributes: true });
                },
                { iterations: 1, throws: true },
            );
        }
    });

    describe("List PDS members", () => {
        for (const target of targets) {
            bench(
                target.name,
                async () => {
                    await target.mvs.allMembers("SYS1.MACLIB");
                },
                { iterations: 1, throws: true },
            );
        }
    });

    describe("List PDS members with attributes", () => {
        for (const target of targets) {
            bench(
                target.name,
                async () => {
                    await target.mvs.allMembers("SYS1.MACLIB", { attributes: true });
                },
                { iterations: 1, throws: true },
            );
        }
    });

    describe("Read/write PDS member", () => {
        for (const target of targets) {
            bench(
                target.name,
                async () => {
                    const dsName = `${PREFIX}.BP${RANDOM_STR}`;
                    await target.mvs.createDataSet(
                        CreateDataSetTypeEnum.DATA_SET_PARTITIONED,
                        dsName,
                        CreateDefaults.DATA_SET.PARTITIONED,
                    );
                    try {
                        await target.mvs.uploadFromBuffer(Buffer.from("HELLO BENCH"), `${dsName}(MEMBER1)`);
                        await target.mvs.getContents(`${dsName}(MEMBER1)`, { stream: new PassThrough() });
                    } finally {
                        await target.mvs.deleteDataSet(dsName);
                    }
                },
                { iterations: 1, throws: true },
            );
        }
    });

    describe("Read/write sequential data set", () => {
        for (const target of targets) {
            bench(
                target.name,
                async () => {
                    const dsName = `${PREFIX}.BS${RANDOM_STR}`;
                    await target.mvs.createDataSet(
                        CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL,
                        dsName,
                        CreateDefaults.DATA_SET.SEQUENTIAL,
                    );
                    try {
                        await target.mvs.uploadFromBuffer(Buffer.from("HELLO BENCH"), dsName);
                        await target.mvs.getContents(dsName, { stream: new PassThrough() });
                    } finally {
                        await target.mvs.deleteDataSet(dsName);
                    }
                },
                { iterations: 1, throws: true },
            );
        }
    });
});
