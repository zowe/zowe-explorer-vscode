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

import { Types, Gui, MainframeInteraction, IZoweUSSTreeNode, WebView } from "@zowe/zowe-explorer-api";
import { ExtensionContext } from "vscode";
import { ZoweExplorerApiRegister } from "../../extending/ZoweExplorerApiRegister";
import { SharedContext } from "../shared/SharedContext";
import * as vscode from "vscode";
import * as fs from "fs";

export class USSAttributeView extends WebView {
    private treeProvider: Types.IZoweUSSTreeType;
    private readonly ussNode: IZoweUSSTreeNode;
    private readonly ussApi: MainframeInteraction.IUss;
    private readonly canUpdate: boolean;

    // private onUpdateDisposable: Disposable;

    public constructor(context: ExtensionContext, treeProvider: Types.IZoweUSSTreeType, node: IZoweUSSTreeNode) {
        const label = node.label ? `Edit Attributes: ${node.label as string}` : "Edit Attributes";
        super(label, "edit-attributes", context, {
            onDidReceiveMessage: (message: object) => this.onDidReceiveMessage(message),
        });
        this.treeProvider = treeProvider;
        this.ussNode = node;
        this.canUpdate = node.onUpdate != null;
        this.ussApi = ZoweExplorerApiRegister.getUssApi(this.ussNode.getProfile());
    }

    private async attachTag(node: IZoweUSSTreeNode): Promise<void> {
        if (this.ussApi.getTag && !SharedContext.isUssDirectory(node)) {
            await node.setAttributes({ tag: await this.ussApi.getTag(node.fullPath) });
        }
    }

    protected async onDidReceiveMessage(message: any): Promise<void> {
        switch (message.command) {
            case "refresh":
                if (this.canUpdate) {
                    // this.onUpdateDisposable = this.ussNode.onUpdate(async (node) => {
                    //     await this.attachTag(node);
                    //     await this.panel.webview.postMessage({
                    //         attributes: await this.ussNode.getAttributes(),
                    //         name: node.fullPath,
                    //         readonly: this.ussApi.updateAttributes == null,
                    //     });
                    //     this.onUpdateDisposable.dispose();
                    // });

                    const attrs = await this.ussNode.fetchAttributes();
                    await this.ussNode.setAttributes(attrs);
                    await this.attachTag(this.ussNode);

                    await this.panel.webview.postMessage({
                        attributes: attrs,
                        name: this.ussNode.fullPath,
                        readonly: true,
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
                    attributes: await this.ussNode.getAttributes(),
                    name: this.ussNode.fullPath,
                    readonly: this.ussApi.updateAttributes == null,
                });
                break;
            case "update-attributes":
                await this.updateAttributes(message);
                break;
            case "GET_LOCALIZATION": {
                const filePath = vscode.l10n.uri?.fsPath + "";
                fs.readFile(filePath, "utf8", (err, data) => {
                    if (err) {
                        // File doesn't exist, fallback to English strings
                        return;
                    }
                    if (!this.panel) {
                        return;
                    }
                    this.panel.webview.postMessage({
                        command: "GET_LOCALIZATION",
                        contents: data,
                    });
                });
                break;
            }
            default:
                break;
        }
    }

    private async updateAttributes(message: any): Promise<void> {
        if (!this.ussApi.updateAttributes || !("attrs" in message)) {
            // Block the webview from making update requests if the API doesn't exist or if "attrs" is not present in the message object.
            return;
        }

        try {
            if (Object.keys(message?.attrs).length > 0) {
                const oldAttrs = await this.ussNode.getAttributes();
                const attrs = message.attrs;
                const newAttrs: Partial<Types.FileAttributes> = {};
                if (!isNaN(parseInt(attrs.owner))) {
                    const uid = parseInt(attrs.owner);
                    newAttrs.uid = uid;

                    // set owner to the UID to prevent mismatched UIDs/owners
                    newAttrs.owner = attrs.owner;
                } else if (oldAttrs.owner !== attrs.owner) {
                    newAttrs.owner = attrs.owner;
                }

                if (!isNaN(parseInt(attrs.group))) {
                    const gid = parseInt(attrs.group);
                    // must provide owner when changing group
                    newAttrs.owner = attrs.owner;
                    newAttrs.gid = gid;

                    // set group to the GID to prevent mismatched GIDs/groups
                    newAttrs.group = attrs.group;
                } else if (oldAttrs.group !== attrs.group) {
                    // must provide owner when changing group
                    newAttrs.owner = attrs.owner;
                    newAttrs.group = attrs.group;
                }

                if (oldAttrs.perms !== attrs.perms) {
                    newAttrs.perms = attrs.perms;
                }

                if (oldAttrs.tag !== attrs.tag && this.ussApi.getTag) {
                    newAttrs.tag = attrs.tag;
                }

                await this.ussApi.updateAttributes(this.ussNode.fullPath, newAttrs);
                await this.ussNode.setAttributes(newAttrs);

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
