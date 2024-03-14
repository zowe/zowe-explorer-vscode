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
