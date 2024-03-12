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

import { VSCodeCheckbox, VSCodeDataGridCell, VSCodeDataGridRow } from "@vscode/webview-ui-toolkit/react";
import { JSXInternal } from "preact/src/jsx";
import { useDataPanelContext } from "../PersistentUtils";
import { useEffect, useState } from "preact/hooks";
import isEqual from "lodash.isequal";

export default function PersistentTableData({ persistentProp }: Readonly<{ persistentProp: readonly string[] }>): JSXInternal.Element {
  const { type, selection, selectedItems } = useDataPanelContext();
  const [oldPersistentProp, setOldPersistentProp] = useState<readonly string[]>([]);

  useEffect(() => {
    if (!isEqual(oldPersistentProp, persistentProp) && persistentProp) {
      const newSelectedItemsList: { [key: string]: boolean } = {};
      persistentProp.forEach((prop) => {
        newSelectedItemsList[prop] = false;
      });
      selectedItems.setVal(newSelectedItemsList);
      setOldPersistentProp(persistentProp);
    }
  }, [persistentProp]);

  const handleClick = (event: any, item: number) => {
    selectedItems.setVal({ ...selectedItems.val, [persistentProp[item]]: !event.target.checked });
  };

  const renderSelectButton = (item: string, i: number) => {
    return selection[type] === "search" || selection[type] === "fileHistory" || selection[type] === "encodingHistory" ? (
      <VSCodeDataGridCell grid-column="2" style={{ maxWidth: "20vw", textAlign: "center" }}>
        <VSCodeCheckbox key={`${i}${item}`} onClick={(event: any) => handleClick(event, i)}></VSCodeCheckbox>
      </VSCodeDataGridCell>
    ) : null;
  };

  const renderOptions = () => {
    return persistentProp.map((item, i) => {
      return (
        <VSCodeDataGridRow key={item}>
          <VSCodeDataGridCell grid-column="1">{item}</VSCodeDataGridCell>
          {renderSelectButton(item, i)}
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

  const data = persistentProp?.length ? renderOptions() : renderNoRecordsFound();

  return <>{data}</>;
}
