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

import { JobEntry, SpoolEntry } from "../../../../src";

describe("JobEntry", () => {
    it("calls DirEntry constructor on initialization", () => {
        const entry = new JobEntry("TESTJOB(JOB1234)");
        expect(entry.name).toBe("TESTJOB(JOB1234)");
    });
});

describe("SpoolEntry", () => {
    it("calls DirEntry constructor on initialization", () => {
        const entry = new SpoolEntry("SPOOL.JES2.NAME.TEST");
        expect(entry.name).toBe("SPOOL.JES2.NAME.TEST");
    });
});
