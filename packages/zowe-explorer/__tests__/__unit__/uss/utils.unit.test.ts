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
import { ZoweExplorerApiRegister } from "../../../src/ZoweExplorerApiRegister";
import { ZoweUSSNode } from "../../../src/uss/ZoweUSSNode";
import * as utils from "../../../src/uss/utils";
import { createIProfile } from "../../../__mocks__/mockCreators/shared";

describe("USS utils unit tests - function autoDetectEncoding", () => {
    const getTagMock = jest.fn();
    let mockUssApi;

    beforeEach(() => {
        mockUssApi = jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValue({
            getTag: getTagMock.mockClear(),
        } as any);
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    it("sets encoding if file tagged as binary", async () => {
        const node = new ZoweUSSNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        getTagMock.mockResolvedValueOnce("binary");
        await utils.autoDetectEncoding(node);
        expect(node.binary).toBe(true);
        expect(node.encoding).toBeUndefined();
        expect(getTagMock).toHaveBeenCalledTimes(1);
    });

    it("sets encoding if file tagged as binary - old API", async () => {
        const node = new ZoweUSSNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        const isFileTagBinOrAsciiMock = jest.fn().mockResolvedValueOnce(true);
        mockUssApi.mockReturnValueOnce({
            isFileTagBinOrAscii: isFileTagBinOrAsciiMock,
        } as any);
        await utils.autoDetectEncoding(node);
        expect(node.binary).toBe(true);
        expect(node.encoding).toBeUndefined();
        expect(isFileTagBinOrAsciiMock).toHaveBeenCalledTimes(1);
    });

    it("sets encoding if file tagged as EBCDIC", async () => {
        const node = new ZoweUSSNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        getTagMock.mockResolvedValueOnce("IBM-1047");
        await utils.autoDetectEncoding(node);
        expect(node.binary).toBe(false);
        expect(node.encoding).toBe("IBM-1047");
        expect(getTagMock).toHaveBeenCalledTimes(1);
    });

    it("does not set encoding if file is untagged", async () => {
        const node = new ZoweUSSNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        getTagMock.mockResolvedValueOnce("untagged");
        await utils.autoDetectEncoding(node);
        expect(node.binary).toBe(false);
        expect(node.encoding).toBeUndefined();
        expect(getTagMock).toHaveBeenCalledTimes(1);
    });

    it("does not set encoding if already defined on node", async () => {
        const node = new ZoweUSSNode({
            label: "encodingTest",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            profile: createIProfile(),
            encoding: { kind: "text" },
        });
        await utils.autoDetectEncoding(node);
        expect(node.binary).toBe(false);
        expect(node.encoding).toBeNull();
        expect(getTagMock).toHaveBeenCalledTimes(0);
    });
});
