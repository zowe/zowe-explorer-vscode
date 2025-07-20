import * as l10n from "@vscode/l10n";

interface NewLayerModalProps {
  isOpen: boolean;
  newLayerName: string;
  onNewLayerNameChange: (value: string) => void;
  onAdd: () => void;
  onCancel: () => void;
}

export function NewLayerModal({ isOpen, newLayerName, onNewLayerNameChange, onAdd, onCancel }: NewLayerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{l10n.t("Add New Layer")}</h3>
        <input
          placeholder={l10n.t("New Layer Name")}
          value={newLayerName}
          onChange={(e) => onNewLayerNameChange((e.target as HTMLInputElement).value)}
        />
        <div className="modal-actions">
          <button onClick={onAdd}>{l10n.t("Add")}</button>
          <button onClick={onCancel}>{l10n.t("Cancel")}</button>
        </div>
      </div>
    </div>
  );
}
