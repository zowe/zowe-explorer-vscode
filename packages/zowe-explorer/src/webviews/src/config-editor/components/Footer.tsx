import * as l10n from "@vscode/l10n";

interface FooterProps {
  onClearChanges: () => void;
  onSaveAll: () => void;
}

export function Footer({ onClearChanges, onSaveAll }: FooterProps) {
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
        title={l10n.t("Save all changes")}
        style={{
          padding: "8px 16px",
          fontSize: "13px",
          height: "32px",
          lineHeight: "16px",
          backgroundColor: "var(--vscode-button-background)",
          color: "var(--vscode-button-foreground)",
          border: "1px solid var(--vscode-button-border)",
          borderRadius: "4px",
          cursor: "pointer",
          fontWeight: "500",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {l10n.t("Save")}
      </button>
    </div>
  );
}
