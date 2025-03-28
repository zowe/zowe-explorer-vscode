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

import { VSCodeDataGridRow, VSCodeDataGridCell } from "@vscode/webview-ui-toolkit/react";
import { JSXInternal } from "preact/src/jsx";
import { useDataPanelContext } from "../PersistentUtils";
import * as l10n from "@vscode/l10n";

export default function PersistentDataGridHeaders(): JSXInternal.Element {
  const { type, selection } = useDataPanelContext();
  const itemText = l10n.t("Item");

  const renderSelectHeader = () => {
    const deleteText = l10n.t("Select");
    return selection[type] === "search" || selection[type] === "fileHistory" || selection[type] === "searchedKeywordHistory" ? (
      <VSCodeDataGridCell cell-type="columnheader" grid-column="2" style={{ maxWidth: "20vw", textAlign: "center" }}>
        {deleteText}
      </VSCodeDataGridCell>
    ) : null;
  };

  return (
    <VSCodeDataGridRow row-type="header">
      <VSCodeDataGridCell cell-type="columnheader" grid-column="1">
        {itemText}
      </VSCodeDataGridCell>
      {renderSelectHeader()}
    </VSCodeDataGridRow>
  );
}
