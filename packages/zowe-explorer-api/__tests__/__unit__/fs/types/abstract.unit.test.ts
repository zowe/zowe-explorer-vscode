import { FilePermission } from "vscode";
import { BufferBuilder, FileEntry, FilterEntry } from "../../../../src";

describe("BufferBuilder", () => {
    it("calls the given callback on write", () => {
        const bufBuilder = new BufferBuilder();
        const callbackMock = jest.fn();
        bufBuilder._write(new Uint8Array([1, 2, 3]), "binary", callbackMock);
        expect(callbackMock).toHaveBeenCalled();
    });

    it("calls 'push' on read", () => {
        const bufBuilder = new BufferBuilder();
        const callbackMock = jest.fn();
        const pushMock = jest.spyOn(bufBuilder, "push");
        bufBuilder._write(new Uint8Array([1, 2, 3]), "binary", callbackMock);
        bufBuilder._read(3);
        expect(pushMock).toHaveBeenCalledTimes(2);
    });
});

describe("FileEntry", () => {
    it("handles read-only entries", () => {
        const newEntry = new FileEntry("testFile", true);
        expect(newEntry.permissions).toBe(FilePermission.Readonly);
    });
});

describe("FilterEntry", () => {
    it("calls DirEntry constructor on initialization", () => {
        const newEntry = new FilterEntry("testFilter");
        expect(newEntry.name).toBe("testFilter");
    });
});
