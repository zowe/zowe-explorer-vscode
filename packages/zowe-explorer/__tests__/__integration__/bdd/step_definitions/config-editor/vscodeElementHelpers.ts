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
 * Helpers for driving the `@vscode-elements` custom elements the Config Editor webview is built
 * from. They are not native controls, so WebDriver's form commands do not apply to them:
 *
 * - `vscode-textfield` keeps its `<input>` inside a shadow root, so `setValue`/`clearValue` have to
 *   go to that inner input rather than to the host.
 * - `vscode-single-select` has no `<select>` at all and its `vscode-option` children hold `value`
 *   as a property, not an attribute, so `selectBy*` and `getAttribute("value")` both come up empty.
 *   Assigning `value` and firing `change` is exactly what the component's React binding listens for.
 */

declare const browser: any;

const DEFAULT_TIMEOUT = 10000;

export interface SelectOption {
    value: string;
    text: string;
}

/** True for the webview's custom elements (`vscode-textfield`, `vscode-single-select`, ...). */
export async function isVscodeElement(element: any): Promise<boolean> {
    return (await element.getTagName()).toLowerCase().startsWith("vscode-");
}

/**
 * The editable `<input>` behind a control: the shadow input for a `vscode-textfield`, or the
 * element itself when it already is a native input.
 */
export async function textInputOf(element: any): Promise<any> {
    if (!(await isVscodeElement(element))) {
        return element;
    }
    const shadowInput = await element.shadow$("input");
    await shadowInput.waitForExist({ timeout: DEFAULT_TIMEOUT });
    return shadowInput;
}

/** Replace the text in a native input or a `vscode-textfield` with `value`. */
export async function setTextValue(element: any, value: string): Promise<void> {
    const input = await textInputOf(element);
    await input.waitForExist({ timeout: DEFAULT_TIMEOUT });
    await input.setValue(value);
}

/** Current text of a native input or a `vscode-textfield`. */
export async function getTextValue(element: any): Promise<string> {
    const input = await textInputOf(element);
    return input.getValue();
}

/** Read the `value` of any control, including the custom-element hosts that keep it as a property. */
export async function getControlValueOn(element: any): Promise<string> {
    return await browser.execute((el: HTMLElement & { value?: string }) => el.value ?? "", element);
}

/** Options of a `vscode-single-select` (or a native `<select>`), in render order. */
export async function getSelectOptionsOn(element: any): Promise<SelectOption[]> {
    return await browser.execute((host: HTMLElement) => {
        const options = Array.from(host.querySelectorAll("vscode-option, option"));
        return options.map((option) => ({
            value: (option as HTMLElement & { value?: string }).value ?? "",
            text: (option.textContent ?? "").trim(),
        }));
    }, element);
}

/** Set a `vscode-single-select` (or native `<select>`) to `value`. */
export async function setSelectValueOn(element: any, value: string): Promise<void> {
    await element.waitForExist({ timeout: DEFAULT_TIMEOUT });
    await element.waitForDisplayed({ timeout: DEFAULT_TIMEOUT });

    if (!(await isVscodeElement(element))) {
        await element.selectByAttribute("value", value);
        return;
    }

    await browser.execute(
        (host: HTMLElement & { value: string }, val: string) => {
            host.value = val;
            host.dispatchEvent(new Event("change", { bubbles: true }));
        },
        element,
        value
    );

    await browser.waitUntil(async () => (await getControlValueOn(element)) === value, {
        timeout: 5000,
        timeoutMsg: `Select never took the value "${value}"`,
    });
}

/** Same as {@link setSelectValueOn}, but matching on the option label the feature file uses. */
export async function setSelectValueByTextOn(element: any, text: string): Promise<void> {
    const options = await getSelectOptionsOn(element);
    const match = options.find((option) => option.text === text) ?? options.find((option) => option.value === text);
    if (!match) {
        throw new Error(`Select has no option "${text}" (options: ${options.map((o) => o.text).join(", ")})`);
    }
    await setSelectValueOn(element, match.value);
}

async function resolve(selector: string): Promise<any> {
    const element = await browser.$(selector);
    await element.waitForExist({ timeout: DEFAULT_TIMEOUT });
    return element;
}

export async function getSelectOptions(selector: string): Promise<SelectOption[]> {
    return getSelectOptionsOn(await resolve(selector));
}

export async function setSelectValue(selector: string, value: string): Promise<void> {
    return setSelectValueOn(await resolve(selector), value);
}

export async function setSelectValueByText(selector: string, text: string): Promise<void> {
    return setSelectValueByTextOn(await resolve(selector), text);
}
