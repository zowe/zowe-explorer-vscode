import * as l10n from "@vscode/l10n";

interface FooterProps {
  onClearChanges: () => void;
  onSaveAll: () => void;
  hasPendingChanges: boolean;
}

export function Footer({ onClearChanges, onSaveAll, hasPendingChanges }: FooterProps) {
  return (
    <div className="footer">
      <button
        onClick={onClearChanges}
        title={l10n.t("Refresh changes")}
        style={{
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
        }}
      >
        {l10n.t("Refresh")}
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
