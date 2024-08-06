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

import { useEffect } from "preact/hooks";

export function getVsCodeTheme(): string | null {
    return document.body.getAttribute("data-vscode-theme-kind");
}

export const useMutableObserver = (target: Node, callback: MutationCallback, options: MutationObserverInit | undefined): void => {
    useEffect(() => {
        const mutationObserver = new MutationObserver((mutations, observer) => callback(mutations, observer));
        mutationObserver.observe(target, options);
        return (): void => mutationObserver.disconnect();
    }, [callback, options]);
};

export function isSecureOrigin(origin: string): boolean {
    const eventUrl = new URL(origin);
    const isWebUser =
        (eventUrl.protocol === document.location.protocol && eventUrl.hostname === document.location.hostname) ||
        eventUrl.hostname.endsWith(".github.dev");
    const isLocalVSCodeUser = eventUrl.protocol === "vscode-webview:";

    if (!isWebUser && !isLocalVSCodeUser) {
        return false;
    }

    return true;
}
