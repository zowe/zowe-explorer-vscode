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
import { beforeAll, bench, describe } from "vitest";
import { DUMMY_JCL, setupTargets, targets } from "./setup";

beforeAll(() => setupTargets(), 60000);

describe("Jobs", () => {
    describe("List jobs", () => {
        for (const target of targets) {
            bench(
                target.name,
                async () => {
                    await target.jes.getJobsByParameters({});
                },
                { iterations: 1, throws: true },
            );
        }
    });

    describe("Submit + get job status", () => {
        for (const target of targets) {
            bench(
                target.name,
                async () => {
                    const job = await target.jes.submitJcl(DUMMY_JCL);
                    try {
                        await target.jes.getJob(job.jobid);
                    } finally {
                        await target.jes.deleteJob(job.jobname, job.jobid);
                    }
                },
                { iterations: 1, throws: true },
            );
        }
    });

    describe("Submit + list spool + read first spool", () => {
        for (const target of targets) {
            bench(
                target.name,
                async () => {
                    const job = await target.jes.submitJcl(DUMMY_JCL);
                    try {
                        const spoolFiles = await target.jes.getSpoolFiles(job.jobname, job.jobid);
                        await target.jes.getSpoolContentById(job.jobname, job.jobid, spoolFiles[0].id);
                    } finally {
                        await target.jes.deleteJob(job.jobname, job.jobid);
                    }
                },
                { iterations: 1, throws: true },
            );
        }
    });
});
