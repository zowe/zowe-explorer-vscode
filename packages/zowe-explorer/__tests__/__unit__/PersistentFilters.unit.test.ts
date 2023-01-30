import { PersistentFilters } from "../../src/PersistentFilters";

describe("PersistentFilters Unit Test", () => {
    describe("addSearchHistory()", () => {
        it("should pop search history if history length is larger than max length", () => {
            const pf: PersistentFilters = new PersistentFilters("", 1, 1);
            const privatePf = pf as any;
            privatePf.mSearchHistory = ["testOne"];
            pf.addSearchHistory("testTwo");
            expect(pf.getSearchHistory()).toEqual(["testTwo"]);
        });
    });
    describe("addFileHistory()", () => {
        it("should pop search history if history length is larger than max length", () => {
            const pf: PersistentFilters = new PersistentFilters("", 2, 2);
            const privatePf = pf as any;
            privatePf.mFileHistory = ["TEST2.TXT", "TEST1.TXT"];
            pf.addFileHistory("TEST3.TXT");
            expect(pf.getFileHistory()).toEqual(["TEST3.TXT", "TEST2.TXT"]);
        });
    });
});
