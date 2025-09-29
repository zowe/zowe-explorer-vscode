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

import React, { useState, useEffect, useRef, useCallback, ChangeEvent } from "react";
import * as l10n from "@vscode/l10n";

interface EnvVarAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  vscodeApi: any;
  dataPropertyKey?: string;
}

export const EnvVarAutocomplete: React.FC<EnvVarAutocompleteProps> = ({
  value,
  onChange,
  onKeyDown,
  className = "",
  placeholder,
  disabled = false,
  style,
  vscodeApi,
  dataPropertyKey,
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getCurrentVarName = useCallback((val: string) => {
    const match = val.match(/^\$([A-Za-z_][A-Za-z0-9_]*)/);
    return match ? match[1] : "";
  }, []);

  const requestEnvVars = useCallback(
    (query: string = "") => {
      if (!vscodeApi) return;

      setIsLoading(true);
      vscodeApi.postMessage({
        command: "GET_ENV_VARS",
        query: query.toLowerCase(),
      });
    },
    [vscodeApi]
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.command === "ENV_VARS_RESPONSE") {
        setSuggestions(event.data.envVars || []);
        setIsLoading(false);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const newValue = (e.target as HTMLInputElement).value;
      onChange(newValue);

      const varName = getCurrentVarName(newValue);
      if (varName) {
        setShowSuggestions(true);
        requestEnvVars(varName);
      } else {
        setShowSuggestions(false);
        setSuggestions([]);
      }
    },
    [onChange, getCurrentVarName, requestEnvVars]
  );

  const handleInputFocus = useCallback(() => {
    const varName = getCurrentVarName(value);
    if (varName) {
      setShowSuggestions(true);
      requestEnvVars(varName);
    }
  }, [value, getCurrentVarName, requestEnvVars]);

  const handleInputBlur = useCallback(() => {
    setTimeout(() => {
      if (!dropdownRef.current?.contains(document.activeElement)) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    }, 150);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!showSuggestions || suggestions.length === 0) {
        onKeyDown?.(e);
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
            const suggestion = suggestions[selectedIndex];
            const varName = getCurrentVarName(value);
            const newValue = value.replace(`$${varName}`, `$${suggestion}`);
            onChange(newValue);
            setShowSuggestions(false);
            setSelectedIndex(-1);
          }
          break;
        case "Escape":
          setShowSuggestions(false);
          setSelectedIndex(-1);
          break;
        default:
          onKeyDown?.(e);
          break;
      }
    },
    [showSuggestions, suggestions, selectedIndex, value, onChange, getCurrentVarName, onKeyDown]
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      const varName = getCurrentVarName(value);
      const newValue = value.replace(`$${varName}`, `$${suggestion}`);
      onChange(newValue);
      setShowSuggestions(false);
      setSelectedIndex(-1);
      inputRef.current?.focus();
    },
    [value, onChange, getCurrentVarName]
  );

  const filteredSuggestions = suggestions.filter((suggestion) => suggestion.toLowerCase().includes(getCurrentVarName(value).toLowerCase()));

  return (
    <div className="env-var-autocomplete-container" style={{ position: "relative" }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        onKeyDown={handleKeyDown}
        className={`env-var-input ${className}`}
        placeholder={placeholder}
        disabled={disabled}
        style={style}
        data-property-key={dataPropertyKey}
      />

      {showSuggestions && (
        <div
          ref={dropdownRef}
          className="env-var-suggestions"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 1000,
            backgroundColor: "var(--vscode-dropdown-background)",
            border: "1px solid var(--vscode-dropdown-border)",
            borderRadius: "4px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
            maxHeight: "200px",
            overflowY: "auto",
          }}
        >
          {isLoading ? (
            <div className="env-var-suggestion-item" style={{ padding: "8px 12px", color: "var(--vscode-descriptionForeground)" }}>
              {l10n.t("Loading...")}
            </div>
          ) : filteredSuggestions.length > 0 ? (
            filteredSuggestions.map((suggestion, index) => (
              <div
                key={suggestion}
                className={`env-var-suggestion-item ${index === selectedIndex ? "selected" : ""}`}
                onClick={() => handleSuggestionClick(suggestion)}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  backgroundColor: index === selectedIndex ? "var(--vscode-list-activeSelectionBackground)" : "transparent",
                  color: index === selectedIndex ? "var(--vscode-list-activeSelectionForeground)" : "var(--vscode-foreground)",
                }}
              >
                <div style={{ fontWeight: "500" }}>${suggestion}</div>
              </div>
            ))
          ) : (
            <div className="env-var-suggestion-item" style={{ padding: "8px 12px", color: "var(--vscode-descriptionForeground)" }}>
              {l10n.t("No environment variables found")}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
