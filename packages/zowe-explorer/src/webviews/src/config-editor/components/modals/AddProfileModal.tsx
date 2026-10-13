import { AuthOrderControls } from "../AuthOrderControls";
import { isAuthOrderProperty, isValidAuthOrder } from "../../utils/authOrder";
import * as l10n from "@vscode/l10n";
import { VscodeButton, VscodeTextfield, VscodeSingleSelect, VscodeOption } from "@vscode-elements/react-elements";
import { ModalShell } from "../ModalShell";
import { EnvVarAutocomplete } from "../EnvVarAutocomplete";
import { isFileProperty } from "../../utils/propertyUtils";

interface AddProfileModalProps {
  isOpen: boolean;
  newProfileKey: string;
  newProfileValue: string;
  showDropdown: boolean;
  typeOptions: string[];
  propertyDescriptions: { [key: string]: string };
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
  propertyDescriptions,
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

  const handleKeyDown = (e: any) => {
    if (e.key === "Enter") {
      onAdd();
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onCancel}
      initialFocusSelector={focusValueInput ? ".add-profile-input" : "#profile-type-input"}
      titleId="add-profile-modal-title"
      overlayClassName="modal-backdrop"
      panelClassName="modal"
    >
      <h3 id="add-profile-modal-title">{l10n.t("Add New Profile Property")}</h3>
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
                  title={propertyDescriptions[option] || ""}
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

      {isAuthOrderProperty(newProfileKey.trim()) && <AuthOrderControls value={newProfileValue} onChange={onNewProfileValueChange} />}

      <div className="add-profile-input-row">
        {(() => {
          const propertyType = getPropertyType(newProfileKey.trim());
          if (isSecure) {
            return (
              <VscodeTextfield
                placeholder="••••••••"
                value={newProfileValue}
                onInput={(e: any) => onNewProfileValueChange(e.target!.value as string)}
                onKeyDown={handleKeyDown}
                className="modal-input add-profile-input"
                type="password"
              />
            );
          } else if (propertyType === "boolean") {
            return (
              <VscodeSingleSelect
                value={newProfileValue}
                onChange={(e: any) => onNewProfileValueChange(e.target!.value as string)}
                onKeyDown={handleKeyDown}
                className="modal-input add-profile-input"
                style={{ width: "100%" }}
              >
                <VscodeOption value="true">true</VscodeOption>
                <VscodeOption value="false">false</VscodeOption>
              </VscodeSingleSelect>
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
            const isAuthOrder = isAuthOrderProperty(newProfileKey.trim());
            const hasValidationError = isAuthOrder && !isValidAuthOrder(newProfileValue);

            return (
              <EnvVarAutocomplete
                value={newProfileValue}
                onChange={onNewProfileValueChange}
                onKeyDown={handleKeyDown}
                className={`modal-input add-profile-input ${hasValidationError ? "error" : ""}`}
                placeholder={isAuthOrder ? l10n.t("e.g., basic, token") : l10n.t("Value")}
                vscodeApi={vscodeApi}
              />
            );
          }
        })()}
        <div className="add-profile-buttons">
          {newProfileKey && isFileProperty(newProfileKey.trim()) && (
            <button
              onClick={() => {
                if (vscodeApi) {
                  vscodeApi.postMessage({
                    command: "SELECT_FILE",
                    propertyIndex: -1, // -1 indicates new property
                    isNewProperty: true,
                    source: "addProfile",
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
          <VscodeButton secondary onClick={onCancel} data-testid="add-property-cancel">
            {l10n.t("Cancel")}
          </VscodeButton>
          <VscodeButton
            onClick={onAdd}
            disabled={isAuthOrderProperty(newProfileKey.trim()) && !isValidAuthOrder(newProfileValue)}
            data-testid="add-property-confirm"
          >
            {l10n.t("Add")}
          </VscodeButton>
        </div>
      </div>
    </ModalShell>
  );
}
