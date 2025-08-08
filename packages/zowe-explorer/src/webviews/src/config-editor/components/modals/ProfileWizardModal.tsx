import * as l10n from "@vscode/l10n";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";

interface ProfileWizardModalProps {
  isOpen: boolean;
  wizardRootProfile: string;
  wizardSelectedType: string;
  wizardProfileName: string;
  wizardProperties: { key: string; value: string | boolean | number | Object; secure?: boolean }[];
  wizardShowKeyDropdown: boolean;
  wizardNewPropertyKey: string;
  wizardNewPropertyValue: string;
  wizardNewPropertySecure: boolean;
  wizardMergedProperties: { [key: string]: any };
  availableProfiles: string[];
  typeOptions: string[];
  propertyOptions: string[];
  isProfileNameTaken: boolean;
  onRootProfileChange: (value: string) => void;
  onSelectedTypeChange: (value: string) => void;
  onProfileNameChange: (value: string) => void;
  onNewPropertyKeyChange: (value: string) => void;
  onNewPropertyValueChange: (value: string) => void;
  onNewPropertySecureToggle: () => void;
  onShowKeyDropdownChange: (value: boolean) => void;
  onAddProperty: () => void;
  onRemoveProperty: (index: number) => void;
  onPropertyValueChange: (index: number, value: string) => void;
  onPropertySecureToggle: (index: number) => void;
  onCreateProfile: () => void;
  onCancel: () => void;
  getPropertyType: (propertyKey: string) => string | undefined;
  stringifyValueByType: (value: string | number | boolean | Object) => string;
  onFilePickerSelect?: (filePath: string) => void;
  vscodeApi: any;
}

