import { VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react";
import { useEffect } from "preact/hooks";
import { JSXInternal } from "preact/src/jsx";

export default function PersistentDropdownOptions({ handleChange, type }: { handleChange: Function; type: string }): JSXInternal.Element {
  useEffect(() => {
    console.log("change");
  });

  const options = [
    <VSCodeOption value="search">Search History</VSCodeOption>,
    <VSCodeOption value="dsTemplates">DS Templates</VSCodeOption>,
    <VSCodeOption value="favorites">Favorites</VSCodeOption>,
    <VSCodeOption value="fileHistory">File History</VSCodeOption>,
    <VSCodeOption value="sessions">Sessions</VSCodeOption>,
  ].filter((option) => type === "ds" || option.props.value !== "dsTemplates");

  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", margin: "15px 15px 15px 0px" }}>
      <VSCodeDropdown id="dropdown-persistent-items" style={{ maxWidth: "20vw" }} onChange={(event: any) => handleChange(event.target.value)}>
        {options}
      </VSCodeDropdown>
    </div>
  );
}
