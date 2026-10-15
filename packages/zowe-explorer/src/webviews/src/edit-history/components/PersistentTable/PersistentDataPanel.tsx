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

import { useEffect, useMemo, useState } from "preact/hooks";
import { JSXInternal } from "preact/src/jsx";
import { DataPanelContext, SELECTABLE_HISTORY_TYPES } from "../PersistentUtils";
import { isSecureOrigin } from "../../../utils";
import { panelId } from "../../types";
import PersistentToolBar from "../PersistentToolBar/PersistentToolBar";
import PersistentTableData from "./PersistentTableData";
import PersistentDataGridHeaders from "./PersistentDataGridHeaders";
import PersistentVSCodeAPI from "../../../PersistentVSCodeAPI";
import * as l10n from "@vscode/l10n";

type HistoryData = { [property: string]: string[] } & { groupLabel?: { key: string; source: "host" | "group" } };

export default function PersistentDataPanel({ type }: Readonly<{ type: Readonly<string> }>): JSXInternal.Element {
  const [data, setData] = useState<{ [type: string]: HistoryData }>({ ds: {}, uss: {}, jobs: {} });
  const [selection, setSelection] = useState<{ [type: string]: string }>({ [type]: "search" });
  const [persistentProp, setPersistentProp] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState({});

  const selectedItemsMemo = useMemo(
    () => ({
      val: selectedItems,
      setVal: (newVal: any) => setSelectedItems(newVal),
    }),
    [selectedItems]
  );

  const handleChange = (newSelection: string) => {
    setSelection(() => ({ [type]: newSelection }));
    PersistentVSCodeAPI.getVSCodeAPI().postMessage({
      command: "update-selection",
      attrs: {
        selection: newSelection,
        type,
      },
    });
    const newSelectedItems: { [key: string]: boolean } = { ...selectedItemsMemo.val };
    Object.keys(newSelectedItems).forEach((item) => {
      newSelectedItems[item] = false;
    });
    selectedItemsMemo.setVal(newSelectedItems);
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!isSecureOrigin(event.origin)) {
        return;
      }
      if (event.data.ds && event.data.uss && event.data.jobs) {
        setData(event.data);

        if ("selection" in event.data) {
          setSelection(() => ({
            [type]: event.data.selection[type],
          }));
        }
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [type]);

  useEffect(() => {
    if (data[type] && selection[type]) {
      setPersistentProp(() => data[type][selection[type]] || []);
    }
  }, [data, selection, type]);

  const groupLabel = selection[type] === "search" ? data[type]?.groupLabel : undefined;
  const showSelectColumn = SELECTABLE_HISTORY_TYPES.includes(selection[type]);

  if (type == "cmds") {
    return (
      <DataPanelContext.Provider value={{ type, selection, selectedItems: selectedItemsMemo }}>
        <vscode-tab-panel id={panelId[type]} style={{ flexDirection: "column", minHeight: "100vh" }}>
          <h1>Coming soon!</h1>
        </vscode-tab-panel>
      </DataPanelContext.Provider>
    );
  }
  return (
    <DataPanelContext.Provider value={{ type, selection, selectedItems: selectedItemsMemo }}>
      <vscode-tab-panel id={panelId[type]} style={{ flexDirection: "column", minHeight: "100vh" }}>
        <PersistentToolBar handleChange={handleChange} />
        {groupLabel && (
          <p>
            {groupLabel.source === "host"
              ? l10n.t("Showing history grouped by host: {0}", groupLabel.key)
              : l10n.t("Showing history grouped by: {0}", groupLabel.key)}
          </p>
        )}
        {/* The table only measures its header cells once, so remount it when the number of columns changes */}
        <vscode-table key={showSelectColumn ? "with-select" : "item-only"} columns={showSelectColumn ? ["auto", "120px"] : ["auto"]}>
          <PersistentDataGridHeaders />
          <PersistentTableData persistentProp={persistentProp} />
        </vscode-table>
      </vscode-tab-panel>
    </DataPanelContext.Provider>
  );
}
