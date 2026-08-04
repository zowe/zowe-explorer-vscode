import * as l10n from "@vscode/l10n";
import { ModalShell } from "../ModalShell";

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
    <ModalShell
      isOpen={isOpen}
      onClose={onCancel}
      initialFocusSelector="input"
      titleId="new-layer-modal-title"
      overlayClassName="modal-backdrop"
      panelClassName="modal"
    >
      <h3 id="new-layer-modal-title">{l10n.t("Add New Layer")}</h3>
      <input
        placeholder={l10n.t("New Layer Name")}
        value={newLayerName}
        onChange={(e) => onNewLayerNameChange((e.target as HTMLInputElement).value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onAdd();
          }
        }}
      />
      <div className="modal-actions">
        <button onClick={onAdd}>{l10n.t("Add")}</button>
        <button onClick={onCancel}>{l10n.t("Cancel")}</button>
      </div>
    </ModalShell>
  );
}
