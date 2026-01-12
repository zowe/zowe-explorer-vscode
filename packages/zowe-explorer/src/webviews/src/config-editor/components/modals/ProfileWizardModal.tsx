import * as l10n from "@vscode/l10n";
import { useModalClickOutside, useModalFocus } from "../../hooks";
import { EnvVarAutocomplete } from "../EnvVarAutocomplete";
import { useState, useRef, useEffect } from "react";
import { isFileProperty } from "../../utils/propertyUtils";

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
  propertyDescriptions: { [key: string]: string };
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
  propertyDescriptions,
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
  canPropertyBeSecureForWizard,
  stringifyValueByType,
  vscodeApi,
}: ProfileWizardModalProps) {
  // State for searchable parent profile dropdown
  const [parentProfileSearch, setParentProfileSearch] = useState("");
  const [showParentProfileDropdown, setShowParentProfileDropdown] = useState(false);
  const parentProfileDropdownRef = useRef<HTMLDivElement>(null);

  const [isParentProfileInvalid, setIsParentProfileInvalid] = useState(false);

  // Update search text when wizardRootProfile changes
  useEffect(() => {
    if (wizardRootProfile) {
      setParentProfileSearch(wizardRootProfile === "root" ? "/ (root)" : wizardRootProfile);
    } else {
      setParentProfileSearch("");
    }
  }, [wizardRootProfile]);

  useEffect(() => {
    if (wizardProfileName.trim() && wizardRootProfile && wizardRootProfile !== "root") {
      const isInvalid = isInvalidParentProfile(wizardRootProfile, wizardProfileName);
      setIsParentProfileInvalid(isInvalid);
    } else {
      setIsParentProfileInvalid(false);
    }
  }, [wizardProfileName, wizardRootProfile]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (parentProfileDropdownRef.current && !parentProfileDropdownRef.current.contains(event.target as Node)) {
        setShowParentProfileDropdown(false);
        if (wizardRootProfile) {
          setParentProfileSearch(wizardRootProfile === "root" ? "/ (root)" : wizardRootProfile);
        } else {
          setParentProfileSearch("");
        }
      }
    };

    if (showParentProfileDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showParentProfileDropdown, wizardRootProfile]);

  const handleParentProfileSelect = (profile: string) => {
    onRootProfileChange(profile);
    setParentProfileSearch(profile === "root" ? "/ (root)" : profile);
    setShowParentProfileDropdown(false);
  };

  const handleParentProfileSearchChange = (value: string) => {
    setParentProfileSearch(value);
    setShowParentProfileDropdown(true);
  };

  const handleParentProfileFocus = () => {
    setShowParentProfileDropdown(true);
  };

  const isInvalidParentProfile = (parentProfile: string, profileName: string): boolean => {
    if (!profileName.trim()) return false;

    if (parentProfile === profileName.trim()) {
      return true;
    }

    if (profileName.trim().startsWith(parentProfile + ".")) {
      return true;
    }

    if (parentProfile.startsWith(profileName.trim() + ".")) {
      return true;
    }

    return false;
  };

  const filteredParentProfiles = availableProfiles.filter((profile) => {
    const displayName = profile === "root" ? "/ (root)" : profile;
    const isCurrentSelection = wizardRootProfile && parentProfileSearch === (wizardRootProfile === "root" ? "/ (root)" : wizardRootProfile);
    const matchesSearch = parentProfileSearch === "" || isCurrentSelection || displayName.toLowerCase().includes(parentProfileSearch.toLowerCase());
    const isValidParent = !isInvalidParentProfile(profile, wizardProfileName);
    return matchesSearch && isValidParent;
  });

  const isAuthOrderProperty = (key: string): boolean => {
    if (!key || typeof key !== "string") {
      return false;
    }
    return key.toLowerCase() === "authorder";
  };

  const handleAuthMethodClick = (authMethod: string) => {
    const currentValue = wizardNewPropertyValue.trim();
    const authMethods = currentValue ? currentValue.split(",").map((m) => m.trim()) : [];

    if (authMethods.includes(authMethod)) {
      const newAuthMethods = authMethods.filter((method) => method !== authMethod);
      const newValue = newAuthMethods.join(", ");
      onNewPropertyValueChange(newValue);
    } else {
      const newAuthMethods = [...authMethods, authMethod];
      const newValue = newAuthMethods.join(", ");
      onNewPropertyValueChange(newValue);
    }
  };

  const getAuthMethodTooltip = (authMethod: string): string => {
    switch (authMethod) {
      case "basic":
        return "User & password authentication";
      case "token":
        return "API ML token authentication";
      case "bearer":
        return "Bearer token authentication";
      case "cert-pem":
        return "PEM certificate authentication";
      default:
        return authMethod;
    }
  };

  const isAuthMethodAlreadyAdded = (authMethod: string): boolean => {
    const currentValue = wizardNewPropertyValue.trim();
    const authMethods = currentValue ? currentValue.split(",").map((m) => m.trim()) : [];
    return authMethods.includes(authMethod);
  };

  const isValidAuthOrder = (value: string): boolean => {
    if (!value.trim()) return true;

    const validAuthTypes = ["basic", "token", "bearer", "cert-pem"];
    const authMethods = value.split(",").map((m) => m.trim());

    const uniqueMethods = new Set(authMethods);
    if (uniqueMethods.size !== authMethods.length) return false;

    return authMethods.every((method) => validAuthTypes.includes(method));
  };
  if (!isOpen) return null;

  const { modalRef: _clickOutsideRef, handleBackdropMouseDown, handleBackdropClick } = useModalClickOutside(onCancel);
  const modalRef = useModalFocus(isOpen, "input[type='text']");

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      if (wizardProfileName.trim() && !isProfileNameTaken) {
        onCreateProfile();
      }
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={handleBackdropMouseDown} onClick={handleBackdropClick} onKeyDown={handleKeyDown} tabIndex={-1}>
      <div className="modal wizard-modal" ref={modalRef} onClick={(e) => e.stopPropagation()} id="profile-wizard-modal">
        <h3 className="wizard-title" id="profile-wizard-title">
          {l10n.t("Profile Wizard")}
        </h3>
        <div className="wizard-content">
          {/* Left Column */}
          <div className="wizard-left-column">
            {/* Parent Profile Selection */}
            <div>
              <label className="wizard-label" id="parent-profile-label">
                {l10n.t("Parent Profile")}
              </label>
              <div className="wizard-parent-profile-container" ref={parentProfileDropdownRef}>
                <input
                  id="parent-profile-search"
                  type="text"
                  value={parentProfileSearch}
                  onChange={(e) => handleParentProfileSearchChange((e.target as HTMLInputElement).value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (filteredParentProfiles.length > 0) {
                        handleParentProfileSelect(filteredParentProfiles[0]);
                      }
                    } else if (e.key === "Escape") {
                      setShowParentProfileDropdown(false);
                      if (wizardRootProfile) {
                        setParentProfileSearch(wizardRootProfile === "root" ? "/ (root)" : wizardRootProfile);
                      } else {
                        setParentProfileSearch("");
                      }
                    } else if (e.key === "ArrowDown") {
                      setShowParentProfileDropdown(true);
                    }
                  }}
                  onClick={handleParentProfileFocus}
                  onFocus={(e) => (e.target as HTMLInputElement).select()}
                  className={`modal-input wizard-input ${isParentProfileInvalid ? "error" : ""}`}
                  placeholder={l10n.t("Select parent profile...")}
                />
                {showParentProfileDropdown && (
                  <ul className="dropdown-list" id="parent-profile-dropdown">
                    {filteredParentProfiles.map((profile, index) => (
                      <li
                        key={profile}
                        id={`parent-profile-option-${index}`}
                        className="dropdown-item"
                        onMouseDown={() => handleParentProfileSelect(profile)}
                      >
                        {profile === "root" ? "/ (root)" : profile}
                      </li>
                    ))}
                    {filteredParentProfiles.length === 0 && <li className="dropdown-item disabled">{l10n.t("No profiles found")}</li>}
                  </ul>
                )}
                {isParentProfileInvalid && (
                  <div className="wizard-error" id="parent-profile-error">
                    {l10n.t("Invalid parent profile selection. This would create a circular reference or invalid hierarchy.")}
                  </div>
                )}
              </div>
            </div>

            {/* Profile Name */}
            <div>
              <label className="wizard-label" id="profile-name-label">
                {l10n.t("Profile Name")}
              </label>
              <input
                id="profile-name-input"
                type="text"
                value={wizardProfileName}
                onKeyDown={(e) => {
                  // Handle Enter key to create profile
                  if (e.key === "Enter") {
                    if (wizardProfileName.trim() && !isProfileNameTaken) {
                      onCreateProfile();
                    }
                    return;
                  }
                  // Handle Escape key to close modal
                  if (e.key === "Escape") {
                    onCancel();
                    return;
                  }
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
              {isProfileNameTaken && (
                <div className="wizard-error" id="profile-name-error">
                  {l10n.t("Profile name already exists under this root")}
                </div>
              )}
            </div>

            {/* Type Selection with Populate Defaults Button */}
            <div>
              <label className="wizard-label" id="profile-type-label">
                {l10n.t("Profile Type")}
              </label>
              <div style={{ display: "flex", gap: "8px", alignItems: "stretch" }}>
                <select
                  id="profile-type-select"
                  value={wizardSelectedType}
                  onChange={(e) => onSelectedTypeChange((e.target as HTMLSelectElement).value)}
                  onKeyDown={handleKeyDown}
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
                  id="populate-defaults-button"
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
            <div className="wizard-add-property-section" id="add-property-section">
              <label className="wizard-label" id="add-property-label">
                {l10n.t("Add Property")} {wizardSelectedType ? `(${wizardSelectedType})` : ""}
              </label>
              <div className="wizard-property-form">
                <div className="wizard-property-input-container">
                  <div style={{ position: "relative" }}>
                    <input
                      id="new-property-key-input"
                      type="text"
                      value={wizardNewPropertyKey}
                      onChange={(e) => {
                        onNewPropertyKeyChange((e.target as HTMLInputElement).value);
                        onShowKeyDropdownChange(true);
                      }}
                      onFocus={() => onShowKeyDropdownChange(true)}
                      onBlur={() => setTimeout(() => onShowKeyDropdownChange(false), 100)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          onAddProperty();
                        } else if (e.key === "Escape") {
                          onCancel();
                        }
                      }}
                      className={`modal-input wizard-input ${
                        wizardNewPropertyKey.trim() && wizardProperties.some((prop) => prop.key === wizardNewPropertyKey.trim()) ? "error" : ""
                      }`}
                      placeholder={l10n.t("Property key")}
                      style={{ paddingRight: "2rem" }}
                    />
                    {wizardNewPropertyKey && (
                      <button
                        id="clear-property-key-button"
                        onClick={() => onNewPropertyKeyChange("")}
                        className="profile-clear-button"
                        title="Clear input"
                      >
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
                    <div className="wizard-error" id="property-key-exists-error">
                      {l10n.t("Property key already exists")}
                    </div>
                  )}
                  {wizardShowKeyDropdown && (
                    <ul className="dropdown-list" id="property-key-dropdown">
                      {propertyOptions
                        .filter((opt) => opt.toLowerCase().includes(wizardNewPropertyKey.toLowerCase()))
                        .map((option, index) => (
                          <li
                            key={index}
                            id={`property-key-option-${index}`}
                            className="dropdown-item"
                            title={propertyDescriptions[option] || ""}
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

                {/* Auth Order Buttons */}
                {isAuthOrderProperty(wizardNewPropertyKey.trim()) && (
                  <div className="auth-order-buttons" id="auth-order-buttons">
                    <label className="auth-order-label" id="auth-order-label">
                      {l10n.t("Select Authentication Order")}
                    </label>
                    <div className="auth-order-button-container" id="auth-order-button-container">
                      {["token", "basic", "bearer", "cert-pem"].map((authMethod) => {
                        const isSelected = isAuthMethodAlreadyAdded(authMethod);
                        let iconClass = "";
                        switch (authMethod) {
                          case "basic":
                            iconClass = "codicon-account";
                            break;
                          case "token":
                            iconClass = "codicon-key";
                            break;
                          case "bearer":
                            iconClass = "codicon-shield";
                            break;
                          case "cert-pem":
                            iconClass = "codicon-verified";
                            break;
                        }
                        return (
                          <button
                            key={authMethod}
                            id={`auth-method-${authMethod}-button`}
                            type="button"
                            onClick={() => handleAuthMethodClick(authMethod)}
                            className={`auth-order-button ${isSelected ? "selected" : ""}`}
                            title={`${getAuthMethodTooltip(authMethod)} (${isSelected ? "Click to remove" : "Click to add"})`}
                          >
                            <span className={`codicon ${iconClass}`} style={{ marginRight: "4px" }}></span>
                            {authMethod}
                          </button>
                        );
                      })}
                    </div>
                    {!isValidAuthOrder(wizardNewPropertyValue) && (
                      <div className="auth-order-error" id="auth-order-error">
                        {l10n.t("Invalid format. Use: basic, token, bearer, cert-pem")}
                      </div>
                    )}
                  </div>
                )}

                <div className="wizard-property-value-row">
                  {(() => {
                    const propertyType = getPropertyType(wizardNewPropertyKey.trim());
                    if (wizardNewPropertySecure) {
                      return (
                        <input
                          id="new-property-value-input"
                          type="password"
                          value={wizardNewPropertyValue}
                          onChange={(e) => onNewPropertyValueChange((e.target as HTMLInputElement).value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              onAddProperty();
                            } else if (e.key === "Escape") {
                              onCancel();
                            }
                          }}
                          className="modal-input wizard-property-value-input"
                          placeholder="••••••••"
                        />
                      );
                    } else if (propertyType === "boolean") {
                      return (
                        <select
                          id="new-property-value-select"
                          value={wizardNewPropertyValue}
                          onChange={(e) => onNewPropertyValueChange((e.target as HTMLSelectElement).value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              onAddProperty();
                            } else if (e.key === "Escape") {
                              onCancel();
                            }
                          }}
                          className="modal-input wizard-property-value-input"
                        >
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      );
                    } else if (propertyType === "number") {
                      return (
                        <input
                          id="new-property-value-number"
                          type="number"
                          value={wizardNewPropertyValue}
                          onChange={(e) => onNewPropertyValueChange((e.target as HTMLInputElement).value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              onAddProperty();
                            } else if (e.key === "Escape") {
                              onCancel();
                            }
                          }}
                          className="modal-input wizard-property-value-input"
                          placeholder={l10n.t("Property value")}
                        />
                      );
                    } else {
                      const isAuthOrder = isAuthOrderProperty(wizardNewPropertyKey.trim());
                      const hasValidationError = isAuthOrder && !isValidAuthOrder(wizardNewPropertyValue);

                      return (
                        <EnvVarAutocomplete
                          value={wizardNewPropertyValue}
                          onChange={onNewPropertyValueChange}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              onAddProperty();
                            } else if (e.key === "Escape") {
                              onCancel();
                            }
                          }}
                          className={`modal-input wizard-property-value-input ${hasValidationError ? "error" : ""}`}
                          placeholder={isAuthOrder ? l10n.t("e.g., basic, token") : l10n.t("Property value")}
                          vscodeApi={vscodeApi}
                        />
                      );
                    }
                  })()}
                  <div className="wizard-property-buttons">
                    {wizardNewPropertyKey && isFileProperty(wizardNewPropertyKey.trim()) && (
                      <button
                        id="file-picker-button"
                        onClick={() => {
                          if (vscodeApi) {
                            vscodeApi.postMessage({
                              command: "SELECT_FILE",
                              propertyIndex: -1,
                              isNewProperty: true,
                              source: "wizard",
                            });
                          } else {
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
                          id="secure-toggle-button"
                          onClick={onNewPropertySecureToggle}
                          className={`wizard-secure-toggle ${wizardNewPropertySecure ? "active" : "inactive"}`}
                          title={wizardNewPropertySecure ? "Secure (click to unsecure)" : "Unsecure (click to secure)"}
                        >
                          <span className={`codicon ${wizardNewPropertySecure ? "codicon-lock" : "codicon-unlock"}`}></span>
                        </button>
                      ) : (
                        <button
                          id="secure-settings-button"
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
                  id="add-property-button"
                  onClick={onAddProperty}
                  disabled={
                    !wizardNewPropertyKey.trim() ||
                    wizardProperties.some((prop) => prop.key === wizardNewPropertyKey.trim()) ||
                    (isAuthOrderProperty(wizardNewPropertyKey.trim()) && !isValidAuthOrder(wizardNewPropertyValue))
                  }
                  className="wizard-add-property-button"
                >
                  {l10n.t("Add Property")}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column - Properties List */}
          <div className="wizard-right-column" id="properties-column">
            <label className="wizard-label" id="properties-label">
              {l10n.t("Properties")} {wizardSelectedType ? `(${wizardSelectedType})` : ""}
            </label>
            <div className="wizard-properties-container" id="properties-container">
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
                          id={`inherited-property-${key}`}
                          className="wizard-property-item inherited"
                          title={`Inherited from: ${profilePath} (${fullConfigPath})`}
                        >
                          <span className="wizard-property-key">{key}</span>
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
                            <div key={index} id={`user-property-${index}`} className="wizard-property-item">
                              <span title={propertyDescriptions[prop.key] || ""} className="wizard-property-key">
                                {prop.key}
                              </span>
                              <div className="wizard-property-actions">
                                <div className="wizard-property-value-container">
                                  {prop.secure ? (
                                    <input
                                      id={`property-value-input-${index}`}
                                      type="password"
                                      value={stringifyValueByType(prop.value)}
                                      onChange={(e) => onPropertyValueChange(index, (e.target as HTMLInputElement).value)}
                                      className="modal-input wizard-property-value-input-small"
                                      placeholder="••••••••"
                                      style={{ width: "200px" }}
                                    />
                                  ) : propertyType === "boolean" ? (
                                    <select
                                      id={`property-value-select-${index}`}
                                      value={stringifyValueByType(prop.value)}
                                      onChange={(e) => onPropertyValueChange(index, (e.target as HTMLSelectElement).value)}
                                      className="modal-input wizard-property-value-input-small"
                                      style={{ width: "200px" }}
                                    >
                                      <option value="true">true</option>
                                      <option value="false">false</option>
                                    </select>
                                  ) : propertyType === "number" ? (
                                    <input
                                      id={`property-value-number-${index}`}
                                      type="number"
                                      value={stringifyValueByType(prop.value)}
                                      onChange={(e) => onPropertyValueChange(index, (e.target as HTMLInputElement).value)}
                                      className="modal-input wizard-property-value-input-small"
                                      style={{ width: "200px" }}
                                    />
                                  ) : (
                                    <EnvVarAutocomplete
                                      value={stringifyValueByType(prop.value)}
                                      onChange={(value) => onPropertyValueChange(index, value)}
                                      className="modal-input wizard-property-value-input-small"
                                      style={{ width: "200px" }}
                                      vscodeApi={vscodeApi}
                                    />
                                  )}
                                </div>
                                {canPropertyBeSecureForWizard(prop.key, wizardSelectedType) ? (
                                  secureValuesAllowed ? (
                                    <button
                                      id={`property-secure-toggle-${index}`}
                                      onClick={() => onPropertySecureToggle(index)}
                                      className={`wizard-property-secure-toggle ${prop.secure ? "active" : "inactive"}`}
                                      title={prop.secure ? "Secure (click to unsecure)" : "Unsecure (click to secure)"}
                                    >
                                      <span className={`codicon ${prop.secure ? "codicon-lock" : "codicon-unlock"}`}></span>
                                    </button>
                                  ) : (
                                    <button
                                      id={`property-secure-settings-${index}`}
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
                                  id={`remove-property-button-${index}`}
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

                return !hasAnyProperties ? (
                  <div className="wizard-no-properties" id="no-properties-message">
                    {l10n.t("No properties added yet")}
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        </div>

        <div className="wizard-actions" id="wizard-actions">
          <button id="cancel-button" onClick={onCancel} className="wizard-button secondary">
            {l10n.t("Cancel")}
          </button>
          <button
            id="create-profile-button"
            onClick={onCreateProfile}
            disabled={!wizardProfileName.trim() || isProfileNameTaken || isParentProfileInvalid}
            className="wizard-button primary"
          >
            {l10n.t("Create Profile")}
          </button>
        </div>
      </div>
    </div>
  );
}
