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

import type {
    VscodeButton,
    VscodeCheckbox,
    VscodeDivider,
    VscodeLabel,
    VscodeOption,
    VscodeProgressRing,
    VscodeSingleSelect,
    VscodeTabHeader,
    VscodeTabPanel,
    VscodeTable,
    VscodeTableBody,
    VscodeTableCell,
    VscodeTableHeader,
    VscodeTableHeaderCell,
    VscodeTableRow,
    VscodeTabs,
    VscodeTextarea,
    VscodeTextfield,
} from "@vscode-elements/elements";
import type { VscTabsSelectEvent } from "@vscode-elements/elements/dist/vscode-tabs/vscode-tabs.js";

/** Public properties of a VS Code Elements class, combined with the standard Preact HTML attributes (events, `ref`, `slot`, etc.). */
type VscProps<T extends HTMLElement> = Partial<Omit<T, keyof HTMLElement | "style" | "children">> & preact.JSX.HTMLAttributes<T>;

declare module "preact" {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace JSX {
        interface IntrinsicElements {
            "vscode-button": VscProps<VscodeButton>;
            "vscode-checkbox": VscProps<VscodeCheckbox>;
            "vscode-divider": VscProps<VscodeDivider>;
            "vscode-label": VscProps<VscodeLabel>;
            "vscode-option": VscProps<VscodeOption>;
            "vscode-progress-ring": VscProps<VscodeProgressRing>;
            "vscode-single-select": VscProps<VscodeSingleSelect>;
            "vscode-tab-header": VscProps<VscodeTabHeader>;
            "vscode-tab-panel": VscProps<VscodeTabPanel>;
            "vscode-table": VscProps<VscodeTable>;
            "vscode-table-body": VscProps<VscodeTableBody>;
            "vscode-table-cell": VscProps<VscodeTableCell>;
            "vscode-table-header": VscProps<VscodeTableHeader>;
            "vscode-table-header-cell": VscProps<VscodeTableHeaderCell>;
            "vscode-table-row": VscProps<VscodeTableRow>;
            "vscode-tabs": VscProps<VscodeTabs> & { "onvsc-tabs-select"?: (event: VscTabsSelectEvent) => void };
            "vscode-textarea": VscProps<VscodeTextarea>;
            "vscode-textfield": VscProps<VscodeTextfield>;
        }
    }
}
