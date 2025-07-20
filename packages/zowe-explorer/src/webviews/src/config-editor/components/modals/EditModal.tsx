import * as l10n from "@vscode/l10n";

interface EditModalProps {
  isOpen: boolean;
  editingKey: string;
  editingValue: string;
  onEditingValueChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function EditModal({ isOpen, editingKey, editingValue, onEditingValueChange, onSave, onCancel }: EditModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{l10n.t("Edit value for " + editingKey)}</h3>
        <input type="password" onChange={(e) => onEditingValueChange((e.target as HTMLTextAreaElement).value)} />
        <div className="modal-actions">
          <button onClick={onSave}>{l10n.t("Save")}</button>
          <button onClick={onCancel}>{l10n.t("Cancel")}</button>
        </div>
      </div>
    </div>
  );
}
