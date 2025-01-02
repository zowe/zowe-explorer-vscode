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
import { MockedProperty } from "../../../__mocks__/mockUtils";
import { USSAttributeView } from "../../../../src/trees/uss/USSAttributeView";
import { UssFSProvider } from "../../../../src/trees/uss/UssFSProvider";
import { IZoweTree } from "../../../../../zowe-explorer-api/src/tree/IZoweTree";
import { IZoweUSSTreeNode } from "../../../../../zowe-explorer-api/src/tree";
import { ZoweUSSNode } from "../../../../src/trees/uss/ZoweUSSNode";
import { ZoweExplorerApiRegister } from "../../../../src/extending/ZoweExplorerApiRegister";
import { MainframeInteraction } from "../../../../../zowe-explorer-api/src/extend";
import { SharedContext } from "../../../../src/trees/shared/SharedContext";
import * as fs from "fs";

jest.mock("fs");
describe("AttributeView unit tests", () => {
    let view: USSAttributeView;
    const context = { extensionPath: "some/fake/ext/path" } as unknown as vscode.ExtensionContext;
    const treeProvider = { refreshElement: jest.fn(), refresh: jest.fn() } as unknown as IZoweTree<IZoweUSSTreeNode>;
    const createDirMock = jest.spyOn(UssFSProvider.instance, "createDirectory").mockImplementation();
    const node = new ZoweUSSNode({
        label: "example_node",
        collapsibleState: vscode.TreeItemCollapsibleState.None,
        parentPath: "/z/some",
    });
    const updateAttrsApiMock = jest.fn();
    const updateAttributesMock = jest.spyOn(node, "setAttributes").mockImplementation();
    const onUpdateMock = jest.fn();
    const onUpdateMocked = new MockedProperty(ZoweUSSNode.prototype, "onUpdate", undefined, onUpdateMock);
    const getAttributesMock = jest.spyOn(node, "getAttributes").mockImplementation();
    const attrError = new Error("Failed to update attributes");
    const attributes = {
        owner: "owner",
        group: "group",
        perms: "-rwxrwxrwx",
    };

    beforeEach(() => {
        jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValue({
            updateAttributes: jest.fn(),
            getTag: () => Promise.resolve("UTF-8"),
        } as unknown as MainframeInteraction.IUss);
        jest.spyOn(SharedContext, "isUssDirectory").mockReturnValue(false);
        view = new USSAttributeView(context, treeProvider, node);
    });

    afterAll(() => {
        createDirMock.mockRestore();
    });

    it("refreshes properly when webview sends 'refresh' command", async () => {
        // case 1: node is a root node
        onUpdateMock.mockReturnValue(true as any);
        await (view as any).onDidReceiveMessage({ command: "refresh" });
        expect(treeProvider.refresh).toHaveBeenCalled();

        // case 2: node is a child node
        node.getParent = jest.fn().mockReturnValueOnce({ label: "parent node" } as IZoweUSSTreeNode);
        await (view as any).onDidReceiveMessage({ command: "refresh" });
        expect(treeProvider.refreshElement).toHaveBeenCalled();
    });

    it("dispatches node data to webview when 'ready' command is received", async () => {
        const attrs = {
            group: "group",
            perms: "-rwxrwxrwx",
        };
        getAttributesMock.mockResolvedValue(attrs as any);
        await (view as any).onDidReceiveMessage({ command: "ready" });
        expect(view.panel.webview.postMessage).toHaveBeenCalledWith({
            attributes: attrs,
            name: node.fullPath,
            readonly: false,
        });
        getAttributesMock.mockRestore();
    });

    it("updates attributes when 'update-attributes' command is received: case 1", async () => {
        // case 1: no attributes provided from webview (sanity check)
        updateAttrsApiMock.mockClear();
        await (view as any).onDidReceiveMessage({ command: "update-attributes" });
        expect(updateAttrsApiMock).not.toHaveBeenCalled();

        getAttributesMock.mockResolvedValue(attributes as any);

        // case 3: attributes provided from webview, pass owner/group as IDs
        await (view as any).onDidReceiveMessage({
            command: "update-attributes",
            attrs: {
                owner: "1",
                group: "9001",
                perms: attributes.perms,
            },
        });
        expect(updateAttributesMock).toHaveBeenCalled();
        expect(view.panel.webview.postMessage).toHaveBeenCalled();
    });

    it("updates attributes when 'update-attributes' command is received: case 2", async () => {
        // case 2: attributes provided from webview, pass owner/group as name
        getAttributesMock.mockResolvedValue(attributes as any);

        await (view as any).onDidReceiveMessage({
            command: "update-attributes",
            attrs: attributes,
        });
        expect(updateAttributesMock).toHaveBeenCalled();
        expect(view.panel.webview.postMessage).toHaveBeenCalledWith({
            updated: true,
        });
    });

    it("updates attributes when 'update-attributes' command is received: case 3", async () => {
        // case 3: attributes provided from webview, pass owner/group as IDs
        getAttributesMock.mockResolvedValue(attributes as any);

        await (view as any).onDidReceiveMessage({
            command: "update-attributes",
            attrs: {
                ...attributes,
                owner: "1",
                group: "9001",
            },
        });
        expect(updateAttributesMock).toHaveBeenCalled();
        expect(view.panel.webview.postMessage).toHaveBeenCalled();
    });

    it("handles any errors while updating attributes", async () => {
        updateAttributesMock.mockRejectedValue(attrError as any);
        await (view as any).onDidReceiveMessage({
            command: "update-attributes",
            attrs: { owner: "someowner" },
        });

        expect(view.panel.webview.postMessage).toHaveBeenCalledWith({
            updated: false,
        });
    });

    it("handles GET_LOCALIZATION command", async () => {
        const spyReadFile = jest.fn((path, encoding, callback) => {
            callback(null, "file contents");
        });
        Object.defineProperty(fs, "readFile", { value: spyReadFile, configurable: true });
        await (view as any).onDidReceiveMessage({ command: "GET_LOCALIZATION" });
        expect(view.panel.webview.postMessage).toHaveBeenCalledWith({
            command: "GET_LOCALIZATION",
            contents: "file contents",
        });
    });

    it("if this.panel doesn't exist in GET_LOCALIZATION", async () => {
        const spyReadFile = jest.fn((path, encoding, callback) => {
            callback(null, "file contents");
        });
        Object.defineProperty(fs, "readFile", { value: spyReadFile, configurable: true });
        view.panel = undefined as any;
        await (view as any).onDidReceiveMessage({ command: "GET_LOCALIZATION" });
        expect(view.panel).toBeUndefined();
    });

    it("if read file throwing an error in GET_LOCALIZATION", async () => {
        const spyReadFile = jest.fn((path, encoding, callback) => {
            callback("error", "file contents");
        });
        Object.defineProperty(fs, "readFile", { value: spyReadFile, configurable: true });
        await (view as any).onDidReceiveMessage({ command: "GET_LOCALIZATION" });
        expect(spyReadFile).toHaveBeenCalledTimes(1);
    });
});