export function ProfileWizardModal({
  isOpen,
  wizardRootProfile,
  wizardSelectedType,
  wizardProfileName,
  wizardProperties,
  wizardShowKeyDropdown,
  wizardNewPropertyKey,
  wizardNewPropertyValue,
  wizardNewPropertySecure,
  wizardMergedProperties,
  availableProfiles,
  typeOptions,
  propertyOptions,
  isProfileNameTaken,
  onRootProfileChange,
  onSelectedTypeChange,
  onProfileNameChange,
  onNewPropertyKeyChange,
  onNewPropertyValueChange,
  onNewPropertySecureToggle,
  onShowKeyDropdownChange,
  onAddProperty,
  onRemoveProperty,
  onPropertyValueChange,
  onPropertySecureToggle,
  onCreateProfile,
  onCancel,
  getPropertyType,
  stringifyValueByType,
  vscodeApi,
}: ProfileWizardModalProps) {
  if (!isOpen) return null;

  const isFileProperty = (key: string): boolean => {
    // Check if key is defined and not null
    if (!key || typeof key !== "string") {
      return false;
    }

    // Keys that are file paths
    const filePaths = ["privateKey", "certFile", "certKeyFile"];
    for (const path of filePaths) {
      if (key.toLowerCase() === path.toLowerCase()) {
        return true;
      }
    }
    return false;
  };

  return (
    <div className="modal-backdrop">
      <style>
        {`
          .wizard-select {
            position: relative;
            z-index: 1;
            display: flex;
            align-items: center;
            padding: 0 8px;
            line-height: 32px;
          }
          .wizard-select:focus {
            z-index: 10;
          }
          .wizard-select option {
            background-color: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            padding: 4px 8px;
            line-height: 1.2;
          }
        `}
      </style>
      <div
        className="modal"
        style={{
          maxWidth: "900px",
          width: "900px",
          maxHeight: "85vh",
          overflow: "visible",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          zIndex: 1,
        }}
      >
        <h3 style={{ margin: "0 0 1rem 0", paddingBottom: "0.5rem" }}>{l10n.t("Profile Wizard")}</h3>

        <div style={{ flex: 1, display: "flex", gap: "1rem", overflow: "visible" }}>
          {/* Left Column */}
          <div style={{ flex: "0 0 300px", display: "flex", flexDirection: "column", gap: "1rem", position: "relative" }}>
            {/* Root Profile Selection */}
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold", fontSize: "0.9em" }}>{l10n.t("Root Profile")}:</label>
              <select
                value={wizardRootProfile}
                onChange={(e) => onRootProfileChange((e.target as HTMLSelectElement).value)}
                className="modal-input wizard-select"
                style={{
                  width: "100%",
                  height: "32px",
                  position: "relative",
                  zIndex: 1,
                  padding: "0 8px",
                  lineHeight: "32px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {availableProfiles.map((profile) => (
                  <option key={profile} value={profile}>
                    {profile === "root" ? "/" : profile}
                  </option>
                ))}
              </select>
            </div>

            {/* Profile Name */}
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold", fontSize: "0.9em" }}>{l10n.t("Profile Name")}:</label>
              <input
                type="text"
                value={wizardProfileName}
                onKeyDown={(e) => {
                  // Allow: backspace, delete, tab, escape, enter, and navigation keys
                  if ([8, 9, 27, 13, 46, 37, 38, 39, 40].includes(e.keyCode)) {
                    return;
                  }
                  // Allow: alphanumeric characters and underscore
                  if (/^[a-zA-Z0-9_]$/.test(e.key)) {
                    return;
                  }
                  // Prevent all other keys
                  e.preventDefault();
                }}
                onChange={(e) => onProfileNameChange((e.target as HTMLInputElement).value)}
                className="modal-input"
                placeholder={l10n.t("Enter profile name")}
                style={{
                  width: "100%",
                  height: "32px",
                  borderColor: isProfileNameTaken ? "#ff6b6b" : undefined,
                }}
              />
              {isProfileNameTaken && (
                <div
                  style={{
                    fontSize: "0.8em",
                    color: "#ff6b6b",
                    marginTop: "2px",
                  }}
                >
                  {l10n.t("Profile name already exists under this root")}
                </div>
              )}
            </div>

            {/* Type Selection */}
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold", fontSize: "0.9em" }}>{l10n.t("Profile Type")}:</label>
              <select
                value={wizardSelectedType}
                onChange={(e) => onSelectedTypeChange((e.target as HTMLSelectElement).value)}
                className="modal-input wizard-select"
                style={{
                  width: "100%",
                  height: "32px",
                  position: "relative",
                  zIndex: 1,
                  padding: "0 8px",
                  lineHeight: "32px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <option value="">{l10n.t("Select a type")}</option>
                {typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Add New Property */}
            <div style={{ marginTop: "auto" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold", fontSize: "0.9em" }}>
                {l10n.t("Add Property")} {wizardSelectedType ? `(${wizardSelectedType})` : ""}:
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={wizardNewPropertyKey}
                    onChange={(e) => {
                      onNewPropertyKeyChange((e.target as HTMLInputElement).value);
                      onShowKeyDropdownChange(true);
                    }}
                    onFocus={() => onShowKeyDropdownChange(true)}
                    onBlur={() => setTimeout(() => onShowKeyDropdownChange(false), 100)}
                    className="modal-input"
                    placeholder={l10n.t("Property key")}
                    style={{
                      height: "32px",
                      borderColor:
                        wizardNewPropertyKey.trim() && wizardProperties.some((prop) => prop.key === wizardNewPropertyKey.trim())
                          ? "#ff6b6b"
                          : undefined,
                    }}
                  />
                  {wizardNewPropertyKey.trim() && wizardProperties.some((prop) => prop.key === wizardNewPropertyKey.trim()) && (
                    <div
                      style={{
                        fontSize: "0.8em",
                        color: "#ff6b6b",
                        marginTop: "2px",
                      }}
                    >
                      {l10n.t("Property key already exists")}
                    </div>
                  )}
                  {wizardShowKeyDropdown && (
                    <ul
                      className="dropdown-list"
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        zIndex: 10000,
                        maxHeight: "200px",
                        overflow: "auto",
                        backgroundColor: "var(--vscode-dropdown-background)",
                        margin: 0,
                        padding: 0,
                        listStyle: "none",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                        border: "1px solid var(--vscode-dropdown-border)",
                        borderRadius: "4px",
                      }}
                    >
                      {propertyOptions
                        .filter((opt) => opt.toLowerCase().includes(wizardNewPropertyKey.toLowerCase()))
                        .map((option, index) => (
                          <li
                            key={index}
                            className="dropdown-item"
                            style={{
                              padding: "8px 12px",
                              cursor: "pointer",
                            }}
                            onMouseDown={() => {
                              onNewPropertyKeyChange(option);
                              onShowKeyDropdownChange(false);
                            }}
                          >
                            {option}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {(() => {
                    const propertyType = getPropertyType(wizardNewPropertyKey.trim());
                    if (propertyType === "boolean") {
                      return (
                        <select
                          value={wizardNewPropertyValue}
                          onChange={(e) => onNewPropertyValueChange((e.target as HTMLSelectElement).value)}
                          className="modal-input"
                          style={{ flex: 1, height: "32px" }}
                        >
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      );
                    } else if (propertyType === "number") {
                      return (
                        <input
                          type="number"
                          value={wizardNewPropertyValue}
                          onChange={(e) => onNewPropertyValueChange((e.target as HTMLInputElement).value)}
                          className="modal-input"
                          placeholder={l10n.t("Property value")}
                          style={{ flex: 1, height: "32px" }}
                        />
                      );
                    } else {
                      return (
                        <input
                          type="text"
                          value={wizardNewPropertyValue}
                          onChange={(e) => onNewPropertyValueChange((e.target as HTMLInputElement).value)}
                          className="modal-input"
                          placeholder={l10n.t("Property value")}
                          style={{ flex: 1, height: "32px" }}
                        />
                      );
                    }
                  })()}
                  <div style={{ display: "flex", gap: "0.25rem" }}>
                    <button
                      onClick={onNewPropertySecureToggle}
                      style={{
                        padding: "0.25rem",
                        height: "32px",
                        width: "32px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: wizardNewPropertySecure ? "var(--vscode-button-background)" : "var(--vscode-button-secondaryBackground)",
                        color: wizardNewPropertySecure ? "var(--vscode-button-foreground)" : "var(--vscode-button-secondaryForeground)",
                        border: "1px solid var(--vscode-button-border)",
                        borderRadius: "4px",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                      title={wizardNewPropertySecure ? "Secure (click to unsecure)" : "Unsecure (click to secure)"}
                    >
                      <span className={`codicon ${wizardNewPropertySecure ? "codicon-lock" : "codicon-unlock"}`}></span>
                    </button>
                    {wizardNewPropertyKey && isFileProperty(wizardNewPropertyKey.trim()) && (
                      <button
                        onClick={() => {
                          // Use VS Code's showOpenDialog API to get the full file path
                          if (vscodeApi) {
                            vscodeApi.postMessage({
                              command: "SELECT_FILE",
                              propertyIndex: -1, // -1 indicates new property
                              isNewProperty: true,
                              source: "wizard",
                            });
                          } else {
                            // Fallback to HTML file input if VS Code API is not available
                            const input = document.createElement("input");
                            input.type = "file";
                            input.accept = "*";

                            input.onchange = (event) => {
                              const target = event.target as HTMLInputElement;
                              if (target.files && target.files.length > 0) {
                                const file = target.files[0];
                                // In a webview context, we can't get the full file path directly
                                // We'll use the file name and let the user know they may need to provide the full path
                                const fileName = file.name;
                                // Try to get additional path info if available
                                const filePath = (file as any).webkitRelativePath || fileName;
                                onNewPropertyValueChange(filePath);
                              }
                            };

                            input.click();
                          }
                        }}
                        style={{
                          padding: "0.25rem",
                          height: "32px",
                          width: "32px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "var(--vscode-button-secondaryBackground)",
                          color: "var(--vscode-button-secondaryForeground)",
                          border: "1px solid var(--vscode-button-border)",
                          borderRadius: "4px",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                        title="Select file"
                      >
                        <span className="codicon codicon-folder-opened"></span>
                      </button>
                    )}
                  </div>
                </div>
                <button
                  onClick={onAddProperty}
                  disabled={
                    !wizardNewPropertyKey.trim() ||
                    !wizardNewPropertyValue.trim() ||
                    wizardProperties.some((prop) => prop.key === wizardNewPropertyKey.trim())
                  }
                  style={{
                    padding: "0.5rem",
                    height: "32px",
                    width: "100%",
                  }}
                >
                  {l10n.t("Add Property")}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column - Properties List */}
          <div style={{ flex: "0 0 60%", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold", fontSize: "0.9em" }}>
              {l10n.t("Properties")} {wizardSelectedType ? `(${wizardSelectedType})` : ""}:
            </label>
            <div
              style={{
                flex: 1,
                border: "1px solid var(--vscode-input-border)",
                borderRadius: "4px",
                padding: "0.5rem",
                overflow: "auto",
                backgroundColor: "transparent",
                minHeight: "200px",
                maxHeight: "400px",
              }}
            >
              {/* Combined Properties - User properties take precedence over inherited ones */}
              {(() => {
                // Get user property keys to check for overrides
                const userPropertyKeys = new Set(wizardProperties.map((prop) => prop.key));

                // Get schema properties for the selected type
                const schemaProperties = wizardSelectedType ? propertyOptions || [] : [];

                // Filter inherited properties to only show ones not overridden by user AND that exist in the schema
                const filteredInheritedProperties =
                  wizardSelectedType && Object.keys(wizardMergedProperties).length > 0
                    ? Object.entries(wizardMergedProperties).filter(([key]) => !userPropertyKeys.has(key) && schemaProperties.includes(key))
                    : [];

                return (
                  <>
                    {/* Inherited Properties (not overridden) */}
                    {filteredInheritedProperties.map(([key, propData]) => (
                      <div
                        key={`inherited-${key}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          minHeight: "32px",
                          padding: "6px 8px",
                          marginBottom: "4px",
                          backgroundColor: "var(--vscode-input-background)",
                          borderRadius: "4px",
                          opacity: 0.6,
                          border: "1px solid var(--vscode-input-border)",
                        }}
                      >
                        <span
                          style={{
                            fontWeight: "bold",
                            flex: "0 0 180px",
                            fontSize: "1em",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {key}:
                        </span>
                        <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
                          {propData.secure ? (
                            <span
                              style={{
                                flex: 1,
                                height: "28px",
                                display: "flex",
                                alignItems: "center",
                                padding: "0 8px",
                                backgroundColor: "var(--vscode-input-background)",
                                border: "1px solid var(--vscode-input-border)",
                                borderRadius: "2px",
                                fontSize: "0.95em",
                                color: "var(--vscode-descriptionForeground)",
                                cursor: "not-allowed",
                                opacity: 0.8,
                              }}
                            >
                              ********
                            </span>
                          ) : (
                            <span
                              style={{
                                flex: 1,
                                height: "28px",
                                display: "flex",
                                alignItems: "center",
                                padding: "0 8px",
                                backgroundColor: "var(--vscode-input-background)",
                                border: "1px solid var(--vscode-input-border)",
                                borderRadius: "2px",
                                fontSize: "0.95em",
                                color: "var(--vscode-descriptionForeground)",
                                cursor: "not-allowed",
                                opacity: 0.8,
                              }}
                            >
                              {typeof propData.value === "object" ? JSON.stringify(propData.value) : String(propData.value)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* User-added Properties */}
                    {wizardProperties.length > 0
                      ? wizardProperties.map((prop, index) => {
                          const propertyType = getPropertyType(prop.key);
                          return (
                            <div
                              key={index}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                minHeight: "32px",
                                padding: "6px 8px",
                                marginBottom: "4px",
                                backgroundColor: "var(--vscode-input-background)",
                                borderRadius: "4px",
                                border: "1px solid var(--vscode-input-border)",
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: "bold",
                                  flex: "0 0 180px",
                                  fontSize: "1em",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {prop.key}:
                              </span>
                              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
                                  {prop.secure ? (
                                    <span style={{ display: "flex", alignItems: "center", height: "28px", fontSize: "0.95em" }}>********</span>
                                  ) : propertyType === "boolean" ? (
                                    <select
                                      value={stringifyValueByType(prop.value)}
                                      onChange={(e) => onPropertyValueChange(index, (e.target as HTMLSelectElement).value)}
                                      className="modal-input"
                                      style={{
                                        height: "28px",
                                        fontSize: "0.95em",
                                        padding: "2px 6px",
                                        marginBottom: "0",
                                        flex: 1,
                                      }}
                                    >
                                      <option value="true">true</option>
                                      <option value="false">false</option>
                                    </select>
                                  ) : propertyType === "number" ? (
                                    <input
                                      type="number"
                                      value={stringifyValueByType(prop.value)}
                                      onChange={(e) => onPropertyValueChange(index, (e.target as HTMLInputElement).value)}
                                      className="modal-input"
                                      style={{
                                        height: "28px",
                                        fontSize: "0.95em",
                                        padding: "2px 6px",
                                        marginBottom: "0",
                                        flex: 1,
                                      }}
                                    />
                                  ) : (
                                    <input
                                      type="text"
                                      value={stringifyValueByType(prop.value)}
                                      onChange={(e) => onPropertyValueChange(index, (e.target as HTMLInputElement).value)}
                                      className="modal-input"
                                      style={{
                                        height: "28px",
                                        fontSize: "0.95em",
                                        padding: "2px 6px",
                                        marginBottom: "0",
                                        flex: 1,
                                      }}
                                    />
                                  )}
                                </div>
                                <button
                                  onClick={() => onPropertySecureToggle(index)}
                                  style={{
                                    padding: "0.25rem",
                                    height: "28px",
                                    width: "28px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor: prop.secure ? "var(--vscode-button-background)" : "var(--vscode-button-secondaryBackground)",
                                    color: prop.secure ? "var(--vscode-button-foreground)" : "var(--vscode-button-secondaryForeground)",
                                    border: "1px solid var(--vscode-button-border)",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    transition: "all 0.2s ease",
                                  }}
                                  title={prop.secure ? "Secure (click to unsecure)" : "Unsecure (click to secure)"}
                                >
                                  <span className={`codicon ${prop.secure ? "codicon-lock" : "codicon-unlock"}`} style={{ fontSize: "1em" }}></span>
                                </button>
                                <button
                                  onClick={() => onRemoveProperty(index)}
                                  style={{
                                    padding: "0.25rem",
                                    height: "28px",
                                    width: "28px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor: "var(--vscode-button-secondaryBackground)",
                                    color: "var(--vscode-button-secondaryForeground)",
                                    border: "1px solid var(--vscode-button-border)",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    transition: "all 0.2s ease",
                                  }}
                                >
                                  <span className="codicon codicon-trash" style={{ fontSize: "1em" }}></span>
                                </button>
                              </div>
                            </div>
                          );
                        })
                      : null}
                  </>
                );
              })()}

              {/* Show "No properties added yet" only when there are no properties at all */}
              {(() => {
                const userPropertyKeys = new Set(wizardProperties.map((prop) => prop.key));
                const schemaProperties = wizardSelectedType ? propertyOptions || [] : [];
                const filteredInheritedProperties =
                  wizardSelectedType && Object.keys(wizardMergedProperties).length > 0
                    ? Object.entries(wizardMergedProperties).filter(([key]) => !userPropertyKeys.has(key) && schemaProperties.includes(key))
                    : [];

                const hasAnyProperties = wizardProperties.length > 0 || filteredInheritedProperties.length > 0;

                return !hasAnyProperties ? (
                  <div
                    style={{
                      color: "#666",
                      fontStyle: "italic",
                      textAlign: "center",
                      padding: "1rem",
                    }}
                  >
                    {l10n.t("No properties added yet")}
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        </div>

        <div
          className="modal-actions"
          style={{
            marginTop: "0.5rem",
            paddingTop: "0.5rem",
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.5rem",
          }}
        >
          <VSCodeButton
            onClick={onCancel}
            appearance="secondary"
            style={{
              padding: "0.5rem 1rem",
              minWidth: "80px",
              borderRadius: "4px",
            }}
          >
            {l10n.t("Cancel")}
          </VSCodeButton>
          <VSCodeButton
            onClick={onCreateProfile}
            disabled={!wizardProfileName.trim() || isProfileNameTaken}
            style={{
              padding: "0.5rem 1rem",
              minWidth: "120px",
              borderRadius: "4px",
            }}
          >
            {l10n.t("Create Profile")}
          </VSCodeButton>
        </div>
      </div>
    </div>
  );
}
