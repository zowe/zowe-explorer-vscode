import { getLanguageId } from "../../../src/dataset/utils";

describe("Dataset utils unit tests - function getLanguageId", () => {
    it("returns the proper language ID", () => {
        const pairs = [
            { name: "TEST.DS.C", languageId: "c" },
            { name: "TEST.PDS.C(MEMBER)", languageId: "c" },
            { name: "TEST.DS.JCL", languageId: "jcl" },
            { name: "TEST.DS.CBL", languageId: "cobol" },
            { name: "TEST.PDS.CPY(M1)", languageId: "copybook" },
            { name: "TEST.DS.INCLUDE", languageId: "inc" },
            { name: "TEST.DS.PLX", languageId: "pli" },
            { name: "TEST.DS.SHELL", languageId: "shellscript" },
            { name: "TEST.DS.EXEC", languageId: "rexx" },
            { name: "TEST.DS.XML", languageId: "xml" },
            { name: "TEST.DS.ASM", languageId: "asm" },
            { name: "TEST.DS.LOG", languageId: "log" },
        ];
        for (const pair of pairs) {
            expect(getLanguageId(pair.name)).toBe(pair.languageId);
        }
    });
    it("returns null if no language ID was found", () => {
        expect(getLanguageId("TEST.DS")).toBe(null);
    });
});
