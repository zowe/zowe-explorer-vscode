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

export const panelId: { [key: string]: string } = {
    ds: "ds-panel-view",
    uss: "uss-panel-view",
    jobs: "jobs-panel-view",
    cmds: "cmds-panel-view",
};

export type DataPanelContextType = {
    type: string;
    selection: { [type: string]: string };
    selectedItems: {
        val: { [type: string]: boolean };
        setVal: (newVal: any) => void;
    };
};
