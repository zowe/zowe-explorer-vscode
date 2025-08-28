import { useState, useEffect } from "react";

interface TabsProps {
  configurations: { configPath: string; properties: any; secure: string[]; global?: boolean; user?: boolean; schemaPath?: string }[];
  selectedTab: number | null;
  onTabChange: (index: number) => void;
  onOpenRawFile: (filePath: string) => void;
  onRevealInFinder: (filePath: string) => void;
  onOpenSchemaFile: (filePath: string) => void;
  onAddNewConfig: () => void;
  onToggleAutostore: (configPath: string) => void;
  pendingChanges: { [configPath: string]: any };
  autostoreChanges: { [configPath: string]: boolean };
}

export function Tabs({
  configurations,
  selectedTab,
  onTabChange,
  onOpenRawFile,
  onRevealInFinder,
  onOpenSchemaFile,
  onAddNewConfig,
  onToggleAutostore,
  pendingChanges,
  autostoreChanges,
}: TabsProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabIndex: number } | null>(null);

  // Detect OS for appropriate text
  const getRevealText = () => {
    const platform = navigator.platform.toLowerCase();
    if (platform.includes("mac")) {
      return "Reveal in Finder";
    } else if (platform.includes("win")) {
      return "Reveal in File Explorer";
    } else {
      return "Reveal in File Manager";
    }
  };

  const getTabLabel = (configPath: string) => {
    // Extract just the filename from the full path
    const parts = configPath.split(/[/\\]/);
    return parts[parts.length - 1] || configPath;
  };

  const getConfigIcon = (config: { global?: boolean; user?: boolean }) => {
    if (config.global) {
      return "codicon-globe";
    } else if (config.user) {
      return "codicon-folder";
    } else {
      return "codicon-folder";
    }
  };

  const handleTabRightClick = (e: any, index: number) => {
    e.preventDefault();

    // Ensure context menu stays within viewport bounds
    const menuWidth = 150;
    const menuHeight = 160; // Increased height for additional menu item
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = e.clientX;
    let y = e.clientY;

    // Adjust horizontal position if menu would go off-screen
    if (x + menuWidth > viewportWidth) {
      x = viewportWidth - menuWidth - 10;
    }

    // Adjust vertical position if menu would go off-screen
    if (y + menuHeight > viewportHeight) {
      y = viewportHeight - menuHeight - 10;
    }

    setContextMenu({ x, y, tabIndex: index });
  };

  const handleContextMenuAction = (action: "open" | "reveal" | "schema" | "autostore") => {
    if (contextMenu) {
      const config = configurations[contextMenu.tabIndex];
      if (config) {
        if (action === "open") {
          onOpenRawFile(config.configPath);
        } else if (action === "reveal") {
          onRevealInFinder(config.configPath);
        } else if (action === "schema" && config.schemaPath) {
          onOpenSchemaFile(config.schemaPath);
        } else if (action === "autostore") {
          onToggleAutostore(config.configPath);
          // Don't close the context menu immediately to allow multiple toggles
          return;
        }
      }
      setContextMenu(null);
    }
  };

  const handleClickOutside = () => {
    setContextMenu(null);
  };

  useEffect(() => {
    if (contextMenu) {
      const handleClick = () => handleClickOutside();
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [contextMenu]);

  return (
    <div className="tabs">
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {configurations.map((config, index) => {
            const hasPendingChanges =
              (pendingChanges[config.configPath] && Object.keys(pendingChanges[config.configPath]).length > 0) ||
              autostoreChanges[config.configPath] !== undefined;
            return (
              <div
                key={index}
                className={`tab ${selectedTab === index ? "active" : ""}`}
                onClick={() => onTabChange(index)}
                onContextMenu={(e) => handleTabRightClick(e, index)}
              >
                <span className="tab-label" title={config.configPath} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span className={`codicon ${getConfigIcon(config)}`} style={{ fontSize: "14px" }}></span>
                  {getTabLabel(config.configPath)}
                  {hasPendingChanges && (
                    <span
                      className="codicon codicon-circle-filled"
                      style={{
                        fontSize: "12px",
                        color: "var(--vscode-foreground)",
                        marginLeft: "4px",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                      }}
                      title="Unsaved changes"
                    />
                  )}
                </span>
              </div>
            );
          })}
          {/* Add new configuration button positioned like a browser tab - only show if there are existing configurations */}
          {configurations.length > 0 && (
            <div
              className="tab add-tab"
              onClick={onAddNewConfig}
              style={{
                minWidth: "32px",
                maxWidth: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                border: "1px solid var(--vscode-tab-border)",
                borderLeft: "none",
                backgroundColor: "var(--vscode-tab-inactiveBackground)",
                color: "var(--vscode-tab-inactiveForeground)",
              }}
              title="Add new configuration"
            >
              <span className="codicon codicon-add" style={{ fontSize: "14px" }}></span>
            </div>
          )}
        </div>

        {/* Help icons on the right side */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingRight: "12px" }}>
          <a
            href="https://docs.zowe.org/stable/user-guide/cli-using-using-team-profiles"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "24px",
              height: "24px",
              cursor: "pointer",
              color: "var(--vscode-foreground)",
              textDecoration: "none",
              borderRadius: "4px",
            }}
            title="Team Configuration Documentation"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--vscode-toolbar-hoverBackground)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <span className="codicon codicon-question" style={{ fontSize: "18px" }}></span>
          </a>
          <a
            href="https://github.com/zowe/zowe-explorer-vscode/issues"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "24px",
              height: "24px",
              cursor: "pointer",
              color: "var(--vscode-foreground)",
              textDecoration: "none",
              borderRadius: "4px",
            }}
            title="Report Issues"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--vscode-toolbar-hoverBackground)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <span className="codicon codicon-bug" style={{ fontSize: "18px" }}></span>
          </a>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            backgroundColor: "var(--vscode-menu-background)",
            border: "1px solid var(--vscode-menu-border)",
            borderRadius: "4px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
            zIndex: 1000,
            minWidth: "150px",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              padding: "4px 0",
              cursor: "pointer",
              paddingLeft: "12px",
              paddingRight: "12px",
              paddingTop: "6px",
              paddingBottom: "6px",
              fontSize: "13px",
              color: "var(--vscode-menu-foreground)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
            onClick={() => handleContextMenuAction("open")}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--vscode-menu-selectionBackground)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <span className="codicon codicon-go-to-file" style={{ fontSize: "12px", display: "flex", alignItems: "center" }}></span>
            Open File
          </div>
          <div
            style={{
              padding: "4px 0",
              cursor: "pointer",
              paddingLeft: "12px",
              paddingRight: "12px",
              paddingTop: "6px",
              paddingBottom: "6px",
              fontSize: "13px",
              color: "var(--vscode-menu-foreground)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
            onClick={() => handleContextMenuAction("reveal")}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--vscode-menu-selectionBackground)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <span className="codicon codicon-folder-opened" style={{ fontSize: "12px", display: "flex", alignItems: "center" }}></span>
            {getRevealText()}
          </div>
          {configurations[contextMenu.tabIndex]?.schemaPath && (
            <div
              style={{
                padding: "4px 0",
                cursor: "pointer",
                paddingLeft: "12px",
                paddingRight: "12px",
                paddingTop: "6px",
                paddingBottom: "6px",
                fontSize: "13px",
                color: "var(--vscode-menu-foreground)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
              onClick={() => handleContextMenuAction("schema")}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--vscode-menu-selectionBackground)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <span className="codicon codicon-file-code" style={{ fontSize: "12px", display: "flex", alignItems: "center" }}></span>
              Open Schema
            </div>
          )}
          <div
            style={{
              padding: "4px 0",
              cursor: "pointer",
              paddingLeft: "12px",
              paddingRight: "12px",
              paddingTop: "6px",
              paddingBottom: "6px",
              fontSize: "13px",
              color: "var(--vscode-menu-foreground)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
            onClick={() => handleContextMenuAction("autostore")}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--vscode-menu-selectionBackground)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <span className="codicon codicon-settings-gear" style={{ fontSize: "12px", display: "flex", alignItems: "center" }}></span>
            {(() => {
              const config = configurations[contextMenu.tabIndex];
              if (config) {
                const currentValue = config.properties?.autoStore;
                const pendingValue = autostoreChanges[config.configPath];
                const displayValue = pendingValue !== undefined ? pendingValue : currentValue;

                if (displayValue === undefined || displayValue === null) {
                  return "AutoStore: Unset";
                }

                return (
                  <>
                    AutoStore:{" "}
                    <span
                      style={{
                        color: displayValue ? "var(--vscode-testing-iconPassed)" : "var(--vscode-testing-iconFailed)",
                      }}
                    >
                      {displayValue.toString()}
                    </span>
                  </>
                );
              }
              return "AutoStore: Unset";
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
