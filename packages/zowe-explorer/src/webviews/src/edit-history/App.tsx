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

import { useEffect, useState } from "preact/hooks";
import { JSXInternal } from "preact/src/jsx";
import { isSecureOrigin } from "../utils";
import PersistentDataPanel from "./components/PersistentTable/PersistentDataPanel";
import PersistentVSCodeAPI from "../PersistentVSCodeAPI";
import PersistentManagerHeader from "./components/PersistentManagerHeader/PersistentManagerHeader";
import * as l10n from "@vscode/l10n";

/** Tab ids sent by the extension (see `Constants.HISTORY_VIEW_TABS`), in the order the tabs are rendered. */
const TAB_IDS = ["ds-panel-tab", "uss-panel-tab", "jobs-panel-tab", "cmds-panel-tab"];

export function App(): JSXInternal.Element {
  const [timestamp, setTimestamp] = useState<Date | undefined>();
  const [tabIndex, setTabIndex] = useState<number>(0);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!isSecureOrigin(event.origin)) {
        return;
      }
      if (!event.data) {
        return;
      }
      if ("tab" in event.data) {
        const index = TAB_IDS.indexOf(event.data.tab);
        if (index !== -1) {
          setTabIndex(index);
        }
      }
      setTimestamp(new Date());
      if (event.data.command === "GET_LOCALIZATION") {
        const { contents } = event.data;
        l10n.config({
          contents: contents,
        });
      }
    };

    window.addEventListener("message", handleMessage);
    PersistentVSCodeAPI.getVSCodeAPI().postMessage({ command: "ready" });
    PersistentVSCodeAPI.getVSCodeAPI().postMessage({ command: "GET_LOCALIZATION" });

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  return (
    <div>
      <PersistentManagerHeader timestamp={timestamp} />
      <vscode-divider />
      <vscode-tabs selectedIndex={tabIndex} onvsc-tabs-select={(event) => setTabIndex(event.detail.selectedIndex)}>
        <vscode-tab-header slot="header" id="ds-panel-tab">
          <h2>{l10n.t("Data Sets")}</h2>
        </vscode-tab-header>
        <vscode-tab-header slot="header" id="uss-panel-tab">
          <h2>{l10n.t("Unix System Services (USS)")}</h2>
        </vscode-tab-header>
        <vscode-tab-header slot="header" id="jobs-panel-tab">
          <h2>{l10n.t("Jobs")}</h2>
        </vscode-tab-header>
        <vscode-tab-header slot="header" id="cmds-panel-tab">
          <h2>Zowe Commands</h2>
        </vscode-tab-header>
        <PersistentDataPanel type="ds" />
        <PersistentDataPanel type="uss" />
        <PersistentDataPanel type="jobs" />
        <PersistentDataPanel type="cmds" />
      </vscode-tabs>
    </div>
  );
}
