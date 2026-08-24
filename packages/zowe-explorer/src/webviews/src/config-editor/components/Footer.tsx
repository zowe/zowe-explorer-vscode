import * as l10n from "@vscode/l10n";

interface FooterProps {
  onClearChanges: () => void;
  onSaveAll: () => void;
  hasPendingChanges: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const secondaryButtonStyle = {
  padding: "8px 16px",
  fontSize: "13px",
  height: "32px",
  lineHeight: "16px",
  backgroundColor: "var(--vscode-button-secondaryBackground)",
  color: "var(--vscode-button-secondaryForeground)",
  border: "1px solid var(--vscode-button-secondaryBorder)",
  borderRadius: "4px",
  cursor: "pointer",
  fontWeight: "normal",
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
} as const;

export function Footer({ onClearChanges, onSaveAll, hasPendingChanges, onUndo, onRedo, canUndo, canRedo }: FooterProps) {
  return (
    <div className="footer" data-tutorial-id="save-refresh-footer">
      <button
        onClick={onUndo}
        disabled={!canUndo}
        title={canUndo ? l10n.t("Undo (Ctrl+Z)") : l10n.t("Nothing to undo")}
        data-testid="undo-change"
        className="ce-icon-button footer-history-button"
      >
        <span className="codicon codicon-discard codicon-size-16"></span>
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        title={canRedo ? l10n.t("Redo (Ctrl+Shift+Z)") : l10n.t("Nothing to redo")}
        data-testid="redo-change"
        className="ce-icon-button footer-history-button"
      >
        <span className="codicon codicon-redo codicon-size-16"></span>
      </button>
      <button onClick={onClearChanges} title={l10n.t("Revert changes")} style={secondaryButtonStyle}>
        {l10n.t("Revert")}
      </button>
      <button
        onClick={onSaveAll}
        title={hasPendingChanges ? l10n.t("Save all changes") : l10n.t("No changes to save")}
        disabled={!hasPendingChanges}
        style={{
          padding: "8px 16px",
          fontSize: "13px",
          height: "32px",
          lineHeight: "16px",
          backgroundColor: hasPendingChanges ? "var(--vscode-button-background)" : "var(--vscode-button-secondaryBackground)",
          color: hasPendingChanges ? "var(--vscode-button-foreground)" : "var(--vscode-button-secondaryForeground)",
          border: hasPendingChanges ? "1px solid var(--vscode-button-border)" : "1px solid var(--vscode-button-secondaryBorder)",
          borderRadius: "4px",
          cursor: hasPendingChanges ? "pointer" : "not-allowed",
          fontWeight: "500",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: hasPendingChanges ? 1 : 0.5,
        }}
      >
        {l10n.t("Save")}
      </button>
    </div>
  );
}
