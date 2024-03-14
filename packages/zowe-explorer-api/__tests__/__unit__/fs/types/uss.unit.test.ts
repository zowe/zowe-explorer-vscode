import { UssDirectory, UssFile } from "../../../../src";

describe("UssFile", () => {
    it("calls FileEntry constructor on initialization and sets binary to false", () => {
        const newFile = new UssFile("testFile.txt");
        expect(newFile.name).toBe("testFile.txt");
        expect(newFile.binary).toBe(false);
    });
});

describe("UssDirectory", () => {
    it("calls DirEntry constructor on initialization", () => {
        const newFolder = new UssDirectory("testFolder");
        expect(newFolder.name).toBe("testFolder");

        const rootFolder = new UssDirectory();
        expect(rootFolder.name).toBe("");
    });
});
