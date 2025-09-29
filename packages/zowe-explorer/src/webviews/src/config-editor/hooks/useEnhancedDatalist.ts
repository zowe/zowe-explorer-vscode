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

import { useEffect } from "react";

export function useEnhancedDatalist(inputId: string | null, datalistId: string) {
    useEffect(() => {
        if (!inputId) return;

        const timeout = setTimeout(() => {
            const input = document.getElementById(inputId) as HTMLInputElement | null;
            const datalist = document.getElementById(datalistId) as HTMLDataListElement | null;
            if (!input || !datalist) return;

            const options = Array.from(datalist.options);
            let currentFocus = -1;

            const showOptions = () => {
                datalist.style.display = "block";
                input.style.borderRadius = "5px 5px 0 0";
            };

            const hideOptions = () => {
                datalist.style.display = "none";
                input.style.borderRadius = "5px";
            };

            const filterOptions = () => {
                const text = input.value.toUpperCase();
                currentFocus = -1;
                options.forEach((option) => {
                    option.style.display = option.value.toUpperCase().includes(text) ? "block" : "none";
                });
            };

            const addActive = (x: HTMLOptionElement[]) => {
                removeActive(x);
                if (currentFocus >= x.length) currentFocus = 0;
                if (currentFocus < 0) currentFocus = x.length - 1;
                x[currentFocus].classList.add("active");
            };

            const removeActive = (x: HTMLOptionElement[]) => {
                x.forEach((opt) => opt.classList.remove("active"));
            };

            const onKeyDown = (e: KeyboardEvent) => {
                if (e.key === "ArrowDown") {
                    currentFocus++;
                    addActive(options as HTMLOptionElement[]);
                } else if (e.key === "ArrowUp") {
                    currentFocus--;
                    addActive(options as HTMLOptionElement[]);
                } else if (e.key === "Enter") {
                    e.preventDefault();
                    if (currentFocus > -1) {
                        (options[currentFocus] as HTMLOptionElement)?.click();
                    }
                }
            };

            const onClick = (option: HTMLOptionElement) => {
                input.value = option.value;
                hideOptions();
            };

            input.addEventListener("focus", showOptions);
            input.addEventListener("input", filterOptions);
            input.addEventListener("keydown", onKeyDown);
            options.forEach((opt) => opt.addEventListener("click", () => onClick(opt)));

            return () => {
                input.removeEventListener("focus", showOptions);
                input.removeEventListener("input", filterOptions);
                input.removeEventListener("keydown", onKeyDown);
                options.forEach((opt) => opt.removeEventListener("click", () => onClick(opt)));
            };
        }, 0);

        return () => clearTimeout(timeout);
    }, [inputId, datalistId]);
}
