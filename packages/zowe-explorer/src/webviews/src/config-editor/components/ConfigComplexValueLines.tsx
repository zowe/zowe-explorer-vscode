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

import type { CSSProperties, ReactNode } from "react";

/** Renders array/object/primitive previews for merged/simple property blobs in the config editor. */
export function configComplexValueLines(actualValue: unknown, disabledStyle: CSSProperties): ReactNode {
    if (Array.isArray(actualValue)) {
        return actualValue.map((item, index) => (
            <div key={index} className="config-complex-value-line" style={disabledStyle}>
                <span className="config-complex-value-line__label">{index}:</span>
                <span className="config-complex-value-line__value">{String(item)}</span>
            </div>
        ));
    }
    if (typeof actualValue === "object" && actualValue !== null) {
        return Object.entries(actualValue).map(([entryKey, val]) => (
            <div key={entryKey} className="config-complex-value-line" style={disabledStyle}>
                <span className="config-complex-value-line__label">{entryKey}:</span>
                <span className="config-complex-value-line__value">{String(val)}</span>
            </div>
        ));
    }
    return (
        <div className="config-complex-value-line" style={disabledStyle}>
            <span className="config-complex-value-line__value">{String(actualValue)}</span>
        </div>
    );
}
