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
  const { modalRef: _clickOutsideRef, handleBackdropMouseDown, handleBackdropClick } = useModalClickOutside(onCancel);
  const modalRef = useModalFocus(isOpen, "#profile-name");

  useEffect(() => {
    if (isOpen) {
      setNewName(currentProfileName);
      setError("");
    }
  }, [isOpen, currentProfileName]);

  const validateNewName = (name: string): string | null => {
    // Check if name is empty
    if (!name.trim()) {
      return "Profile name cannot be empty";
    }

    // Check if name is the same as current
    if (name.trim() === currentProfileName) {
      return "New name must be different from current name";
    }

    // Check for invalid characters
    const invalidChars = /[^a-zA-Z0-9._-]/;
    if (invalidChars.test(name.trim())) {
      return "Profile name can only contain letters, numbers, dots, underscores, and hyphens";
    }

    // Check if the new name would conflict with existing profiles
    const parentPath = currentProfileKey.includes(".") ? currentProfileKey.substring(0, currentProfileKey.lastIndexOf(".")) : "";
    const newFullKey = parentPath ? `${parentPath}.${name.trim()}` : name.trim();

    // Check existing profiles
    if (existingProfiles.includes(newFullKey)) {
      return `Profile '${name.trim()}' already exists`;
    }

    // Check pending profiles
    if (pendingProfiles.includes(newFullKey)) {
      return `Profile '${name.trim()}' is pending creation`;
    }

    return null;
  };

  const handleSubmit = () => {
    const validationError = validateNewName(newName);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Construct the full profile key by combining parent path with new name
    const parentPath = currentProfileKey.includes(".") ? currentProfileKey.substring(0, currentProfileKey.lastIndexOf(".")) : "";
    const fullNewKey = parentPath ? `${parentPath}.${newName.trim()}` : newName.trim();

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

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onMouseDown={handleBackdropMouseDown} onClick={handleBackdropClick}>
      <div ref={modalRef} className="modal-content">
        <h2>Rename Profile</h2>
        <div className="modal-body">
          <label htmlFor="profile-name">New Profile Name:</label>
          <input
            id="profile-name"
            type="text"
            className={`modal-input ${error ? "error" : ""}`}
            value={newName}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Enter new profile name"
          />
          {error && <div className="modal-error">{error}</div>}
          <div className="modal-hint" style={{ marginBottom: "16px" }}>
            Warning: Unsaved renames may result in inaccurate rendering of profiles. Make sure to save your changes after renaming.
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
