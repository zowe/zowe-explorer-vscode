import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { JSXInternal } from "preact/src/jsx";
import * as nls from "vscode-nls";
import { useDataPanelContext } from "../PersistentUtils";

const localize: nls.LocalizeFunc = nls.loadMessageBundle();

export default function PersistentSelectAllButton(): JSXInternal.Element {
  const selectAllText = localize("PersistentSelectAllButton.selectAll", "Select All");

  const { selectAll } = useDataPanelContext();

  const handleClick = () => {
    selectAll.setVal(!selectAll.val);
  };

  return (
    <VSCodeButton title={selectAllText} appearance="secondary" style={{ maxWidth: "20vw", marginRight: "15px" }} onClick={() => handleClick()}>
      <img src="./webviews/src/edit-history/assets/checklist.svg" />
    </VSCodeButton>
  );
}
