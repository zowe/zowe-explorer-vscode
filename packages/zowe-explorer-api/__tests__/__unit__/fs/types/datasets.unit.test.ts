import { DsEntry, DsEntryMetadata, FileEntry, PdsEntry } from "../../../../src/";

describe("DsEntry", () => {
    it("calls the FileEntry class constructor when initialized", () => {
        const entry = new DsEntry("TEST.DS");
        expect(entry.name).toBe("TEST.DS");
    });
});

describe("PdsEntry", () => {
    it("calls the DirEntry class constructor when initialized", () => {
        const entry = new PdsEntry("TEST.PDS");
        expect(entry.name).toBe("TEST.PDS");
        expect(entry.entries).toStrictEqual(new Map());
    });
});

describe("DsEntryMetadata", () => {
    it("sets the profile and path provided in constructor", () => {
        const fakeProfile: any = { name: "testProfile" };
        const entryMeta = new DsEntryMetadata({
            profile: fakeProfile,
            path: "/TEST.DS",
        });
        expect(entryMeta.profile).toBe(fakeProfile);
        expect(entryMeta.path).toBe("/TEST.DS");
    });

    it("returns a proper dsname", () => {
        const fakeProfile: any = { name: "testProfile" };
        const entryMeta = new DsEntryMetadata({
            profile: fakeProfile,
            path: "/TEST.DS",
        });
        expect(entryMeta.dsname).toBe("TEST.DS");

        const pdsEntryMeta = new DsEntryMetadata({
            profile: fakeProfile,
            path: "/TEST.PDS/MEMBER",
        });
        expect(pdsEntryMeta.dsname).toBe("TEST.PDS(MEMBER)");
    });
});
