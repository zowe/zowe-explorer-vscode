import * as l10n from "@vscode/l10n";
import { useModalClickOutside, useModalFocus } from "../../hooks";

interface NewLayerModalProps {
  isOpen: boolean;
  newLayerName: string;
  onNewLayerNameChange: (value: string) => void;
  onAdd: () => void;
  onCancel: () => void;
}

export function NewLayerModal({ isOpen, newLayerName, onNewLayerNameChange, onAdd, onCancel }: NewLayerModalProps) {
  if (!isOpen) return null;

  const { modalRef: _clickOutsideRef, handleBackdropMouseDown, handleBackdropClick } = useModalClickOutside(onCancel);
  const modalRef = useModalFocus(isOpen, "input");

  return (
    <div className="modal-backdrop" onMouseDown={handleBackdropMouseDown} onClick={handleBackdropClick}>
      <div className="modal" ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <h3>{l10n.t("Add New Layer")}</h3>
        <input
          placeholder={l10n.t("New Layer Name")}
          value={newLayerName}
          onChange={(e) => onNewLayerNameChange((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onAdd();
            } else if (e.key === "Escape") {
              onCancel();
            }
          }}
        />
        <div className="modal-actions">
          <button onClick={onAdd}>{l10n.t("Add")}</button>
          <button onClick={onCancel}>{l10n.t("Cancel")}</button>
        </div>
      </div>
    </div>
  );
}
