import * as l10n from "@vscode/l10n";
import { VscodeToolbarButton, VscodeButton } from "@vscode-elements/react-elements";
import { useEditorFields, useEditorStore } from "../context/EditorStoreContext";
import { selectHasPendingChanges } from "../store/selectors";

export function Footer() {
  const {
    handleRefresh: onClearChanges,
    handleSave: onSaveAll,
    undo: onUndo,
    redo: onRedo,
  } = useEditorFields("handleRefresh", "handleSave", "undo", "redo");
  const hasPendingChanges = useEditorStore(selectHasPendingChanges);
  const canUndo = useEditorStore((state) => state.undoStack.length > 0);
  const canRedo = useEditorStore((state) => state.redoStack.length > 0);
  return (
    <div className="footer" data-tutorial-id="save-refresh-footer">
      <VscodeToolbarButton
        onClick={canUndo ? onUndo : undefined}
        aria-disabled={!canUndo}
        tabIndex={canUndo ? 0 : -1}
        title={canUndo ? l10n.t("Undo (Ctrl+Z)") : l10n.t("Nothing to undo")}
        data-testid="undo-change"
        className="footer-history-button"
      >
        <span className="codicon codicon-discard codicon-size-16"></span>
      </VscodeToolbarButton>
      <VscodeToolbarButton
        onClick={canRedo ? onRedo : undefined}
        aria-disabled={!canRedo}
        tabIndex={canRedo ? 0 : -1}
        title={canRedo ? l10n.t("Redo (Ctrl+Shift+Z)") : l10n.t("Nothing to redo")}
        data-testid="redo-change"
        className="footer-history-button"
      >
        <span className="codicon codicon-redo codicon-size-16"></span>
      </VscodeToolbarButton>
      <VscodeButton secondary onClick={onClearChanges} title={l10n.t("Revert changes")} data-testid="revert-changes-button">
        {l10n.t("Revert")}
      </VscodeButton>
      <VscodeButton
        onClick={onSaveAll}
        title={hasPendingChanges ? l10n.t("Save all changes") : l10n.t("No changes to save")}
        disabled={!hasPendingChanges}
        data-testid="save-all-button"
      >
        {l10n.t("Save")}
      </VscodeButton>
    </div>
  );
}
