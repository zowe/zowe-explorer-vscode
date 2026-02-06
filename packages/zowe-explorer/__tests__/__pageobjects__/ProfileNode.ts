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

/**
 * Page Object for a profile node in Zowe Explorer tree pane
 */
export class ProfileNode {
    private mFavoritesNode: TreeItem;

    public constructor(
        private browser: WebdriverIO.Browser,
        private treePane: ViewSection,
        private profileName: string,
        private isFavorite = false
    ) {}

    /**
     * Checks if the profile node exists in the tree pane
     */
    public async exists(): Promise<boolean> {
        try {
            return (await this.find()) != null;
        } catch {
            return false;
        }
    }

    /**
     * Locates the profile node without caching to avoid stale elements
     */
    public async find(): Promise<TreeItem> {
        if (this.isFavorite && this.mFavoritesNode == null) {
            this.mFavoritesNode = (await this.treePane.findItem("Favorites")) as TreeItem;
            await this.mFavoritesNode.expand();
            await this.browser.waitUntil((): Promise<boolean> => this.mFavoritesNode.isExpanded());
        }
        return (await (this.isFavorite ? this.mFavoritesNode.findChildItem(this.profileName) : this.treePane.findItem(this.profileName))) as TreeItem;
    }

    /**
     * Expands child tree item and waits for its children to load
     */
    public async revealChildItem(itemName: string): Promise<TreeItem> {
        const profileNode = await this.find();
        await (await profileNode.findChildItem(itemName))?.expand();
        await this.browser.waitUntil(async () => (await profileNode.findChildItem(itemName))?.hasChildren());
        return await profileNode.findChildItem(itemName);
    }

    /**
     * Waits for collapsible state of the profile node to change
     */
    public async waitUntilExpanded(expanded = true): Promise<void> {
        await this.browser.waitUntil(async () => (await (await this.find()).isExpanded()) === expanded);
    }

    /**
     * Waits for children of the profile node to load
     */
    public async waitUntilHasChildren(): Promise<void> {
        await this.browser.waitUntil(async () => await (await this.find()).hasChildren());
    }
}
