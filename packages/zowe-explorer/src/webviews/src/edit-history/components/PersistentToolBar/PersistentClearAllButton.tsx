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

import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { JSXInternal } from "preact/src/jsx";
import { useDataPanelContext } from "../PersistentUtils";
import PersistentVSCodeAPI from "../PersistentVSCodeAPI";
import * as nls from "vscode-nls";

const localize: nls.LocalizeFunc = nls.loadMessageBundle();

export default function PersistentClearAllButton(): JSXInternal.Element {
  const { type, selection } = useDataPanelContext();

  const handleClick = () => {
    PersistentVSCodeAPI.getVSCodeAPI().postMessage({
      command: "clear-all",
      attrs: {
        type,
        selection: selection[type],
      },
    });
  };

  const renderClearAllButton = () => {
    const clearAllText = localize("PersistentClearAllButton.clearAll", "Clear All");

    return selection[type] === "search" || selection[type] === "fileHistory" ? (
      <VSCodeButton title={clearAllText} appearance="secondary" style={{ maxWidth: "20vw", marginRight: "15px" }} onClick={handleClick}>
        Clear All
      </VSCodeButton>
    ) : null;
  };

  return <>{renderClearAllButton()}</>;
}
