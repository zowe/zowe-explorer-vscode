import { useState, useEffect } from "react";
import { VscodeButton, VscodeTextfield } from "@vscode-elements/react-elements";
import { ModalShell } from "../ModalShell";
import { getEffectiveProfileKeys, resolveProfileDestination } from "../../utils/profileConflicts";
import { isValidProfileNamePath, isValidProfileNameSegment, sanitizeProfileNamePath, sanitizeProfileNameSegment } from "../../utils/profileNames";

interface RenameProfileModalProps {
  isOpen: boolean;
  currentProfileName: string;
  currentProfileKey: string; // Full profile key (e.g., "lpar1.test")
  existingProfiles: string[]; // List of existing profile keys
  pendingProfiles: string[]; // List of pending profile keys
  pendingRenames: { [originalKey: string]: string }; // Map of original key to new key for pending renames
  onRename: (newName: string) => void;
  onCancel: () => void;
}

export function RenameProfileModal({
  isOpen,
  currentProfileName,
  currentProfileKey,
  existingProfiles,
  pendingProfiles,
  pendingRenames,
  onRename,
  onCancel,
}: RenameProfileModalProps) {
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const isFullPathMode = false;

  useEffect(() => {
    if (isOpen) {
      const initialValue = isFullPathMode ? currentProfileKey : currentProfileName;
      const filteredValue = filterInputValue(initialValue);
      setNewName(filteredValue);
      setError("");
    } else {
      setNewName("");
      setError("");
    }
  }, [isOpen, currentProfileName, currentProfileKey, isFullPathMode]);

  const isValidSingleProfileName = isValidProfileNameSegment;

  const isValidFullProfilePath = isValidProfileNamePath;

  const filterInputValue = (value: string): string => {
    return isFullPathMode ? sanitizeProfileNamePath(value) : sanitizeProfileNameSegment(value);
  };

  const validateNewName = (name: string): string | null => {
    // Check if name is empty
    if (!name.trim()) {
      return "Profile name cannot be empty";
    }

    // Check if name is the same as current
    const currentValue = isFullPathMode ? currentProfileKey : currentProfileName;
    if (name.trim() === currentValue) {
      return "New name must be different from current name";
    }

    // Apply mode-specific validation
    if (isFullPathMode) {
      if (!isValidFullProfilePath(name.trim())) {
        return "Profile path must contain period-separated non-empty segments with only letters, numbers, underscores, and hyphens";
      }
    } else {
      if (!isValidSingleProfileName(name.trim())) {
        return "Profile name can only contain letters, numbers, underscores, and hyphens";
      }
    }

    // Determine the new full key based on mode
    let newFullKey: string;
    if (isFullPathMode) {
      // In full path mode, the user is specifying the entire profile path
      newFullKey = name.trim();
    } else {
      // In single name mode, combine with parent path
      const parentPath = currentProfileKey.includes(".") ? currentProfileKey.substring(0, currentProfileKey.lastIndexOf(".")) : "";
      newFullKey = parentPath ? `${parentPath}.${name.trim()}` : name.trim();
    }

    const result = resolveProfileDestination({
      proposedKey: newFullKey,
      sourceKey: currentProfileKey,
      profileKeys: getEffectiveProfileKeys(existingProfiles, pendingProfiles, pendingRenames),
      onConflict: "reject",
    });
    if (result.status === "conflict") return result.message;

    return null;
  };

  const handleSubmit = () => {
    const validationError = validateNewName(newName);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Determine the new full key based on mode
    let fullNewKey: string;
    if (isFullPathMode) {
      // In full path mode, the user is specifying the entire profile path
      fullNewKey = newName.trim();
    } else {
      // In single name mode, combine with parent path
      const parentPath = currentProfileKey.includes(".") ? currentProfileKey.substring(0, currentProfileKey.lastIndexOf(".")) : "";
      fullNewKey = parentPath ? `${parentPath}.${newName.trim()}` : newName.trim();
    }

    onRename(fullNewKey);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  const handleInputChange = (e: any) => {
    const rawValue = e.target!.value as string;
    const filteredValue = filterInputValue(rawValue);

    // Only update if the filtered value is different (prevents cursor jumping)
    if (filteredValue !== rawValue) {
      // Update the input value directly to prevent invalid characters
      e.target!.value = filteredValue;
    }

    setNewName(filteredValue);

    // Clear error when user starts typing
    if (error) {
      setError("");
    }
  };

  if (!isOpen) return null;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onCancel}
      initialFocusSelector="#profile-name"
      titleId="rename-profile-modal-title"
      overlayClassName="modal-overlay"
      panelClassName="modal-content"
    >
      <h2 id="rename-profile-modal-title">Rename Profile</h2>
      <div className="modal-body">
        <div style={{ marginBottom: "16px" }}>
          <label htmlFor="profile-name" style={{ display: "block", marginBottom: "8px", fontWeight: "var(--ce-font-weight-emphasis)" }}>
            New Profile Name
          </label>
          <VscodeTextfield
            id="profile-name"
            type="text"
            className={`modal-input ${error ? "error" : ""}`}
            value={newName}
            onInput={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="e.g., tso-new"
          />
          {error && <div className="modal-error">{error}</div>}
          <div style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)", marginTop: "4px" }}>
            Use letters, numbers, underscores, and hyphens only
          </div>
        </div>
      </div>
      <div className="modal-actions">
        <VscodeButton secondary id="rename-cancel" onClick={onCancel}>
          Cancel
        </VscodeButton>
        <VscodeButton id="rename-confirm" onClick={handleSubmit}>
          Rename
        </VscodeButton>
      </div>
    </ModalShell>
  );
}
