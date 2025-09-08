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
      setNewName(isFullPathMode ? currentProfileKey : currentProfileName);
      setError("");
    } else {
      // Reset state when modal is closed
      setNewName("");
      setError("");
      setIsFullPathMode(false);
    }
  }, [isOpen, currentProfileName, currentProfileKey, isFullPathMode]);

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

    // Check for invalid characters
    const invalidChars = /[^a-zA-Z0-9._-]/;
    if (invalidChars.test(name.trim())) {
      return "Profile name can only contain letters, numbers, dots, underscores, and hyphens";
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
    const value = (e.target as HTMLInputElement).value;
    setNewName(value);

    // Clear error when user starts typing
    if (error) {
      setError("");
    }
  };

  const handleModeToggle = () => {
    const newMode = !isFullPathMode;
    setIsFullPathMode(newMode);
    // Update the input value based on the new mode
    setNewName(newMode ? currentProfileKey : currentProfileName);
    setError("");
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onMouseDown={handleBackdropMouseDown} onClick={handleBackdropClick}>
      <div ref={modalRef} className="modal-content">
        <h2>Rename Profile</h2>
        <div className="modal-body">
          <label htmlFor="profile-name">{isFullPathMode ? "New Profile Path:" : "New Profile Name:"}</label>
          <input
            id="profile-name"
            type="text"
            className={`modal-input ${error ? "error" : ""}`}
            value={newName}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isFullPathMode ? "Enter new profile path" : "Enter new profile name"}
          />
          {error && <div className="modal-error">{error}</div>}
          <div className="modal-hint" style={{ marginBottom: "16px" }}>
            Warning: Unsaved renames may result in inaccurate rendering of profiles. Make sure to save your changes after renaming.
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input type="checkbox" checked={isFullPathMode} onChange={handleModeToggle} />
              <span>Rename entire profile path</span>
            </label>
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
