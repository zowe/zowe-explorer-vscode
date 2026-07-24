/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 * Click-to-show indicator for a merged/inherited property, replacing a native `title` tooltip
 * (which is finicky to trigger and can't contain a "go to source" action) with a persistent
 * icon and a stable popover.
 */

import { useState, useCallback } from "react";
import * as l10n from "@vscode/l10n";
import { useAnchoredTooltip } from "../../hooks/useAnchoredTooltip";

interface InheritedFromIndicatorProps {
  profilePath: string;
  configPath: string;
  onNavigate?: () => void;
}

export function InheritedFromIndicator({ profilePath, configPath, onNavigate }: InheritedFromIndicatorProps) {
  const [visible, setVisible] = useState(false);
  const close = useCallback(() => setVisible(false), []);
  const { style, anchorRef, tooltipRef } = useAnchoredTooltip(visible, close);

  return (
    <span className="field-info-icon-container">
      <button
        ref={anchorRef}
        className="info-icon-button"
        aria-label={l10n.t("Inherited from {0}", profilePath)}
        aria-expanded={visible}
        onClick={(e) => {
          e.stopPropagation();
          setVisible((v) => !v);
        }}
        title={l10n.t("Inherited property")}
      >
        <span className="codicon codicon-link"></span>
      </button>

      {visible && (
        <div ref={tooltipRef} className="field-help-tooltip" style={style} role="tooltip">
          <div className="help-section">
            <strong>{l10n.t("Inherited from")}</strong>
            <p>{profilePath}</p>
            <p>{configPath}</p>
          </div>
          {onNavigate && (
            <button
              className="tutorial-button tutorial-button-secondary"
              onClick={(e) => {
                e.stopPropagation();
                setVisible(false);
                onNavigate();
              }}
            >
              {l10n.t("Go to source")}
            </button>
          )}
        </div>
      )}
    </span>
  );
}
