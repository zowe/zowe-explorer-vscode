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

import { JSXInternal } from "preact/src/jsx";
import { useDataPanelContext } from "../PersistentUtils";
import * as l10n from "@vscode/l10n";

export default function PersistentDropdownOptions({ handleChange }: Readonly<{ handleChange: Readonly<Function> }>): JSXInternal.Element {
  const dataPanelContext = useDataPanelContext();

  const options = [
    <vscode-option value="search" key="search">
      {l10n.t("Search History")}
    </vscode-option>,
    <vscode-option value="favorites" key="favorites">
      {l10n.t("Favorites")}
    </vscode-option>,
    <vscode-option value="fileHistory" key="fileHistory">
      {l10n.t("File History")}
    </vscode-option>,
    <vscode-option value="sessions" key="sessions">
      {l10n.t("Sessions")}
    </vscode-option>,
  ];

  const optionsEncodingHistory = [
    <vscode-option value="encodingHistory" key="encodingHistory">
      {l10n.t("Encoding History")}
    </vscode-option>,
  ].filter((option) => dataPanelContext.type === "uss" || dataPanelContext.type === "ds" || option.props.value !== "encodingHistory");

  const searchKeywordsHistory = [
    <vscode-option value="searchedKeywordHistory" key="searchedKeywordHistory">
      {l10n.t("Search Keyword History")}
    </vscode-option>,
  ].filter((option) => dataPanelContext.type === "ds" || option.props.value !== "searchedKeywordHistory");

  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", margin: "15px 15px 15px 0px" }}>
      <vscode-single-select
        id="dropdown-persistent-items"
        style={{ maxWidth: "20vw" }}
        value={dataPanelContext.selection[dataPanelContext.type]}
        onChange={(event) => handleChange(event.currentTarget.value)}
      >
        {options}
        {optionsEncodingHistory}
        {searchKeywordsHistory}
      </vscode-single-select>
    </div>
  );
}
