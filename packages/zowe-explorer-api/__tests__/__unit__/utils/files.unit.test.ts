import { permStringToOctal } from "../../../src/utils/files";

describe("utils/file.ts", () => {
    describe("permStringToOctal", () => {
        it("converts drwxrwxrwx to 777", () => {
            expect(permStringToOctal("drwxrwxrwx")).toBe(777);
        });

        it("converts d--------- to 0", () => {
            expect(permStringToOctal("d---------")).toBe(0);
        });

        it("converts drwxr-xr-x to 755", () => {
            expect(permStringToOctal("drwxr-xr-x")).toBe(755);
        });

        it("converts -rwxrwxrwx to 777", () => {
            expect(permStringToOctal("-rwxrwxrwx")).toBe(777);
        });
    });
});
