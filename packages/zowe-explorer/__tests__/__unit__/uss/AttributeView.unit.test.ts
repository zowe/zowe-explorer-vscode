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

import { ExtensionContext } from "vscode";
import { AttributeView } from "../../../src/uss/AttributeView";
import { IZoweTree, IZoweUSSTreeNode, ZoweExplorerApi } from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../../../src/ZoweExplorerApiRegister";
import * as contextually from "../../../src/shared/context";

describe("AttributeView unit tests", () => {
    let view: AttributeView;
    const context = { extensionPath: "some/fake/ext/path" } as unknown as ExtensionContext;
    const treeProvider = { refreshElement: jest.fn(), refresh: jest.fn() } as unknown as IZoweTree<IZoweUSSTreeNode>;
    const node = {
        attributes: {
            perms: "----------",
            tag: undefined,
        },
        label: "example node",
        fullPath: "/z/some/path",
        getParent: jest.fn(),
        getProfile: jest.fn(),
        onUpdate: jest.fn(),
    } as unknown as IZoweUSSTreeNode;
    const updateAttributesMock = jest.fn();

    beforeAll(() => {
        jest.spyOn(ZoweExplorerApiRegister, "getUssApi").mockReturnValue({
            updateAttributes: updateAttributesMock,
            getTag: () => Promise.resolve("UTF-8"),
        } as unknown as ZoweExplorerApi.IUss);
        jest.spyOn(contextually, "isUssDirectory").mockReturnValue(false);
        view = new AttributeView(context, treeProvider, node);
    });

    afterEach(() => {
        node.onUpdate = jest.fn();
    });

    it("refreshes properly when webview sends 'refresh' command", async () => {
        // case 1: node is a root node
        await (view as any).onDidReceiveMessage({ command: "refresh" });
        expect(treeProvider.refresh).toHaveBeenCalled();

        // case 2: node is a child node
        node.getParent = jest.fn().mockReturnValueOnce({ label: "parent node" } as IZoweUSSTreeNode);
        await (view as any).onDidReceiveMessage({ command: "refresh" });
        expect(treeProvider.refreshElement).toHaveBeenCalled();

        expect(node.onUpdate).toHaveBeenCalledTimes(2);
    });

    it("dispatches node data to webview when 'ready' command is received", async () => {
        await (view as any).onDidReceiveMessage({ command: "ready" });
        expect(view.panel.webview.postMessage).toHaveBeenCalledWith({
            attributes: node.attributes,
            name: node.fullPath,
            readonly: false,
        });
    });

    it("updates attributes when 'update-attributes' command is received", async () => {
        // case 1: no attributes provided from webview (sanity check)
        await (view as any).onDidReceiveMessage({ command: "update-attributes" });
        expect(updateAttributesMock).not.toHaveBeenCalled();

        const attributes = {
            owner: "owner",
            group: "group",
            perms: "-rwxrwxrwx",
        };

        // case 2: attributes provided from webview, pass owner/group as name
        await (view as any).onDidReceiveMessage({
            command: "update-attributes",
            attrs: attributes,
        });
        expect(updateAttributesMock).toHaveBeenCalled();
        expect(view.panel.webview.postMessage).toHaveBeenCalledWith({
            updated: true,
        });

        // case 2: attributes provided from webview, pass owner/group as IDs
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
        updateAttributesMock.mockRejectedValueOnce(new Error("Failed to update attributes"));
        await (view as any).onDidReceiveMessage({
            command: "update-attributes",
            attrs: {},
        });
        expect(updateAttributesMock).toHaveBeenCalled();
        expect(view.panel.webview.postMessage).toHaveBeenCalledWith({
            updated: false,
        });
    });
});
