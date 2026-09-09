import * as l10n from "@vscode/l10n";
import { VscodeButton, VscodeTextfield } from "@vscode-elements/react-elements";

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
      initialFocusSelector="vscode-textfield"
      titleId="new-layer-modal-title"
      overlayClassName="modal-backdrop"
      panelClassName="modal"
    >
      <h3 id="new-layer-modal-title">{l10n.t("Add New Layer")}</h3>
      <VscodeTextfield
        placeholder={l10n.t("New Layer Name")}
        value={newLayerName}
        onInput={(e: any) => onNewLayerNameChange(e.target!.value as string)}
        onKeyDown={(e: any) => {
          if (e.key === "Enter") {
            onAdd();
          }
        }}
        style={{ width: "100%" }}
      />
      <div className="modal-actions">
        <VscodeButton onClick={onAdd}>{l10n.t("Add")}</VscodeButton>
        <VscodeButton secondary onClick={onCancel}>
          {l10n.t("Cancel")}
        </VscodeButton>
      </div>
    </ModalShell>
  );
}
