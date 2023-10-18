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

export default function PersistentDropdownOptions({ handleChange }: { handleChange: Readonly<Function> }): JSXInternal.Element {
  const dataPanelContext = useDataPanelContext();

  const options = [
    <VSCodeOption value="search" key="search">
      Search History
    </VSCodeOption>,
    <VSCodeOption value="dsTemplates" key="dsTemplates">
      DS Templates
    </VSCodeOption>,
    <VSCodeOption value="favorites" key="favorites">
      Favorites
    </VSCodeOption>,
    <VSCodeOption value="fileHistory" key="fileHistory">
      File History
    </VSCodeOption>,
    <VSCodeOption value="sessions" key="sessions">
      Sessions
    </VSCodeOption>,
  ].filter((option) => dataPanelContext.type === "ds" || option.props.value !== "dsTemplates");

  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", margin: "15px 15px 15px 0px" }}>
      <VSCodeDropdown id="dropdown-persistent-items" style={{ maxWidth: "20vw" }} onChange={(event: any) => handleChange(event.target.value)}>
        {options}
      </VSCodeDropdown>
    </div>
  );
}
