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

import * as l10n from "@vscode/l10n";
import { AUTH_METHODS, isValidAuthOrder, parseAuthOrder, toggleAuthMethod } from "../utils/authOrder";

interface AuthOrderControlsProps {
  value: string;
  onChange: (value: string) => void;
  variant?: "property" | "wizard";
}

export function AuthOrderControls({ value, onChange, variant = "property" }: AuthOrderControlsProps) {
  const isWizard = variant === "wizard";
  const methods = parseAuthOrder(value);
  return (
    <div className="auth-order-buttons" id={isWizard ? "auth-order-buttons" : undefined}>
      <label className="auth-order-label" id={isWizard ? "auth-order-label" : undefined}>
        {l10n.t("Select Authentication Order")}
        {isWizard ? "" : ":"}
      </label>
      <div className="auth-order-button-container" id={isWizard ? "auth-order-button-container" : undefined}>
        {AUTH_METHODS.map(({ name, tooltip, icon }) => {
          const isSelected = methods.includes(name);
          return (
            <button
              key={name}
              id={isWizard ? `auth-method-${name}-button` : undefined}
              type="button"
              onClick={() => onChange(toggleAuthMethod(value, name))}
              className={`auth-order-button ${isSelected ? "selected" : ""}`}
              title={`${tooltip} (${isSelected ? "Click to remove" : "Click to add"})`}
            >
              {isWizard && <span className={`codicon ${icon}`} style={{ marginRight: "2px" }} />}
              {name}
            </button>
          );
        })}
      </div>
      {!isValidAuthOrder(value) && (
        <div className="auth-order-error" id={isWizard ? "auth-order-error" : undefined}>
          {l10n.t("Invalid format. Use: basic, token, bearer, cert-pem")}
        </div>
      )}
    </div>
  );
}
