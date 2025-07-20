import * as l10n from "@vscode/l10n";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";

interface HeaderProps {
  selectedTab: number | null;
  configPath?: string;
  onProfileWizard: () => void;
  onClearChanges: () => void;
  onOpenRawFile: (filePath: string) => void;
  onSaveAll: () => void;
}

export function Header({ selectedTab, configPath, onProfileWizard, onClearChanges, onOpenRawFile, onSaveAll }: HeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        position: "sticky",
        top: 0,
        background: "var(--vscode-editor-background)",
      }}
    >
      <h1>{l10n.t("Zowe Configuration Editor")}</h1>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button className="header-button" title="Profile Wizard" onClick={onProfileWizard}>
          <span className="codicon codicon-wand"></span>
        </button>
        <button className="header-button" title="Clear Pending Changes" onClick={onClearChanges}>
          <span className="codicon codicon-clear-all"></span>
        </button>
        {selectedTab !== null && configPath && (
          <button className="header-button" title="Open Raw File" onClick={() => onOpenRawFile(configPath)}>
            <span className="codicon codicon-go-to-file"></span>
          </button>
        )}
        <button className="header-button" title="Save All Changes" onClick={onSaveAll}>
          <span className="codicon codicon-save-all"></span>
        </button>
      </div>
    </div>
  );
}
