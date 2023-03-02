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

import { ZoweSaveQueue } from "../../../src/abstract/ZoweSaveQueue";
import { createUSSTree } from "../../../__mocks__/mockCreators/uss";
import { saveUSSFile } from "../../../src/uss/actions";
import * as workspaceUtils from "../../../src/utils/workspace";
import { Gui } from "@zowe/zowe-explorer-api";
import * as globals from "../../../src/globals";
import * as vscode from "vscode";

describe("ZoweSaveQueue - unit tests", () => {
    const createGlobalMocks = () => {
        const globalMocks = {
            errorMessageSpy: jest.spyOn(Gui, "errorMessage"),
            markDocumentUnsavedSpy: jest.spyOn(workspaceUtils, "markDocumentUnsaved"),
            processNextSpy: jest.spyOn(ZoweSaveQueue as any, "processNext"),
            allSpy: jest.spyOn(ZoweSaveQueue, "all"),
            trees: {
                uss: createUSSTree([], []),
            },
        };

        Object.defineProperty(globals, "LOG", {
            value: {
                debug: jest.fn(),
                error: jest.fn(),
            },
        });

        return globalMocks;
    };
    const globalMocks = createGlobalMocks();

    it("does promise chaining when pushing to queue", () => {
        ZoweSaveQueue.push({
            fileProvider: globalMocks.trees.uss,
            uploadRequest: saveUSSFile,
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
            uploadRequest: async (doc, prov) => {
                throw EXAMPLE_ERROR;
            },
            savedFile: FAILING_FILE as vscode.TextDocument,
        });

        try {
            await ZoweSaveQueue.all();
            fail("ZoweSaveQueue.all should fail here");
        } catch (err) {
            expect(globals.LOG.error).toHaveBeenCalledWith(EXAMPLE_ERROR);
            expect(globalMocks.markDocumentUnsavedSpy).toHaveBeenCalledWith(FAILING_FILE);
            expect(globalMocks.errorMessageSpy).toHaveBeenCalledWith(
                'Failed to upload changes for [failingFile](command:vscode.open?["/some/failing/path"]): Example error'
            );
        }
    });
});
