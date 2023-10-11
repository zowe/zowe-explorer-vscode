import { useEffect, useState } from "preact/hooks";
import { VSCodeDivider, VSCodePanels, VSCodePanelTab } from "@vscode/webview-ui-toolkit/react";
import { JSXInternal } from "preact/src/jsx";
import PersistentDataPanel from "./components/PersistentTable/PersistentDataPanel";
import PersistentVSCodeAPI from "./components/PersistentVSCodeAPI";
import PersistentManagerHeader from "./components/PersistentManagerHeader/PersistentManagerHeader";
import { isSecureOrigin } from "./components/PersistentUtils";

export function App(): JSXInternal.Element {
  const [timestamp, setTimestamp] = useState<Date | undefined>();
  const [currentTab, setCurrentTab] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    window.addEventListener("message", (event) => {
      if (!isSecureOrigin(event.origin)) {
        return;
      }
      if ("tab" in event.data) {
        setCurrentTab(() => ({
          tab: event.data.tab,
        }));
      }
      setTimestamp(new Date());
    });
    PersistentVSCodeAPI.getVSCodeAPI().postMessage({ command: "ready" });
  }, []);

  return (
    <div>
      <PersistentManagerHeader timestamp={timestamp} />
      <VSCodeDivider />
      <VSCodePanels activeid={currentTab.tab}>
        <VSCodePanelTab id="ds-panel-tab">
          <h2>Data Sets</h2>
        </VSCodePanelTab>
        <VSCodePanelTab id="uss-panel-tab">
          <h2>Unix System Services (USS)</h2>
        </VSCodePanelTab>
        <VSCodePanelTab id="jobs-panel-tab">
          <h2>Jobs</h2>
        </VSCodePanelTab>
        <PersistentDataPanel type="ds" />
        <PersistentDataPanel type="uss" />
        <PersistentDataPanel type="jobs" />
      </VSCodePanels>
    </div>
  );
}
