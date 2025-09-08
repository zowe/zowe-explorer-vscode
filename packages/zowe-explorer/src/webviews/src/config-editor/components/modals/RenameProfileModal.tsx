import React, { useState, useEffect } from "react";
import { useModalClickOutside, useModalFocus } from "../../hooks";

interface RenameProfileModalProps {
  isOpen: boolean;
  currentProfileName: string;
  currentProfileKey: string; // Full profile key (e.g., "lpar1.test")
  existingProfiles: string[]; // List of existing profile keys
  pendingProfiles: string[]; // List of pending profile keys
  onRename: (newName: string) => void;
  onCancel: () => void;
}

export function RenameProfileModal({
  isOpen,
  currentProfileName,
  currentProfileKey,
  existingProfiles,
  pendingProfiles,
  onRename,
  onCancel,
}: RenameProfileModalProps) {
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [isFullPathMode, setIsFullPathMode] = useState(false);
  const { modalRef: _clickOutsideRef, handleBackdropMouseDown, handleBackdropClick } = useModalClickOutside(onCancel);
  const modalRef = useModalFocus(isOpen, "#profile-name");

  useEffect(() => {
    if (isOpen) {
      // Initialize with the appropriate value based on mode
      const initialValue = isFullPathMode ? currentProfileKey : currentProfileName;
      const filteredValue = filterInputValue(initialValue);
      setNewName(filteredValue);
      setError("");
    } else {
      // Reset state when modal is closed
      setNewName("");
      setError("");
      setIsFullPathMode(false);
    }
  }, [isOpen, currentProfileName, currentProfileKey, isFullPathMode]);

  // Helper function to validate single profile name (alphanumeric + basic special chars)
  const isValidSingleProfileName = (name: string): boolean => {
    // Allow alphanumeric characters and basic special characters (underscore, hyphen)
    const validChars = /^[a-zA-Z0-9_-]+$/;
    return validChars.test(name);
  };

  // Helper function to validate full profile path (period-separated non-empty strings)
  const isValidFullProfilePath = (path: string): boolean => {
    // Split by periods and check each part
    const parts = path.split(".");

    // Check if any part is empty
    if (parts.some((part) => part.trim() === "")) {
      return false;
    }

    // Check if each part contains only valid characters (alphanumeric + underscore + hyphen)
    const validPartChars = /^[a-zA-Z0-9_-]+$/;
    return parts.every((part) => validPartChars.test(part.trim()));
  };

  // Helper function to filter input based on mode
  const filterInputValue = (value: string): string => {
    if (isFullPathMode) {
      // For full path mode, allow alphanumeric, underscore, hyphen, and periods
      // But ensure periods don't create empty segments
      return value.replace(/[^a-zA-Z0-9._-]/g, "");
    } else {
      // For single name mode, only allow alphanumeric, underscore, and hyphen
      return value.replace(/[^a-zA-Z0-9_-]/g, "");
    }
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

    // Check existing profiles
    if (existingProfiles.includes(newFullKey)) {
      return `Profile '${newFullKey}' already exists`;
    }

    // Check pending profiles
    if (pendingProfiles.includes(newFullKey)) {
      return `Profile '${newFullKey}' is pending creation`;
    }

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
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = (e.target as HTMLInputElement).value;
    const filteredValue = filterInputValue(rawValue);

    // Only update if the filtered value is different (prevents cursor jumping)
    if (filteredValue !== rawValue) {
      // Update the input value directly to prevent invalid characters
      (e.target as HTMLInputElement).value = filteredValue;
    }

    setNewName(filteredValue);

    // Clear error when user starts typing
    if (error) {
      setError("");
    }
  };

  const handleModeToggle = () => {
    const newMode = !isFullPathMode;
    setIsFullPathMode(newMode);

    // Get the appropriate initial value for the new mode
    const initialValue = newMode ? currentProfileKey : currentProfileName;

    // Apply filtering to the initial value based on the new mode
    const filteredValue = filterInputValue(initialValue);

    setNewName(filteredValue);
    setError("");
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onMouseDown={handleBackdropMouseDown} onClick={handleBackdropClick}>
      <div ref={modalRef} className="modal-content">
        <h2>Rename Profile</h2>
        <div className="modal-body">
          <div style={{ marginBottom: "16px" }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: "600" }}>Rename Options</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="renameMode"
                  checked={!isFullPathMode}
                  onChange={() => {
                    if (isFullPathMode) {
                      handleModeToggle();
                    }
                  }}
                />
                <div>
                  <div style={{ fontWeight: "500" }}>Rename profile name only</div>
                  <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>Only change the profile name (e.g., "tso" → "tso-new")</div>
                </div>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="renameMode"
                  checked={isFullPathMode}
                  onChange={() => {
                    if (!isFullPathMode) {
                      handleModeToggle();
                    }
                  }}
                />
                <div>
                  <div style={{ fontWeight: "500" }}>Rename full profile path</div>
                  <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>
                    Change the entire profile path (e.g., "tso" → "newparent.tso")
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label htmlFor="profile-name" style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}>
              {isFullPathMode ? "New Profile Path:" : "New Profile Name:"}
            </label>
            <input
              id="profile-name"
              type="text"
              className={`modal-input ${error ? "error" : ""}`}
              value={newName}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={isFullPathMode ? "e.g., parent.child" : "e.g., tso-new"}
            />
            {error && <div className="modal-error">{error}</div>}
            <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
              {isFullPathMode
                ? "Use periods to separate profile levels (e.g., parent.child.grandchild)"
                : "Use letters, numbers, underscores, and hyphens only"}
            </div>
          </div>

          <div className="modal-hint" style={{ marginBottom: "16px" }}>
            <strong>Note:</strong> Unsaved renames may result in inaccurate rendering of profiles. Make sure to save your changes after renaming.
          </div>
        </div>
        <div className="modal-actions">
          <button className="modal-button secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="modal-button primary" onClick={handleSubmit}>
            Rename
          </button>
        </div>
      </div>
    </div>
  );
}
