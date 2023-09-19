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

import { FileAttributes, Gui, IZoweTree, IZoweUSSTreeNode, WebView, ZoweExplorerApi } from "@zowe/zowe-explorer-api";
import { Disposable, ExtensionContext } from "vscode";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import * as contextually from "../shared/context";

export class AttributeView extends WebView {
    private treeProvider: IZoweTree<IZoweUSSTreeNode>;
    private readonly ussNode: IZoweUSSTreeNode;
    private readonly ussApi: ZoweExplorerApi.IUss;
    private readonly canUpdate: boolean;

    private onUpdateDisposable: Disposable;

    public constructor(context: ExtensionContext, treeProvider: IZoweTree<IZoweUSSTreeNode>, node: IZoweUSSTreeNode) {
        const label = node.label ? `Edit Attributes: ${node.label as string}` : "Edit Attributes";
        super(label, "edit-attributes", context, (message: object) => this.onDidReceiveMessage(message));
        this.treeProvider = treeProvider;
        this.ussNode = node;
        this.canUpdate = node.onUpdate != null;
        this.ussApi = ZoweExplorerApiRegister.getUssApi(this.ussNode.getProfile());
    }

    private async attachTag(node: IZoweUSSTreeNode): Promise<void> {
        if (this.ussApi.getTag && !contextually.isUssDirectory(node)) {
            node.attributes.tag = await this.ussApi.getTag(node.fullPath);
        }
    }

    protected async onDidReceiveMessage(message: any): Promise<void> {
        switch (message.command) {
            case "refresh":
                if (this.canUpdate) {
                    this.onUpdateDisposable = this.ussNode.onUpdate(async (node) => {
                        await this.attachTag(node);
                        await this.panel.webview.postMessage({
                            attributes: node.attributes,
                            name: node.fullPath,
                            readonly: this.ussApi.updateAttributes == null,
                        });
                        this.onUpdateDisposable.dispose();
                    });

                    if (this.ussNode.getParent()) {
                        this.treeProvider.refreshElement(this.ussNode.getParent());
                    } else {
                        this.treeProvider.refresh();
                    }
                }
                break;
            case "ready":
                await this.attachTag(this.ussNode);
                await this.panel.webview.postMessage({
                    attributes: this.ussNode.attributes,
                    name: this.ussNode.fullPath,
                    readonly: this.ussApi.updateAttributes == null,
                });
                break;
            case "update-attributes":
                await this.updateAttributes(message);
                break;
            default:
                break;
        }
    }

    private async updateAttributes(message: any): Promise<void> {
        if (!this.ussApi.updateAttributes) {
            // The condition in this if statement should never be satisfied; the "Apply Changes" button is disabled
            // when this API doesn't exist. But, this ensures the webview will be blocked from making update requests.
            return;
        }

        try {
            if (Object.keys(message.attrs).length > 0) {
                const attrs = message.attrs;
                const newAttrs: Partial<FileAttributes> = {};
                if (!isNaN(parseInt(attrs.owner))) {
                    const uid = parseInt(attrs.owner);
                    newAttrs.uid = uid;

                    // set owner to the UID to prevent mismatched UIDs/owners
                    newAttrs.owner = attrs.owner;
                } else if (this.ussNode.attributes.owner !== attrs.owner) {
                    newAttrs.owner = attrs.owner;
                }

                if (!isNaN(parseInt(attrs.group))) {
                    const gid = parseInt(attrs.group);
                    // must provide owner when changing group
                    newAttrs.owner = attrs.owner;
                    newAttrs.gid = gid;

                    // set group to the GID to prevent mismatched GIDs/groups
                    newAttrs.group = attrs.group;
                } else if (this.ussNode.attributes.group !== attrs.group) {
                    // must provide owner when changing group
                    newAttrs.owner = attrs.owner;
                    newAttrs.group = attrs.group;
                }

                if (this.ussNode.attributes.perms !== attrs.perms) {
                    newAttrs.perms = attrs.perms;
                }

                if (this.ussNode.attributes.tag !== attrs.tag && this.ussApi.getTag) {
                    newAttrs.tag = attrs.tag;
                }

                await this.ussApi.updateAttributes(this.ussNode.fullPath, newAttrs);
                this.ussNode.attributes = { ...(this.ussNode.attributes ?? {}), ...newAttrs } as FileAttributes;

                await this.panel.webview.postMessage({
                    updated: true,
                });
                await Gui.infoMessage(`Updated file attributes for ${this.ussNode.fullPath}`);
            }
        } catch (err) {
            await this.panel.webview.postMessage({
                updated: false,
            });
            if (err instanceof Error) {
                await Gui.errorMessage(`Failed to set file attributes for ${this.ussNode.fullPath}: ${err.toString()}`);
            }
        }
    }
}
