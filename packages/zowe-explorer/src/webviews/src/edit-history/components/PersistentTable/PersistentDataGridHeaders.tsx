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

import { JSXInternal } from "preact/src/jsx";
import { SELECTABLE_HISTORY_TYPES, useDataPanelContext } from "../PersistentUtils";
import * as l10n from "@vscode/l10n";

export default function PersistentDataGridHeaders(): JSXInternal.Element {
  const { type, selection } = useDataPanelContext();
  const itemText = l10n.t("Item");

  const renderSelectHeader = () => {
    const deleteText = l10n.t("Select");
    return SELECTABLE_HISTORY_TYPES.includes(selection[type]) ? (
      <vscode-table-header-cell style={{ textAlign: "center" }}>{deleteText}</vscode-table-header-cell>
    ) : null;
  };

  return (
    <vscode-table-header slot="header">
      <vscode-table-header-cell>{itemText}</vscode-table-header-cell>
      {renderSelectHeader()}
    </vscode-table-header>
  );
}
