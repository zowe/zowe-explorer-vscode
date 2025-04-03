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
import * as l10n from "@vscode/l10n";

export default function PersistentDropdownOptions({ handleChange }: Readonly<{ handleChange: Readonly<Function> }>): JSXInternal.Element {
  const dataPanelContext = useDataPanelContext();

  const options = [
    <VSCodeOption value="search" key="search">
      {l10n.t("Search History")}
    </VSCodeOption>,
    <VSCodeOption value="favorites" key="favorites">
      {l10n.t("Favorites")}
    </VSCodeOption>,
    <VSCodeOption value="fileHistory" key="fileHistory">
      {l10n.t("File History")}
    </VSCodeOption>,
    <VSCodeOption value="sessions" key="sessions">
      {l10n.t("Sessions")}
    </VSCodeOption>,
  ];

  const optionsEncodingHistory = [
    <VSCodeOption value="encodingHistory" key="encodingHistory">
      {l10n.t("Encoding History")}
    </VSCodeOption>,
  ].filter((option) => dataPanelContext.type === "uss" || dataPanelContext.type === "ds" || option.props.value !== "encodingHistory");

  const searchKeywordsHistory = [
    <VSCodeOption value="searchedKeywordHistory" key="searchedKeywordHistory">
      {l10n.t("Search Keyword History")}
    </VSCodeOption>,
  ].filter((option) => dataPanelContext.type === "ds" || option.props.value !== "searchedKeywordHistory");

  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", margin: "15px 15px 15px 0px" }}>
      <VSCodeDropdown id="dropdown-persistent-items" style={{ maxWidth: "20vw" }} onChange={(event: any) => handleChange(event.target.value)}>
        {options}
        {optionsEncodingHistory}
        {searchKeywordsHistory}
      </VSCodeDropdown>
    </div>
  );
}
