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
}: ProfileWizardModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <style>
        {`
          .wizard-select {
            position: relative;
            z-index: 1;
          }
          .wizard-select:focus {
            z-index: 10;
          }
          .wizard-select option {
            background-color: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            padding: 4px 8px;
          }
        `}
      </style>
      <div
        className="modal"
        style={{
          maxWidth: "600px",
          width: "600px",
          maxHeight: "85vh",
          overflow: "visible",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        <h3 style={{ margin: "0 0 1rem 0", paddingBottom: "0.5rem" }}>{l10n.t("Profile Wizard")}</h3>

        <div style={{ flex: 1, overflow: "auto", paddingRight: "0.5rem", position: "relative" }}>
          {/* Root Profile Selection */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>{l10n.t("Root Profile")}:</label>
            <select
              value={wizardRootProfile}
              onChange={(e) => onRootProfileChange((e.target as HTMLSelectElement).value)}
              className="modal-input wizard-select"
              style={{
                width: "100%",
                height: "36px",
                position: "relative",
                zIndex: 1,
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
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>{l10n.t("Profile Name")}:</label>
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
                height: "36px",
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
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>{l10n.t("Profile Type")}:</label>
            <select
              value={wizardSelectedType}
              onChange={(e) => onSelectedTypeChange((e.target as HTMLSelectElement).value)}
              className="modal-input wizard-select"
              style={{
                width: "100%",
                height: "36px",
                position: "relative",
                zIndex: 1,
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

          {/* Properties Section */}
          <div
            style={{
              marginBottom: "1rem",
              minHeight: "120px",
              opacity: 1,
              pointerEvents: "auto",
            }}
          >
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>
              {l10n.t("Properties")} {wizardSelectedType ? `(${wizardSelectedType})` : ""}:
            </label>

            {/* Add New Property */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
              <div style={{ flex: 1, position: "relative" }}>
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
                    marginBottom: "0"!,
                  }}
                />
                {wizardNewPropertyKey.trim() && wizardProperties.some((prop) => prop.key === wizardNewPropertyKey.trim()) && (
                  <div
                    style={{
                      fontSize: "0.8em",
                      color: "#ff6b6b",
                      marginTop: "2px",
                      position: "absolute",
                      top: "100%",
                      left: 0,
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
                      zIndex: 9999,
                      maxHeight: "200px",
                      overflow: "auto",
                      backgroundColor: "var(--vscode-dropdown-background)",
                      margin: 0,
                      padding: 0,
                      listStyle: "none",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
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
              <div style={{ display: "flex", gap: "0.5rem" }}>
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
                  <span style={{ marginBottom: "4px" }} className={`codicon ${wizardNewPropertySecure ? "codicon-lock" : "codicon-unlock"}`}></span>
                </button>
                <button
                  onClick={onAddProperty}
                  disabled={
                    !wizardNewPropertyKey.trim() ||
                    !wizardNewPropertyValue.trim() ||
                    wizardProperties.some((prop) => prop.key === wizardNewPropertyKey.trim())
                  }
                  style={{
                    padding: "0.5rem 1rem",
                    height: "32px",
                    minWidth: "60px",
                  }}
                >
                  {l10n.t("Add")}
                </button>
              </div>
            </div>

            {/* Properties List */}
            <div
              style={{
                padding: "0.25rem",
                minHeight: "60px",
                maxHeight: "200px",
                overflow: "auto",
              }}
            >
              {wizardProperties.length > 0 ? (
                wizardProperties.map((prop, index) => {
                  const propertyType = getPropertyType(prop.key);
                  return (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        minHeight: "32px",
                        padding: "4px 0",
                      }}
                    >
                      <span style={{ fontWeight: "bold", flex: 1, display: "flex", alignItems: "center" }}>{prop.key}:</span>
                      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
                          {prop.secure ? (
                            <span style={{ display: "flex", alignItems: "center", height: "28px" }}>********</span>
                          ) : propertyType === "boolean" ? (
                            <select
                              value={stringifyValueByType(prop.value)}
                              onChange={(e) => onPropertyValueChange(index, (e.target as HTMLSelectElement).value)}
                              className="modal-input"
                              style={{
                                height: "28px",
                                fontSize: "0.9em",
                                padding: "2px 6px",
                                marginBottom: "0",
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
                                fontSize: "0.9em",
                                padding: "2px 6px",
                                marginBottom: "0",
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
                                fontSize: "0.9em",
                                padding: "2px 6px",
                                marginBottom: "0",
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
                            marginLeft: "0.5rem",
                          }}
                          title={prop.secure ? "Secure (click to unsecure)" : "Unsecure (click to secure)"}
                        >
                          <span className={`codicon ${prop.secure ? "codicon-lock" : "codicon-unlock"}`} style={{ marginTop: "0" }}></span>
                        </button>
                      </div>
                      <button
                        onClick={() => onRemoveProperty(index)}
                        style={{
                          padding: "0.25rem 0.5rem",
                          marginLeft: "0.5rem",
                          minWidth: "32px",
                          height: "28px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <span className="codicon codicon-trash" style={{ marginTop: "0" }}></span>
                      </button>
                    </div>
                  );
                })
              ) : (
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
              )}
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
          <VSCodeButton
            onClick={onCancel}
            style={{
              padding: "0.5rem 1rem",
              minWidth: "80px",
              borderRadius: "4px",
            }}
          >
            {l10n.t("Cancel")}
          </VSCodeButton>
        </div>
      </div>
    </div>
  );
}
