import * as l10n from "@vscode/l10n";
import { useModalClickOutside } from "../../hooks";

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
  secureValuesAllowed: boolean;
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
  onPopulateDefaults: () => void;
  getPropertyType: (propertyKey: string) => string | undefined;
  canPropertyBeSecure: (propertyKey: string, path: string[]) => boolean;
  canPropertyBeSecureForWizard: (propertyKey: string, profileType: string) => boolean;
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
  secureValuesAllowed,
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
  onPopulateDefaults,
  getPropertyType,
  canPropertyBeSecure,
  canPropertyBeSecureForWizard,
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

  const { modalRef, handleBackdropMouseDown, handleBackdropClick } = useModalClickOutside(onCancel);

  return (
    <div className="modal-backdrop" onMouseDown={handleBackdropMouseDown} onClick={handleBackdropClick}>
      <div className="modal wizard-modal" ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <h3 className="wizard-title">{l10n.t("Profile Wizard")}</h3>
        <div className="wizard-content">
          {/* Left Column */}
          <div className="wizard-left-column">
            {/* Parent Profile Selection */}
            <div>
              <label className="wizard-label">{l10n.t("Parent Profile")}:</label>
              <select
                value={wizardRootProfile}
                onChange={(e) => onRootProfileChange((e.target as HTMLSelectElement).value)}
                className="modal-input wizard-select"
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
              <label className="wizard-label">{l10n.t("Profile Name")}:</label>
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
                className={`modal-input wizard-input ${isProfileNameTaken ? "error" : ""}`}
                placeholder={l10n.t("Enter profile name")}
              />
              {isProfileNameTaken && <div className="wizard-error">{l10n.t("Profile name already exists under this root")}</div>}
            </div>

            {/* Type Selection with Populate Defaults Button */}
            <div>
              <label className="wizard-label">{l10n.t("Profile Type")}:</label>
              <div style={{ display: "flex", gap: "8px", alignItems: "stretch" }}>
                <select
                  value={wizardSelectedType}
                  onChange={(e) => onSelectedTypeChange((e.target as HTMLSelectElement).value)}
                  className="modal-input wizard-select"
                  style={{ flex: 1 }}
                >
                  <option value="">{l10n.t("Select a type")}</option>
                  {typeOptions.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <button
                  onClick={onPopulateDefaults}
                  disabled={!wizardSelectedType}
                  className="wizard-button secondary"
                  style={{
                    padding: "4px 8px",
                    fontSize: "12px",
                    minWidth: "32px",
                    height: "32px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--vscode-button-border)",
                    borderRadius: "4px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  title="Populate defaults"
                >
                  <span className="codicon codicon-sparkle"></span>
                </button>
              </div>
            </div>

            {/* Add New Property */}
            <div className="wizard-add-property-section">
              <label className="wizard-label">
                {l10n.t("Add Property")} {wizardSelectedType ? `(${wizardSelectedType})` : ""}:
              </label>
              <div className="wizard-property-form">
                <div className="wizard-property-input-container">
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
                      className={`modal-input wizard-input ${
                        wizardNewPropertyKey.trim() && wizardProperties.some((prop) => prop.key === wizardNewPropertyKey.trim()) ? "error" : ""
                      }`}
                      placeholder={l10n.t("Property key")}
                      style={{ paddingRight: "2rem" }}
                    />
                    {wizardNewPropertyKey && (
                      <button onClick={() => onNewPropertyKeyChange("")} className="profile-clear-button" title="Clear input">
                        <span
                          className="codicon codicon-chrome-close"
                          style={{
                            fontSize: "12px",
                            lineHeight: 1,
                          }}
                        />
                      </button>
                    )}
                  </div>
                  {wizardNewPropertyKey.trim() && wizardProperties.some((prop) => prop.key === wizardNewPropertyKey.trim()) && (
                    <div className="wizard-error">{l10n.t("Property key already exists")}</div>
                  )}
                  {wizardShowKeyDropdown && (
                    <ul className="dropdown-list">
                      {propertyOptions
                        .filter((opt) => opt.toLowerCase().includes(wizardNewPropertyKey.toLowerCase()))
                        .map((option, index) => (
                          <li
                            key={index}
                            className="dropdown-item"
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
                <div className="wizard-property-value-row">
                  {(() => {
                    const propertyType = getPropertyType(wizardNewPropertyKey.trim());
                    if (wizardNewPropertySecure) {
                      return (
                        <input
                          type="password"
                          value={wizardNewPropertyValue}
                          onChange={(e) => onNewPropertyValueChange((e.target as HTMLInputElement).value)}
                          className="modal-input wizard-property-value-input"
                          placeholder="••••••••"
                        />
                      );
                    } else if (propertyType === "boolean") {
                      return (
                        <select
                          value={wizardNewPropertyValue}
                          onChange={(e) => onNewPropertyValueChange((e.target as HTMLSelectElement).value)}
                          className="modal-input wizard-property-value-input"
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
                          className="modal-input wizard-property-value-input"
                          placeholder={l10n.t("Property value")}
                        />
                      );
                    } else {
                      return (
                        <input
                          type="text"
                          value={wizardNewPropertyValue}
                          onChange={(e) => onNewPropertyValueChange((e.target as HTMLInputElement).value)}
                          className="modal-input wizard-property-value-input"
                          placeholder={l10n.t("Property value")}
                        />
                      );
                    }
                  })()}
                  <div className="wizard-property-buttons">
                    {wizardNewPropertyKey && isFileProperty(wizardNewPropertyKey.trim()) && (
                      <button
                        onClick={() => {
                          // Use VS Code's showOpenDialog API to get the full file path
                          if (vscodeApi) {
                            vscodeApi.postMessage({
                              command: "SELECT_FILE",
                              propertyIndex: -1,
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
                                const fileName = file.name;
                                const filePath = (file as any).webkitRelativePath || fileName;
                                onNewPropertyValueChange(filePath);
                              }
                            };

                            input.click();
                          }
                        }}
                        className="wizard-file-picker"
                        title="Select file"
                      >
                        <span className="codicon codicon-folder-opened"></span>
                      </button>
                    )}
                    {canPropertyBeSecureForWizard(wizardNewPropertyKey, wizardSelectedType) ? (
                      secureValuesAllowed ? (
                        <button
                          onClick={onNewPropertySecureToggle}
                          className={`wizard-secure-toggle ${wizardNewPropertySecure ? "active" : "inactive"}`}
                          title={wizardNewPropertySecure ? "Secure (click to unsecure)" : "Unsecure (click to secure)"}
                        >
                          <span className={`codicon ${wizardNewPropertySecure ? "codicon-lock" : "codicon-unlock"}`}></span>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            vscodeApi.postMessage({
                              command: "OPEN_VSCODE_SETTINGS",
                              searchText: "Zowe.vscode-extension-for-zowe Secure Credentials Enabled",
                            });
                          }}
                          className="wizard-secure-toggle inactive"
                          title="A credential manager is not available. Click to open VS Code settings to enable secure credentials."
                        >
                          <span className="codicon codicon-lock" style={{ opacity: 0.5 }}></span>
                        </button>
                      )
                    ) : null}
                  </div>
                </div>
                <button
                  onClick={onAddProperty}
                  disabled={
                    !wizardNewPropertyKey.trim() ||
                    !wizardNewPropertyValue.trim() ||
                    wizardProperties.some((prop) => prop.key === wizardNewPropertyKey.trim())
                  }
                  className="wizard-add-property-button"
                >
                  {l10n.t("Add Property")}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column - Properties List */}
          <div className="wizard-right-column">
            <label className="wizard-label">
              {l10n.t("Properties")} {wizardSelectedType ? `(${wizardSelectedType})` : ""}:
            </label>
            <div className="wizard-properties-container">
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
                    {filteredInheritedProperties.map(([key, propData]) => {
                      // Extract logical profile path from jsonLoc (e.g., "profiles.lpar1.profiles.zosmf.profiles.w.properties.host" -> "lpar1.zosmf.w")
                      const jsonLocParts = propData.argLoc?.jsonLoc?.split(".") || [];
                      const profilePathParts = jsonLocParts.slice(1, -2); // Remove "profiles" prefix and "properties" + property name suffix
                      const profilePath =
                        profilePathParts.filter((part: string, index: number) => part !== "profiles" || index % 2 === 0).join(".") ||
                        "unknown profile";

                      // Extract full normalized config path from osLoc
                      const fullConfigPath = propData.argLoc?.osLoc?.[0] || "unknown config";

                      return (
                        <div
                          key={`inherited-${key}`}
                          className="wizard-property-item inherited"
                          title={`Inherited from: ${profilePath} (${fullConfigPath})`}
                        >
                          <span className="wizard-property-key">{key}:</span>
                          <div className="wizard-property-value-container">
                            {propData.secure ? (
                              <span className="wizard-property-value-display">********</span>
                            ) : (
                              <span className="wizard-property-value-display">
                                {typeof propData.value === "object" ? JSON.stringify(propData.value) : String(propData.value)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* User-added Properties */}
                    {wizardProperties.length > 0
                      ? wizardProperties.map((prop, index) => {
                          const propertyType = getPropertyType(prop.key);
                          return (
                            <div key={index} className="wizard-property-item">
                              <span className="wizard-property-key">{prop.key}:</span>
                              <div className="wizard-property-actions">
                                <div className="wizard-property-value-container">
                                  {prop.secure ? (
                                    <input
                                      type="password"
                                      value={stringifyValueByType(prop.value)}
                                      onChange={(e) => onPropertyValueChange(index, (e.target as HTMLInputElement).value)}
                                      className="modal-input wizard-property-value-input-small"
                                      placeholder="••••••••"
                                    />
                                  ) : propertyType === "boolean" ? (
                                    <select
                                      value={stringifyValueByType(prop.value)}
                                      onChange={(e) => onPropertyValueChange(index, (e.target as HTMLSelectElement).value)}
                                      className="modal-input wizard-property-value-input-small"
                                    >
                                      <option value="true">true</option>
                                      <option value="false">false</option>
                                    </select>
                                  ) : propertyType === "number" ? (
                                    <input
                                      type="number"
                                      value={stringifyValueByType(prop.value)}
                                      onChange={(e) => onPropertyValueChange(index, (e.target as HTMLInputElement).value)}
                                      className="modal-input wizard-property-value-input-small"
                                    />
                                  ) : (
                                    <input
                                      type="text"
                                      value={stringifyValueByType(prop.value)}
                                      onChange={(e) => onPropertyValueChange(index, (e.target as HTMLInputElement).value)}
                                      className="modal-input wizard-property-value-input-small"
                                    />
                                  )}
                                </div>
                                {canPropertyBeSecureForWizard(prop.key, wizardSelectedType) ? (
                                  secureValuesAllowed ? (
                                    <button
                                      onClick={() => onPropertySecureToggle(index)}
                                      className={`wizard-property-secure-toggle ${prop.secure ? "active" : "inactive"}`}
                                      title={prop.secure ? "Secure (click to unsecure)" : "Unsecure (click to secure)"}
                                    >
                                      <span className={`codicon ${prop.secure ? "codicon-lock" : "codicon-unlock"}`}></span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        vscodeApi.postMessage({
                                          command: "OPEN_VSCODE_SETTINGS",
                                          searchText: "Zowe.vscode-extension-for-zowe Secure Credentials Enabled",
                                        });
                                      }}
                                      className="wizard-property-secure-toggle inactive"
                                      title="A credential manager is not available. Click to open VS Code settings to enable secure credentials."
                                    >
                                      <span className="codicon codicon-lock" style={{ opacity: 0.5 }}></span>
                                    </button>
                                  )
                                ) : null}
                                <button
                                  onClick={() => onRemoveProperty(index)}
                                  className="wizard-button secondary"
                                  style={{
                                    padding: "4px 8px",
                                    fontSize: "12px",
                                    minWidth: "32px",
                                    height: "28px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                  title="Remove property"
                                >
                                  <span className="codicon codicon-trash"></span>
                                </button>
                              </div>
                            </div>
                          );
                        })
                      : null}
                  </>
                );
              })()}

              {/* Show "No properties added yet" when there are no properties at all */}
              {(() => {
                const userPropertyKeys = new Set(wizardProperties.map((prop) => prop.key));
                const schemaProperties = wizardSelectedType ? propertyOptions || [] : [];
                const filteredInheritedProperties =
                  wizardSelectedType && Object.keys(wizardMergedProperties).length > 0
                    ? Object.entries(wizardMergedProperties).filter(([key]) => !userPropertyKeys.has(key) && schemaProperties.includes(key))
                    : [];

                const hasAnyProperties = wizardProperties.length > 0 || filteredInheritedProperties.length > 0;

                return !hasAnyProperties ? <div className="wizard-no-properties">{l10n.t("No properties added yet")}</div> : null;
              })()}
            </div>
          </div>
        </div>

        <div className="wizard-actions">
          <button onClick={onCancel} className="wizard-button secondary">
            {l10n.t("Cancel")}
          </button>
          <button onClick={onCreateProfile} disabled={!wizardProfileName.trim() || isProfileNameTaken} className="wizard-button primary">
            {l10n.t("Create Profile")}
          </button>
        </div>
      </div>
    </div>
  );
}
