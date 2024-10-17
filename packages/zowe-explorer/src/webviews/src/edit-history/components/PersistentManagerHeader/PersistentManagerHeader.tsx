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
import * as l10n from "@vscode/l10n";

export default function PersistentManagerHeader({ timestamp }: Readonly<{ timestamp: Readonly<Date | undefined> }>): JSXInternal.Element {
  const renderTimestamp = () => {
    return (
      timestamp && (
        <p style={{ fontStyle: "italic", marginRight: "1em" }}>
          {l10n.t("Last refreshed:")} {timestamp.toLocaleString(navigator.language)}
        </p>
      )
    );
  };

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <h1>{l10n.t("Manage Persistent Properties")}</h1>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>{renderTimestamp()}</div>
    </div>
  );
}
