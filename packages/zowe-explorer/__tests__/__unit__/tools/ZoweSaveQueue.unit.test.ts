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

import * as vscode from "vscode";
import { Gui } from "@zowe/zowe-explorer-api";
import { createUSSTree } from "../../__mocks__/mockCreators/uss";
import { USSActions } from "../../../src/trees/uss";
import { ZoweLogger, ZoweLocalStorage, ZoweSaveQueue } from "../../../src/tools";
import { Workspace } from "../../../src/configuration";

jest.mock("../../../src/tools/ZoweLogger");

describe("ZoweSaveQueue - unit tests", () => {
    const createGlobalMocks = () => {
        Object.defineProperty(ZoweLocalStorage, "storage", {
            value: {
                get: () => ({ persistence: true, favorites: [], history: [], sessions: ["zosmf"], searchHistory: [], fileHistory: [] }),
                update: jest.fn(),
                keys: () => [],
            },
            configurable: true,
        });
        jest.spyOn(Gui, "createTreeView").mockReturnValue({ onDidCollapseElement: jest.fn() } as any);
        const globalMocks = {
            errorMessageSpy: jest.spyOn(Gui, "errorMessage"),
            markDocumentUnsavedSpy: jest.spyOn(Workspace, "markDocumentUnsaved"),
            processNextSpy: jest.spyOn(ZoweSaveQueue as any, "processNext"),
            allSpy: jest.spyOn(ZoweSaveQueue, "all"),
            trees: {
                uss: createUSSTree([], []),
            },
        };

        return globalMocks;
    };
    const globalMocks = createGlobalMocks();

    it("does promise chaining when pushing to queue", () => {
        ZoweSaveQueue.push({
            fileProvider: globalMocks.trees.uss,
            uploadRequest: USSActions.saveUSSFile,
            savedFile: {
                isDirty: true,
                uri: vscode.Uri.parse(""),
                fileName: "testFile",
            } as vscode.TextDocument,
        });
        expect(globalMocks.allSpy).toHaveBeenCalled();

        // processNext should only be called within the promise itself
        expect(globalMocks.processNextSpy).not.toHaveBeenCalled();
    });

    it("skips save in processNext if newer save is queued for the same document", async () => {
        globalMocks.processNextSpy.mockClear();
        const uploadRequest = jest.fn().mockImplementation(async () => {});

        for (let i = 0; i < 3; i++) {
            ZoweSaveQueue.push({
                fileProvider: globalMocks.trees.uss,
                uploadRequest,
                savedFile: {
                    isDirty: true,
                    uri: vscode.Uri.parse(`${i % 2}`),
                    fileName: `testFile-${i % 2}`,
                } as vscode.TextDocument,
            });
        }

        await ZoweSaveQueue.all();
        // 3 save requests should be processed and 1 should be skipped
        expect(globalMocks.processNextSpy).toHaveBeenCalledTimes(3);
        expect(uploadRequest).toHaveBeenCalledTimes(2);
    });

    it("throws an error in processNext if uploadRequest fails for one of the queued saves", async () => {
        globalMocks.processNextSpy.mockClear();
        const FAILING_FILE = {
            isDirty: true,
            uri: vscode.Uri.parse(`/some/failing/path`),
            fileName: `failingFile`,
        };

        for (let i = 0; i < 3; i++) {
            ZoweSaveQueue.push({
                fileProvider: globalMocks.trees.uss,
                uploadRequest: jest.fn().mockImplementation(async () => {}),
                savedFile: {
                    isDirty: true,
                    uri: vscode.Uri.parse(`${i}`),
                    fileName: `testFile-${i}`,
                } as vscode.TextDocument,
            });
        }

        const EXAMPLE_ERROR = new Error("Example error");
        // Push failing request
        ZoweSaveQueue.push({
            fileProvider: globalMocks.trees.uss,
            uploadRequest: (_doc, _prov) => {
                throw EXAMPLE_ERROR;
            },
            savedFile: FAILING_FILE as vscode.TextDocument,
        });

        try {
            await ZoweSaveQueue.all();
            fail("ZoweSaveQueue.all should fail here");
        } catch (err) {
            expect(ZoweLogger.error).toHaveBeenCalledWith(EXAMPLE_ERROR);
            expect(globalMocks.markDocumentUnsavedSpy).toHaveBeenCalledWith(FAILING_FILE);
            expect(globalMocks.errorMessageSpy).toHaveBeenCalledWith(
                'Failed to upload changes for [failingFile](command:vscode.open?["/some/failing/path"]): Example error'
            );
        }
    });
});
