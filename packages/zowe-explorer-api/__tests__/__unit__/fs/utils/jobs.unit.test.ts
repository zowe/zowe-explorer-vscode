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

import { DirEntry, FileEntry, JobEntry, SpoolEntry, FsJobsUtils } from "../../../../src";

describe("isJobEntry", () => {
    it("returns true if value is a JobEntry", () => {
        const jobEntry = new JobEntry("TESTJOB(JOB1234)");
        expect(FsJobsUtils.isJobEntry(jobEntry)).toBe(true);
    });

    it("returns false if value is not a JobEntry", () => {
        const file = new FileEntry("test");
        expect(FsJobsUtils.isJobEntry(file)).toBe(false);
    });
});

describe("isSpoolEntry", () => {
    it("returns true if value is a SpoolEntry", () => {
        const spoolEntry = new SpoolEntry("TESTJOB.TEST.SPOOL.JES");
        expect(FsJobsUtils.isSpoolEntry(spoolEntry)).toBe(true);
    });

    it("returns false if value is not a SpoolEntry", () => {
        const folder = new DirEntry("test");
        expect(FsJobsUtils.isSpoolEntry(folder)).toBe(false);
    });
});
