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

/**
 * Represents the quick pick object from its selectors
 */
class QuickPick {
    private selector: string;
    public elem: WebdriverIO.Element;

    public constructor() {
        this.selector = ".quick-input-widget";
    }

    private async findElement(): Promise<void> {
        this.elem = await $(this.selector);
    }

    public async isDisplayed(): Promise<boolean> {
        await this.findElement();
        return this.elem.isDisplayed();
    }

    public async isClickable(): Promise<boolean> {
        await this.findElement();
        return this.elem.isClickable();
    }

    public async isNotInViewport(): Promise<boolean> {
        await this.findElement();
        return !(await this.elem.isDisplayed({ withinViewport: true }));
    }

    public async hasOptions(): Promise<boolean> {
        return (await this.elem.$$(`.monaco-list-row[role="option"]`).length) > 0;
    }

    public async findItem(label: string): Promise<ChainablePromiseElement> {
        // Handle labels that start with a codicon
        label = label.replace(/^\$\(([^)]+)\)\s/, "$1  ");
        return this.elem.$(`.monaco-list-row[role="option"][aria-label="${label}"]`);
    }

    public async findItemByIndex(i: number): Promise<ChainablePromiseElement> {
        return this.elem.$(`.monaco-list-row[role="option"][data-index="${i}"]`);
    }

    /**
     * Clicks the quick-pick row whose visible label text matches {@link label}.
     *
     * Tries the `.label-name` span first (avoids mismatches when the aria-label
     * includes a description suffix), then falls back to an exact aria-label match
     * via {@link findItem}.
     */
    public async selectItemByLabel(label: string): Promise<void> {
        await browser.waitUntil(() => this.isClickable(), { timeout: 10000 });
        await this.findElement();
        const rows = await this.elem.$$('.monaco-list-row[role="option"]');
        for (const row of rows) {
            try {
                const nameEl = await row.$(".label-name");
                if ((await nameEl.getText()).trim() === label) {
                    await row.click();
                    return;
                }
            } catch {
                // label-name span absent; fall through to aria-label match
            }
        }
        const item = await this.findItem(label);
        await item.waitForClickable({ timeout: 5000 });
        await item.click();
    }
}

const quickPick = new QuickPick();
export default quickPick;
