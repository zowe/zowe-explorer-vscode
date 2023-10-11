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

import { VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react";
import { JSXInternal } from "preact/src/jsx";
import { useDataPanelContext } from "../PersistentUtils";

export default function PersistentDropdownOptions({ handleChange }: { handleChange: Function }): JSXInternal.Element {
  const dataPanelContext = useDataPanelContext();

  const options = [
    <VSCodeOption value="search">Search History</VSCodeOption>,
    <VSCodeOption value="dsTemplates">DS Templates</VSCodeOption>,
    <VSCodeOption value="favorites">Favorites</VSCodeOption>,
    <VSCodeOption value="fileHistory">File History</VSCodeOption>,
    <VSCodeOption value="sessions">Sessions</VSCodeOption>,
  ].filter((option) => dataPanelContext.type === "ds" || option.props.value !== "dsTemplates");

  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", margin: "15px 15px 15px 0px" }}>
      <VSCodeDropdown id="dropdown-persistent-items" style={{ maxWidth: "20vw" }} onChange={(event: any) => handleChange(event.target.value)}>
        {options}
      </VSCodeDropdown>
    </div>
  );
}
