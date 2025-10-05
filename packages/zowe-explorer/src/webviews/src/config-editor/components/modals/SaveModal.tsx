import * as l10n from "@vscode/l10n";
interface SaveModalProps {
  isOpen: boolean;
}

export function SaveModal({ isOpen }: SaveModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">{l10n.t("Saving....")}</div>
    </div>
  );
}
