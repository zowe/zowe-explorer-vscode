import * as l10n from "@vscode/l10n";
import { useModalClickOutside, useModalFocus } from "../../hooks";

interface AddProfileModalProps {
  isOpen: boolean;
  newProfileKey: string;
  newProfileValue: string;
  showDropdown: boolean;
  typeOptions: string[];
  isSecure: boolean;
  secureValuesAllowed: boolean;
  getPropertyType: (propertyKey: string) => string | undefined;
  canPropertyBeSecure: (propertyKey: string, path: string[]) => boolean;
  newProfileKeyPath: string[];
  vscodeApi: any;
  onNewProfileKeyChange: (value: string) => void;
  onNewProfileValueChange: (value: string) => void;
  onShowDropdownChange: (value: boolean) => void;
  onSecureToggle: () => void;
  onAdd: () => void;
  onCancel: () => void;
  focusValueInput?: boolean; // New prop to control focus behavior
}

export function AddProfileModal({
  isOpen,
  newProfileKey,
  newProfileValue,
  showDropdown,
  typeOptions,
  isSecure,
  secureValuesAllowed,
  getPropertyType,
  canPropertyBeSecure,
  newProfileKeyPath,
  vscodeApi,
  onNewProfileKeyChange,
  onNewProfileValueChange,
  onShowDropdownChange,
  onSecureToggle,
  onAdd,
  onCancel,
  focusValueInput = false,
}: AddProfileModalProps) {
  if (!isOpen) return null;

  const { modalRef: _clickOutsideRef, handleBackdropMouseDown, handleBackdropClick } = useModalClickOutside(onCancel);
  const modalRef = useModalFocus(isOpen, focusValueInput ? ".add-profile-input" : "#profile-type-input");

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

  const handleKeyDown = (e: any) => {
    if (e.key === "Enter") {
      onAdd();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={handleBackdropMouseDown} onClick={handleBackdropClick}>
      <div className="modal" ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <h3>{l10n.t("Add New Profile Property")}</h3>
        <div className="dropdown-container" style={{ position: "relative" }}>
          <input
            id="profile-type-input"
            value={newProfileKey}
            onChange={(e) => {
              onNewProfileKeyChange((e.target as HTMLInputElement).value);
              onShowDropdownChange(true);
            }}
            onFocus={() => onShowDropdownChange(true)}
            onBlur={() => setTimeout(() => onShowDropdownChange(false), 100)}
            onKeyDown={handleKeyDown}
            className="modal-input"
            placeholder={l10n.t("New Key")}
            style={{ paddingRight: "2rem" }}
          />
          {newProfileKey && (
            <button onClick={() => onNewProfileKeyChange("")} className="profile-clear-button" title="Clear input">
              <span
                className="codicon codicon-chrome-close"
                style={{
                  fontSize: "14px",
                  lineHeight: 1,
                }}
              />
            </button>
          )}
          {showDropdown && (
            <ul className="dropdown-list">
              {typeOptions
                .filter((opt) => opt.toLowerCase().includes(newProfileKey.toLowerCase()))
                .map((option, index) => (
                  <li
                    key={index}
                    className="dropdown-item"
                    onMouseDown={() => {
                      onNewProfileKeyChange(option);
                      onShowDropdownChange(false);
                    }}
                  >
                    {option}
                  </li>
                ))}
            </ul>
          )}
        </div>

        <div className="add-profile-input-row">
          {(() => {
            const propertyType = getPropertyType(newProfileKey.trim());
            if (isSecure) {
              return (
                <input
                  placeholder="••••••••"
                  value={newProfileValue}
                  onChange={(e) => onNewProfileValueChange((e.target as HTMLInputElement).value)}
                  onKeyDown={handleKeyDown}
                  className="modal-input add-profile-input"
                  type="password"
                />
              );
            } else if (propertyType === "boolean") {
              return (
                <select
                  value={newProfileValue}
                  onChange={(e) => onNewProfileValueChange((e.target as HTMLSelectElement).value)}
                  onKeyDown={handleKeyDown}
                  className="modal-input add-profile-input"
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              );
            } else if (propertyType === "number") {
              return (
                <input
                  type="number"
                  value={newProfileValue}
                  onChange={(e) => onNewProfileValueChange((e.target as HTMLInputElement).value)}
                  onKeyDown={handleKeyDown}
                  className="modal-input add-profile-input"
                  placeholder={l10n.t("Value")}
                />
              );
            } else {
              return (
                <input
                  type="text"
                  value={newProfileValue}
                  onChange={(e) => onNewProfileValueChange((e.target as HTMLInputElement).value)}
                  onKeyDown={handleKeyDown}
                  className="modal-input add-profile-input"
                  placeholder={l10n.t("Value")}
                />
              );
            }
          })()}
          <div className="add-profile-buttons">
            {newProfileKey && isFileProperty(newProfileKey.trim()) && (
              <button
                onClick={() => {
                  // Use VS Code's showOpenDialog API to get the full file path
                  if (vscodeApi) {
                    vscodeApi.postMessage({
                      command: "SELECT_FILE",
                      propertyIndex: -1, // -1 indicates new property
                      isNewProperty: true,
                      source: "addProfile",
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
                        onNewProfileValueChange(filePath);
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
            {canPropertyBeSecure(newProfileKey, newProfileKeyPath) ? (
              secureValuesAllowed ? (
                <button
                  type="button"
                  onClick={onSecureToggle}
                  className={`wizard-secure-toggle ${isSecure ? "active" : "inactive"}`}
                  title={isSecure ? "Unlock property" : "Lock property"}
                >
                  <span className={`codicon ${isSecure ? "codicon-lock" : "codicon-unlock"}`}></span>
                </button>
              ) : (
                <button
                  type="button"
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
        <div className="modal-actions">
          <div className="add-profile-actions">
            <button className="wizard-button secondary" onClick={onCancel}>
              {l10n.t("Cancel")}
            </button>
            <button className="wizard-button primary" onClick={onAdd}>
              {l10n.t("Add")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
