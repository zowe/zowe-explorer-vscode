import { DirEntry, FileEntry, JobEntry, SpoolEntry, isJobEntry, isSpoolEntry } from "../../../../src";

describe("isJobEntry", () => {
    it("returns true if value is a JobEntry", () => {
        const jobEntry = new JobEntry("TESTJOB(JOB1234)");
        expect(isJobEntry(jobEntry)).toBe(true);
    });

    it("returns false if value is not a JobEntry", () => {
        const file = new FileEntry("test");
        expect(isJobEntry(file)).toBe(false);
    });
});

describe("isSpoolEntry", () => {
    it("returns true if value is a SpoolEntry", () => {
        const spoolEntry = new SpoolEntry("TESTJOB.TEST.SPOOL.JES");
        expect(isSpoolEntry(spoolEntry)).toBe(true);
    });

    it("returns false if value is not a SpoolEntry", () => {
        const folder = new DirEntry("test");
        expect(isSpoolEntry(folder)).toBe(false);
    });
});
