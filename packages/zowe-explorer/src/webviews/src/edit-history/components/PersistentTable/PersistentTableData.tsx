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
import { useEffect, useState } from "preact/hooks";
import { isEqual } from "es-toolkit";
import * as l10n from "@vscode/l10n";

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

  const renderSelectButton = (item: string, i: number) => {
    return SELECTABLE_HISTORY_TYPES.includes(selection[type]) ? (
      <vscode-table-cell style={{ textAlign: "center" }}>
        <vscode-checkbox
          key={`${i}${item}`}
          checked={!!selectedItems.val[item]}
          onChange={(event) => selectedItems.setVal({ ...selectedItems.val, [item]: event.currentTarget.checked })}
        ></vscode-checkbox>
      </vscode-table-cell>
    ) : null;
  };

  const renderOptions = () => {
    return persistentProp.map((item, i) => {
      return (
        <vscode-table-row key={item}>
          <vscode-table-cell>{item}</vscode-table-cell>
          {renderSelectButton(item, i)}
        </vscode-table-row>
      );
    });
  };

  const renderNoRecordsFound = () => {
    return (
      <vscode-table-row>
        <vscode-table-cell>{l10n.t("No records found")}</vscode-table-cell>
      </vscode-table-row>
    );
  };

  const data = persistentProp?.length ? renderOptions() : renderNoRecordsFound();

  return <vscode-table-body slot="body">{data}</vscode-table-body>;
}
