interface FooterProps {
  onClearChanges: () => void;
  onSaveAll: () => void;
}

export function Footer({ onClearChanges, onSaveAll }: FooterProps) {
  return (
    <div className="footer">
      <button
        className="header-button"
        onClick={onClearChanges}
        style={{
          padding: "8px 16px",
          fontSize: "13px",
          backgroundColor: "var(--vscode-button-secondaryBackground)",
          color: "var(--vscode-button-secondaryForeground)",
          border: "1px solid var(--vscode-button-secondaryBorder)",
          borderRadius: "4px",
          cursor: "pointer",
          fontWeight: "normal",
        }}
      >
        Clear Changes
      </button>
      <button
        onClick={onSaveAll}
        style={{
          padding: "8px 16px",
          fontSize: "13px",
          backgroundColor: "var(--vscode-button-background)",
          color: "var(--vscode-button-foreground)",
          border: "1px solid var(--vscode-button-border)",
          borderRadius: "4px",
          cursor: "pointer",
          fontWeight: "500",
        }}
      >
        Save
      </button>
    </div>
  );
}
