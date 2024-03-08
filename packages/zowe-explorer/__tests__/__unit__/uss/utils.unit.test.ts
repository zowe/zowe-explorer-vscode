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
import { UssFSProvider } from "../../../src/uss/UssFSProvider";

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
        const getEncodingMock = jest.spyOn(UssFSProvider.instance, "getEncodingForFile").mockReturnValue(undefined as any);
        const node = new ZoweUSSNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        const setEncodingMock = jest.spyOn(UssFSProvider.instance, "setEncodingForFile").mockImplementation();
        getTagMock.mockResolvedValueOnce("binary");
        await utils.autoDetectEncoding(node);
        expect(node.binary).toBe(true);
        expect(setEncodingMock).toHaveBeenCalledWith(node.resourceUri, { kind: "binary" });
        expect(getTagMock).toHaveBeenCalledTimes(1);
        getEncodingMock.mockRestore();
    });

    it("sets encoding if file tagged as binary - old API", async () => {
        const getEncodingMock = jest.spyOn(UssFSProvider.instance, "getEncodingForFile").mockReturnValue(undefined as any);
        const node = new ZoweUSSNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        const setEncodingMock = jest.spyOn(UssFSProvider.instance, "setEncodingForFile").mockImplementation();
        const isFileTagBinOrAsciiMock = jest.fn().mockResolvedValueOnce(true);
        mockUssApi.mockReturnValueOnce({
            isFileTagBinOrAscii: isFileTagBinOrAsciiMock,
        } as any);
        await utils.autoDetectEncoding(node);
        expect(node.binary).toBe(true);
        expect(setEncodingMock).toHaveBeenCalledWith(node.resourceUri, { kind: "binary" });
        expect(isFileTagBinOrAsciiMock).toHaveBeenCalledTimes(1);
        setEncodingMock.mockRestore();
        getEncodingMock.mockRestore();
    });

    it("sets encoding if file tagged as EBCDIC", async () => {
        const getEncodingMock = jest.spyOn(UssFSProvider.instance, "getEncodingForFile").mockReturnValue(undefined as any);
        const node = new ZoweUSSNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        const setEncodingMock = jest.spyOn(UssFSProvider.instance, "setEncodingForFile").mockImplementation();
        getTagMock.mockResolvedValueOnce("IBM-1047");
        await utils.autoDetectEncoding(node);
        expect(node.binary).toBe(false);
        expect(setEncodingMock).toHaveBeenCalledWith(node.resourceUri, { kind: "other", codepage: "IBM-1047" });
        expect(getTagMock).toHaveBeenCalledTimes(1);
        setEncodingMock.mockRestore();
        getEncodingMock.mockRestore();
    });

    it("does not set encoding if file is untagged", async () => {
        const node = new ZoweUSSNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        const setEncodingSpy = jest.spyOn(UssFSProvider.instance, "setEncodingForFile");
        const getEncodingSpy = jest.spyOn(node, "getEncoding").mockReturnValue(undefined as any);
        getTagMock.mockResolvedValueOnce("untagged");
        await utils.autoDetectEncoding(node);
        expect(node.binary).toBe(false);
        expect(setEncodingSpy).not.toHaveBeenCalled();
        expect(getTagMock).toHaveBeenCalledTimes(1);
        setEncodingSpy.mockRestore();
        getEncodingSpy.mockRestore();
    });

    it("does not set encoding if already defined on node", async () => {
        const makeEmptyFileWithEncoding = jest.spyOn(UssFSProvider.instance, "makeEmptyFileWithEncoding").mockImplementation();
        const node = new ZoweUSSNode({
            label: "encodingTest",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            profile: createIProfile(),
            encoding: { kind: "text" },
        });
        const setEncodingSpy = jest.spyOn(UssFSProvider.instance, "setEncodingForFile").mockClear();
        const getEncodingSpy = jest.spyOn(node, "getEncoding").mockReturnValue({ kind: "text" });
        await utils.autoDetectEncoding(node);
        expect(node.binary).toBe(false);
        expect(makeEmptyFileWithEncoding).toHaveBeenCalled();
        expect(getEncodingSpy).toHaveBeenCalled();
        expect(setEncodingSpy).not.toHaveBeenCalled();
        expect(getTagMock).toHaveBeenCalledTimes(0);
        setEncodingSpy.mockRestore();
        getEncodingSpy.mockRestore();
    });
});
