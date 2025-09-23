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

import { useCallback } from "react";
import * as l10n from "@vscode/l10n";

// Types
type Configuration = {
  configPath: string;
  properties: any;
  secure: string[];
  global?: boolean;
  user?: boolean;
  schemaPath?: string;
};

type PendingDefault = {
  value: string;
  path: string[];
};

// Props interface for the renderDefaults component
interface RenderDefaultsProps {
  defaults: { [key: string]: any };
  configurations: Configuration[];
  selectedTab: number | null;
  pendingDefaults: { [configPath: string]: { [key: string]: PendingDefault } };
  defaultsDeletions: { [configPath: string]: string[] };
  renames: { [configPath: string]: { [originalKey: string]: string } };

  // Handler functions
  handleDefaultsChange: (key: string, value: string) => void;

  // Utility functions
  getWizardTypeOptions: () => string[];
  getAvailableProfilesByType: (profileType: string) => string[];
}

export const RenderDefaults = ({
  defaults,
  configurations,
  selectedTab,
  pendingDefaults,
  defaultsDeletions,
  renames,
  handleDefaultsChange,
  getWizardTypeOptions,
  getAvailableProfilesByType,
}: RenderDefaultsProps) => {
  const renderDefaults = useCallback(
    (defaults: { [key: string]: any }) => {
      if (!defaults || typeof defaults !== "object") return null;

      // Get all available property types from the schema
      const availableTypes = getWizardTypeOptions();

      // Create a complete defaults object with all available types
      const completeDefaults = { ...defaults };
      availableTypes.forEach((type: string) => {
        if (!(type in completeDefaults)) {
          completeDefaults[type] = "";
        }
      });

      const combinedDefaults = {
        ...completeDefaults,
        ...Object.fromEntries(
          Object.entries(pendingDefaults[configurations[selectedTab!]!.configPath] ?? {})
            .filter(([key]) => !(key in completeDefaults))
            .map(([key, entry]) => [key, entry.value])
        ),
      };

      return (
        <div>
          {/* Render defaults */}
          {Object.entries(combinedDefaults)
            .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
            .map(([key, value]) => {
              const currentPath = [key];
              const fullKey = currentPath.join(".");
              if (defaultsDeletions[configurations[selectedTab!]!.configPath]?.includes(fullKey)) return null;
              const isParent = typeof value === "object" && value !== null && !Array.isArray(value);
              const isArray = Array.isArray(value);
              // Calculate pending value considering both explicit pending defaults and simulated defaults from renames
              const getEffectiveDefaultValue = (profileType: string): string => {
                const configPath = configurations[selectedTab!]!.configPath;

                // Check explicit pending defaults first
                const pendingDefault = pendingDefaults[configPath]?.[profileType];
                if (pendingDefault) {
                  return pendingDefault.value;
                }

                // Check existing defaults
                const config = configurations[selectedTab!].properties;
                const defaults = config.defaults || {};
                let defaultValue = defaults[profileType];

                // Apply renames to the default value (simulate backend logic)
                if (defaultValue) {
                  const configRenames = renames[configPath] || {};
                  for (const [originalKey, newKey] of Object.entries(configRenames)) {
                    if (defaultValue === originalKey) {
                      defaultValue = newKey;
                      break;
                    }
                  }
                }

                return defaultValue || "";
              };

              const pendingValue = (pendingDefaults[configurations[selectedTab!]!.configPath] ?? {})[fullKey]?.value ?? getEffectiveDefaultValue(key);

              if (isParent) {
                return (
                  <div key={fullKey} className="config-item parent">
                    <h3 className={`header-level-${currentPath.length}`}>{key}</h3>
                    {renderDefaults(value)}
                  </div>
                );
              } else if (isArray) {
                return (
                  <div key={fullKey} className="config-item">
                    <h3 className={`header-level-${currentPath.length}`}>
                      <span className="config-label" style={{ fontWeight: "bold" }}>
                        {key}
                      </span>
                    </h3>
                    <div>
                      {value
                        .sort((a: any, b: any) => String(a).localeCompare(String(b)))
                        .map((item: any, index: number) => (
                          <div className="list-item" key={index}>
                            {item}
                          </div>
                        ))}
                    </div>
                  </div>
                );
              } else {
                const availableProfiles = getAvailableProfilesByType(key);
                const selectedProfileExists = availableProfiles.includes(String(pendingValue));
                const displayValue = selectedProfileExists ? String(pendingValue) : "";

                return (
                  <div key={fullKey} className="config-item">
                    <div className="config-item-container defaults-container">
                      <span className="config-label">{key}</span>
                      <select
                        id={`default-dropdown-${key}`}
                        className={`config-input ${!displayValue ? "placeholder-style" : ""}`}
                        value={displayValue}
                        onChange={(e) => handleDefaultsChange(fullKey, (e.target as HTMLSelectElement).value)}
                        style={{
                          width: "100%",
                          height: "28px",
                          fontSize: "0.9em",
                          padding: "2px 6px",
                          marginBottom: "0",
                          minWidth: "150px",
                        }}
                      >
                        <option value="">{l10n.t("Select a profile")}</option>
                        {availableProfiles.map((profile) => (
                          <option key={profile} value={profile}>
                            {profile === "root" ? "/" : profile}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              }
            })}
        </div>
      );
    },
    [
      getWizardTypeOptions,
      pendingDefaults,
      configurations,
      selectedTab,
      defaultsDeletions,
      handleDefaultsChange,
      l10n,
      renames,
      getAvailableProfilesByType,
    ]
  );

  return renderDefaults(defaults);
};
