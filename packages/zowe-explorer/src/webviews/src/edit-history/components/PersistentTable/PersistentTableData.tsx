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

import { VSCodeDataGridCell, VSCodeDataGridRow } from "@vscode/webview-ui-toolkit/react";
import { JSXInternal } from "preact/src/jsx";
import { useDataPanelContext } from "../PersistentUtils";
import PersistentVSCodeAPI from "../PersistentVSCodeAPI";

export default function PersistentTableData({ persistentProp }: { persistentProp: string[] }): JSXInternal.Element {
  const { type, selection } = useDataPanelContext();

  const handleClick = (item: number) => {
    PersistentVSCodeAPI.getVSCodeAPI().postMessage({
      command: "remove-item",
      attrs: {
        name: persistentProp[item],
        type,
        selection: selection[type],
      },
    });
  };

  const renderDeleteButton = (i: number) => {
    return selection[type] === "search" || selection[type] === "fileHistory" ? (
      <VSCodeDataGridCell grid-column="2" onClick={() => handleClick(i)} style={{ maxWidth: "20vw", textAlign: "center" }}>
        <img src="./webviews/src/edit-history/assets/trash.svg" />
      </VSCodeDataGridCell>
    ) : null;
  };

  const renderOptions = () => {
    return persistentProp.map((item, i) => {
      return (
        <VSCodeDataGridRow>
          <VSCodeDataGridCell grid-column="1">{item}</VSCodeDataGridCell>
          {renderDeleteButton(i)}
        </VSCodeDataGridRow>
      );
    });
  };

  const renderNoRecordsFound = () => {
    return (
      <VSCodeDataGridRow>
        <VSCodeDataGridCell grid-column="1">No records found</VSCodeDataGridCell>
      </VSCodeDataGridRow>
    );
  };

  const data = persistentProp && persistentProp.length ? renderOptions() : renderNoRecordsFound();

  return <>{data}</>;
}
