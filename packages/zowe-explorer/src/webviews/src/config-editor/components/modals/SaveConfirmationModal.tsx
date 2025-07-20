import * as l10n from "@vscode/l10n";

interface SaveConfirmationModalProps {
  isOpen: boolean;
  onSaveAndContinue: () => void;
  onCancel: () => void;
}

export function SaveConfirmationModal({ isOpen, onSaveAndContinue, onCancel }: SaveConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{l10n.t("Unsaved Changes")}</h3>
        <div style={{ marginBottom: "16px" }}>
          <p>{l10n.t("You have unsaved changes. Would you like to save them before previewing the arguments?")}</p>
        </div>
        <div className="modal-actions">
          <button
            onClick={onSaveAndContinue}
            style={{ backgroundColor: "var(--vscode-button-background)", color: "var(--vscode-button-foreground)" }}
          >
            {l10n.t("Save & Continue")}
          </button>
          <button
            onClick={onCancel}
            style={{ backgroundColor: "var(--vscode-button-secondaryBackground)", color: "var(--vscode-button-secondaryForeground)" }}
          >
            {l10n.t("Cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
