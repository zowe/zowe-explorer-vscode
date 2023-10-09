import { useEffect, useState } from "preact/hooks";
import { VSCodePanels, VSCodePanelTab } from "@vscode/webview-ui-toolkit/react";
import { JSXInternal } from "preact/src/jsx";
import PersistentDataPanel from "./components/PersistentDataPanel";
import PersistentVSCodeAPI from "./components/PersistentVSCodeAPI";

export function App(): JSXInternal.Element {
  const [currentTab, setCurrentTab] = useState<{ [key: string]: string }>({});
  const [data, setData] = useState<{ [type: string]: { [property: string]: string[] } }>({ ds: {}, uss: {}, jobs: {} });

  useEffect(() => {
    window.addEventListener("message", (event) => {
      const eventUrl = new URL(event.origin);
      const isWebUser =
        (eventUrl.protocol === document.location.protocol && eventUrl.hostname === document.location.hostname) ||
        eventUrl.hostname.endsWith(".github.dev");
      const isLocalVSCodeUser = eventUrl.protocol === "vscode-webview:";

      if (!isWebUser && !isLocalVSCodeUser) {
        return;
      }
      setData(event.data);
      if ("tab" in event.data) {
        setCurrentTab(() => ({
          tab: event.data.tab,
        }));
      }
    });
    PersistentVSCodeAPI.getVSCodeAPI().postMessage({ command: "ready" });
  }, []);

  return (
    <div>
      <h1>Manage Persistent Properties</h1>
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
        <PersistentDataPanel data={data} type="ds" />
        <PersistentDataPanel data={data} type="uss" />
        <PersistentDataPanel data={data} type="jobs" />
      </VSCodePanels>
    </div>
  );
}
