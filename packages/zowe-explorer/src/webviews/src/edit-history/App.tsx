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
import { VSCodeDivider, VSCodePanels, VSCodePanelTab } from "@vscode/webview-ui-toolkit/react";
import { JSXInternal } from "preact/src/jsx";
import { isSecureOrigin } from "../utils";
import PersistentDataPanel from "./components/PersistentTable/PersistentDataPanel";
import PersistentVSCodeAPI from "./components/PersistentVSCodeAPI";
import PersistentManagerHeader from "./components/PersistentManagerHeader/PersistentManagerHeader";
import * as l10n from "@vscode/l10n";

export function App(): JSXInternal.Element {
  const [timestamp, setTimestamp] = useState<Date | undefined>();
  const [currentTab, setCurrentTab] = useState<{ [key: string]: string }>({});
  const [localization, setLocalization] = useState<string | undefined>("");

  useEffect(() => {
    window.addEventListener("message", (event) => {
      if (!isSecureOrigin(event.origin)) {
        return;
      }
      if (event.data.command === "GET_LOCALIZATION") {
        const { contents } = event.data;
        l10n.config({
          contents: contents,
        });
        setLocalization(contents);
      }
      if ("tab" in event.data) {
        setCurrentTab(() => ({
          tab: event.data.tab,
        }));
      }
      setTimestamp(new Date());
    });
    PersistentVSCodeAPI.getVSCodeAPI().postMessage({ command: "GET_LOCALIZATION" });
    PersistentVSCodeAPI.getVSCodeAPI().postMessage({ command: "ready" });
  }, [localization]);

  return (
    <div>
      <PersistentManagerHeader timestamp={timestamp} />
      <VSCodeDivider />
      <VSCodePanels activeid={currentTab.tab}>
        <VSCodePanelTab id="ds-panel-tab">
          <h2>{l10n.t("Data Sets")}</h2>
        </VSCodePanelTab>
        <VSCodePanelTab id="uss-panel-tab">
          <h2>{l10n.t("Unix System Services (USS)")}</h2>
        </VSCodePanelTab>
        <VSCodePanelTab id="jobs-panel-tab">
          <h2>{l10n.t("Jobs")}</h2>
        </VSCodePanelTab>
        <PersistentDataPanel type="ds" />
        <PersistentDataPanel type="uss" />
        <PersistentDataPanel type="jobs" />
      </VSCodePanels>
    </div>
  );
}
