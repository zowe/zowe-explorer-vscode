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

import { useState, useEffect } from "react";

/** Tracks whether VS Code is currently using a light theme, reacting to live theme changes. */
export function useIsLightTheme(): boolean {
    const [isLight, setIsLight] = useState("vscode-light" === document.body.getAttribute("data-vscode-theme-kind"));

    useEffect(() => {
        const observer = new MutationObserver(() => {
            const newIsLight = "vscode-light" === document.body.getAttribute("data-vscode-theme-kind");
            setIsLight(newIsLight);
        });

        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ["data-vscode-theme-kind"],
        });

        return () => observer.disconnect();
    }, []);

    return isLight;
}
