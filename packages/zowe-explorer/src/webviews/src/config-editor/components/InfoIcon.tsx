/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 * Info icon with a click-to-show tooltip for Config Editor field help.
 * The description text comes from zowe.schema.json (via schemaValidations → propertyDescriptions).
 */

import { useState, useCallback } from "react";
import * as l10n from "@vscode/l10n";
import { useAnchoredTooltip } from "../hooks/useAnchoredTooltip";

interface InfoIconProps {
  fieldKey: string;
  description: string;
  defaultValue?: unknown;
}

export function InfoIcon({ fieldKey, description, defaultValue }: InfoIconProps) {
  const [visible, setVisible] = useState(false);
  const close = useCallback(() => setVisible(false), []);
  const { style, anchorRef: iconRef, tooltipRef } = useAnchoredTooltip(visible, close);

  return (
    <span className="field-info-icon-container">
      <button
        ref={iconRef}
        className="info-icon-button"
        aria-label={l10n.t("Help for {0}", fieldKey)}
        aria-expanded={visible}
        onClick={(e) => {
          e.stopPropagation();
          setVisible((v) => !v);
        }}
        title={l10n.t("Click for help")}
      >
        <span className="codicon codicon-info"></span>
      </button>

      {visible && (
        <div ref={tooltipRef} className="field-help-tooltip" style={style} role="tooltip">
          <div className="help-section">
            <p>{description}</p>
          </div>
          {defaultValue !== undefined && (
            <div className="help-section">
              <strong>{l10n.t("Default")}</strong>
              <code>{String(defaultValue)}</code>
            </div>
          )}
        </div>
      )}
    </span>
  );
}
