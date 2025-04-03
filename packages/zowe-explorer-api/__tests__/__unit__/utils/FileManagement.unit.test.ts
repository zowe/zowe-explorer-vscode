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

import { FileSystemError, FileType, Uri, window, workspace } from "vscode";
import { FileManagement } from "../../../src/utils/FileManagement";
import { IFileSystemEntry, ZoweScheme } from "../../../src";

describe("permStringToOctal", () => {
    it("converts drwxrwxrwx to 777", () => {
        expect(FileManagement.permStringToOctal("drwxrwxrwx")).toBe(777);
    });

    it("converts d--------- to 0", () => {
        expect(FileManagement.permStringToOctal("d---------")).toBe(0);
    });

    it("converts drwxr-xr-x to 755", () => {
        expect(FileManagement.permStringToOctal("drwxr-xr-x")).toBe(755);
    });

    it("converts -rwxrwxrwx to 777", () => {
        expect(FileManagement.permStringToOctal("-rwxrwxrwx")).toBe(777);
    });
});

describe("reloadActiveEditorForProfile", () => {
    it("calls workspace.fs.{readFile,stat} to reload contents of editor", async () => {
        const fakeFsEntry: IFileSystemEntry = {
            name: "exampleFile.txt",
            wasAccessed: true,
            type: FileType.Directory,
            metadata: {
                path: "/sestest/exampleFolder/exampleFile.txt",
                profile: {
                    name: "sestest",
                    message: "",
                    type: "zosmf",
                    failNotFound: true,
                },
            },
            ctime: Date.now() - 10,
            mtime: Date.now(),
            size: 123,
        };
        const fileUri = Uri.from({ scheme: ZoweScheme.USS, path: "/sestest/exampleFolder/exampleFile.txt" });
        const activeTextEditorMock = jest.replaceProperty(window, "activeTextEditor", {
            document: {
                fileName: "exampleFile.txt",
                uri: fileUri,
            } as any,
        } as any);
        const statMock = jest.spyOn(workspace.fs, "stat").mockResolvedValueOnce(fakeFsEntry);
        const readFileMock = jest.spyOn(workspace.fs, "readFile").mockImplementationOnce((): Promise<Uint8Array> => {
            // wasAccessed flag should be false after reassigning in reloadActiveEditorForProfile
            expect(fakeFsEntry.wasAccessed).toBe(false);
            return Promise.resolve(new Uint8Array([1, 2, 3]));
        });
        await FileManagement.reloadActiveEditorForProfile("sestest");
        expect(statMock).toHaveBeenCalledTimes(1);
        expect(statMock).toHaveBeenCalledWith(fileUri);
        expect(readFileMock).toHaveBeenCalledTimes(1);
        expect(readFileMock).toHaveBeenCalledWith(fileUri);
        activeTextEditorMock.restore();
    });
});

describe("reloadWorkspacesForProfile", () => {
    it("calls workspace.fs.stat with fetch=true for each workspace folder", async () => {
        const folderUri = Uri.from({ scheme: ZoweScheme.USS, path: "/sestest/exampleFolder" });
        const workspaceFoldersMock = jest.replaceProperty(workspace, "workspaceFolders", [
            {
                uri: folderUri,
                name: "exampleFolder",
                index: 0,
            },
        ]);
        const statMock = jest
            .spyOn(workspace.fs, "stat")
            .mockClear()
            .mockResolvedValueOnce(undefined as any);
        await FileManagement.reloadWorkspacesForProfile("sestest");
        expect(statMock).toHaveBeenCalledTimes(1);
        expect(statMock).toHaveBeenCalledWith(folderUri.with({ query: "fetch=true" }));
        workspaceFoldersMock.restore();
    });
    it("calls console.error in event of an error", async () => {
        const folderUri = Uri.from({ scheme: ZoweScheme.USS, path: "/sestest/exampleFolder" });
        const workspaceFoldersMock = jest.replaceProperty(workspace, "workspaceFolders", [
            {
                uri: folderUri,
                name: "exampleFolder",
                index: 0,
            },
        ]);
        const statMock = jest.spyOn(workspace.fs, "stat").mockClear().mockRejectedValueOnce(FileSystemError.FileNotFound(folderUri));
        const consoleErrorMock = jest.spyOn(console, "error").mockImplementationOnce(() => {});
        await FileManagement.reloadWorkspacesForProfile("sestest");
        expect(statMock).toHaveBeenCalledTimes(1);
        expect(statMock).toHaveBeenCalledWith(folderUri.with({ query: "fetch=true" }));
        expect(consoleErrorMock).toHaveBeenCalledWith("reloadWorkspacesForProfile:", "file not found");
        workspaceFoldersMock.restore();
    });
});
