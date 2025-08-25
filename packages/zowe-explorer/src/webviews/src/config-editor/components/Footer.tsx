interface FooterProps {
  onClearChanges: () => void;
  onSaveAll: () => void;
}

export function Footer({ onClearChanges, onSaveAll }: FooterProps) {
  // Detect OS for appropriate keyboard shortcut text
  const getKeyboardShortcutText = (action: "refresh" | "save") => {
    const platform = navigator.platform.toLowerCase();
    if (platform.includes("mac")) {
      return action === "refresh" ? "Cmd+Z" : "Cmd+S";
    } else {
      return action === "refresh" ? "Ctrl+Z" : "Ctrl+S";
    }
  };

  return (
    <div className="footer">
      <button
        onClick={onClearChanges}
        title={`Refresh changes (${getKeyboardShortcutText("refresh")})`}
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
        Refresh
      </button>
      <button
        onClick={onSaveAll}
        title={`Save all changes (${getKeyboardShortcutText("save")})`}
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
        Save
      </button>
    </div>
  );
}
