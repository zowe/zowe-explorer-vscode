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

import type { Table } from "@zowe/zowe-explorer-api";
import { AgGridReactProps } from "ag-grid-react";

export const tableProps = (tableData: Table.Data): Partial<AgGridReactProps> => ({
    enableCellTextSelection: true,
    ensureDomOrder: true,
    rowData: tableData.rows,
    columnDefs: tableData.columns,
    pagination: true,
});
