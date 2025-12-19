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

import { TreeItem, ViewSection } from "wdio-vscode-service";

export class ProfileNode {
    private mFavoritesNode: TreeItem;

    constructor(private browser: WebdriverIO.Browser, private treePane: ViewSection, private profileName: string, private isFavorite = false) {}

    public async exists(): Promise<boolean> {
        try {
            return (await this.find()) != null;
        } catch {
            return false;
        }
    }

    public async find(): Promise<TreeItem> {
        if (this.isFavorite && this.mFavoritesNode == null) {
            this.mFavoritesNode = (await this.treePane.findItem("Favorites")) as TreeItem;
            await this.mFavoritesNode.expand();
            await this.browser.waitUntil((): Promise<boolean> => this.mFavoritesNode.isExpanded());
        }
        return (await (this.isFavorite ? this.mFavoritesNode.findChildItem(this.profileName) : this.treePane.findItem(this.profileName))) as TreeItem;
    }

    public async waitUntilExpanded(expanded = true): Promise<void> {
        await this.browser.waitUntil(async () => (await (await this.find()).isExpanded()) === expanded);
    }

    public async waitUntilHasChildren(): Promise<void> {
        await this.browser.waitUntil(async () => await (await this.find()).hasChildren());
    }
}
