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
 */

import { useState, useRef, useEffect } from "react";
import type { FieldHelp } from "../help/FieldHelpContent";

interface InfoIconProps {
  fieldKey: string;
  helpContent: FieldHelp;
}

export function InfoIcon({ fieldKey, helpContent }: InfoIconProps) {
  const [visible, setVisible] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const iconRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Position tooltip relative to viewport when shown
  useEffect(() => {
    if (!visible || !iconRef.current || !tooltipRef.current) return;

    const iconRect = iconRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = iconRect.top;
    let left = iconRect.right + 10;

    // Flip left if tooltip would overflow right edge
    if (left + tooltipRect.width > vw - 16) {
      left = iconRect.left - tooltipRect.width - 10;
    }

    // Clamp left edge
    if (left < 8) left = 8;

    // Flip above if tooltip would overflow bottom edge
    if (top + tooltipRect.height > vh - 16) {
      top = vh - tooltipRect.height - 16;
    }

    if (top < 8) top = 8;

    setStyle({ top: `${top}px`, left: `${left}px` });
  }, [visible]);

  // Close tooltip when clicking outside
  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (iconRef.current && !iconRef.current.contains(e.target as Node) && tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setVisible(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [visible]);

  return (
    <span className="field-info-icon-container">
      <button
        ref={iconRef}
        className="info-icon-button"
        aria-label={`Help for ${fieldKey}`}
        aria-expanded={visible}
        onClick={(e) => {
          e.stopPropagation();
          setVisible((v) => !v);
        }}
        title="Click for help"
      >
        <span className="codicon codicon-info"></span>
      </button>

      {visible && (
        <div ref={tooltipRef} className="field-help-tooltip" style={style} role="tooltip">
          <div className="help-section">
            <p>{helpContent.description}</p>
          </div>

          {helpContent.exampleValue && (
            <div className="help-section">
              <strong>Example</strong>
              <code>{helpContent.exampleValue}</code>
            </div>
          )}

          {helpContent.validationRules && (
            <div className="help-section">
              <strong>Notes</strong>
              <p>{helpContent.validationRules}</p>
            </div>
          )}

          {helpContent.required && (
            <div className="help-required">
              <strong>Required field</strong>
            </div>
          )}
        </div>
      )}
    </span>
  );
}
