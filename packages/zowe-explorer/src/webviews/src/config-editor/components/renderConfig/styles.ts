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

import type { CSSProperties } from "react";

/** Style applied to inputs whose value is inherited/merged and therefore read-only. */
export const MERGED_DISABLED_INPUT_STYLE: CSSProperties = {
    backgroundColor: "var(--vscode-input-disabledBackground)",
    color: "var(--vscode-disabledForeground)",
    cursor: "pointer",
    pointerEvents: "none",
};
