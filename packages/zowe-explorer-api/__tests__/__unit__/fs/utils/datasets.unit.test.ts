import { DsEntry, MemberEntry, PdsEntry, isDsEntry, isMemberEntry, isPdsEntry } from "../../../../src";

describe("isDsEntry", () => {
    it("returns true if value is a DsEntry", () => {
        const entry = new DsEntry("TEST.DS");
        expect(isDsEntry(entry)).toBe(true);
    });

    it("returns false if value is not a DsEntry", () => {
        const pds = new PdsEntry("TEST.PDS");
        expect(isDsEntry(pds)).toBe(false);
    });
});

describe("isMemberEntry", () => {
    it("returns true if value is a MemberEntry", () => {
        const entry = new MemberEntry("TESTMEMB");
        expect(isMemberEntry(entry)).toBe(true);
    });

    it("returns false if value is not a MemberEntry", () => {
        const pds = new PdsEntry("TEST.PDS");
        expect(isMemberEntry(pds)).toBe(false);
    });
});

describe("isPdsEntry", () => {
    it("returns true if value is a PdsEntry", () => {
        const spoolEntry = new PdsEntry("TESTJOB.TEST.SPOOL.JES");
        expect(isPdsEntry(spoolEntry)).toBe(true);
    });

    it("returns false if value is not a PdsEntry", () => {
        const ds = new DsEntry("TEST.DS");
        expect(isPdsEntry(ds)).toBe(false);
    });
});
