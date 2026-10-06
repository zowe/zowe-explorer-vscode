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

import { useState, useEffect, useRef } from "react";

export function useElementWidth<T extends HTMLElement = HTMLDivElement>() {
    const ref = useRef<T>(null);
    const [width, setWidth] = useState<number>(0);

    useEffect(() => {
        if (!ref.current) return;
        setWidth(ref.current.getBoundingClientRect().width);
        const observer = new ResizeObserver((entries) => {
            if (entries[0]) {
                setWidth(entries[0].contentRect.width);
            }
        });
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    return [ref, width] as const;
}
