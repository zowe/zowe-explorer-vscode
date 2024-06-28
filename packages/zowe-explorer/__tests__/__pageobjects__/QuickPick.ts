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

    private async findElement() {
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
        return !(await this.elem.isDisplayedInViewport());
    }

    public async hasOptions(): Promise<boolean> {
        return (await this.elem.$$(`.monaco-list-row[role="option"]`).length) > 0;
    }

    public async findItem(label: string): Promise<ChainablePromiseElement> {
        return this.elem.$(`.monaco-list-row[role="option"][aria-label="${label}"]`);
    }

    public async findItemByIndex(i: number): Promise<ChainablePromiseElement> {
        return this.elem.$(`.monaco-list-row[role="option"][data-index="${i}"]`);
    }
}

const quickPick = new QuickPick();
export default quickPick;
