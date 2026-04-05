import { useState, useEffect } from "react";
import * as l10n from "@vscode/l10n";
import { useConfigContext } from "../context/ConfigContext";

interface TabsProps {
  onTabChange: (index: number) => void;
  onOpenRawFile: (filePath: string) => void;
  onRevealInFinder: (filePath: string) => void;
  onOpenSchemaFile: (filePath: string) => void;
  onAddNewConfig: () => void;
  onToggleAutostore: (configPath: string) => void;
}

export function Tabs({ onTabChange, onOpenRawFile, onRevealInFinder, onOpenSchemaFile, onAddNewConfig, onToggleAutostore }: TabsProps) {
  const { configurations, selectedTab, pendingChanges, autostoreChanges, renames, deletions, pendingDefaults, defaultsDeletions } =
    useConfigContext();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabIndex: number } | null>(null);

  const getRevealText = () => {
    const platform = navigator.platform.toLowerCase();
    if (platform.includes("mac")) {
      return l10n.t("Reveal in Finder");
    } else if (platform.includes("win")) {
      return l10n.t("Reveal in File Explorer");
    } else {
      return l10n.t("Reveal in File Manager");
    }
  };

  const getTabLabel = (config: { global?: boolean; user?: boolean }) => {
    if (config.global && config.user) {
      return l10n.t("Global User");
    } else if (config.global && !config.user) {
      return l10n.t("Global Team");
    } else if (!config.global && config.user) {
      return l10n.t("Project User");
    } else {
      return l10n.t("Project Team");
    }
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

    const menuWidth = 150;
    const menuHeight = 160;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > viewportWidth) {
      x = viewportWidth - menuWidth - 10;
    }

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
      <div className="tabs-row-flex">
        <div className="tabs-row-flex">
          {configurations.map((config, index) => {
            const configPendingChanges = pendingChanges[config.configPath] || {};
            const configPendingDefaults = pendingDefaults[config.configPath] || {};
            const hasRegularChanges = Object.keys(configPendingChanges).length > 0;
            const hasDefaultsChanges = Object.keys(configPendingDefaults).length > 0;
            const hasProfilePropertyChanges = Object.keys(configPendingChanges).some((key) => key.startsWith("profiles."));
            const hasDeletions = deletions[config.configPath] && deletions[config.configPath].length > 0;
            const hasDefaultsDeletions = defaultsDeletions[config.configPath] && defaultsDeletions[config.configPath].length > 0;
            const hasPendingChanges =
              hasRegularChanges ||
              hasDefaultsChanges ||
              hasProfilePropertyChanges ||
              autostoreChanges[config.configPath] !== undefined ||
              (renames[config.configPath] && Object.keys(renames[config.configPath]).length > 0) ||
              hasDeletions ||
              hasDefaultsDeletions;
            return (
              <div
                key={index}
                className={`tab ${selectedTab === index ? "active" : ""}`}
                id={`global:${config.global},user:${config.user}`}
                onClick={() => onTabChange(index)}
                onContextMenu={(e) => handleTabRightClick(e, index)}
              >
                <span className="tab-label tab-label-row" title={config.configPath}>
                  <span className={`codicon codicon-size-14 ${getConfigIcon(config)}`}></span>
                  {getTabLabel(config)}
                  {hasPendingChanges && (
                    <span className="codicon codicon-circle-filled tab-unsaved-indicator" title={l10n.t("Unsaved changes")} />
                  )}
                </span>
              </div>
            );
          })}
          {/* Add new configuration button positioned like a browser tab - only show if there are existing configurations */}
          {configurations.length > 0 && (
            <div className="tab add-tab" id="add-config-layer-button" onClick={onAddNewConfig} role="button" title={l10n.t("Add new configuration")}>
              <span className="codicon codicon-add codicon-size-14"></span>
            </div>
          )}
        </div>

        <div className="tabs-toolbar">
          <a
            className="ce-icon-button"
            href="https://docs.zowe.org/stable/user-guide/cli-using-using-team-profiles"
            target="_blank"
            rel="noopener noreferrer"
            title={l10n.t("Team Configuration Documentation")}
          >
            <span className="codicon codicon-question codicon-size-16"></span>
          </a>
          <a
            className="ce-icon-button"
            href="https://github.com/zowe/zowe-explorer-vscode/issues"
            target="_blank"
            rel="noopener noreferrer"
            title={l10n.t("Report Issues")}
          >
            <span className="codicon codicon-bug codicon-size-16"></span>
          </a>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="tab-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="tab-context-menu-item" onClick={() => handleContextMenuAction("open")} id="tab-open-file">
            <span id="open-file" className="codicon codicon-go-to-file codicon-tab-menu-icon"></span>
            {l10n.t("Open File")}
          </div>
          <div className="tab-context-menu-item" onClick={() => handleContextMenuAction("reveal")}>
            <span className="codicon codicon-folder-opened codicon-tab-menu-icon"></span>
            {getRevealText()}
          </div>
          {configurations[contextMenu.tabIndex]?.schemaPath && (
            <div className="tab-context-menu-item" onClick={() => handleContextMenuAction("schema")} id="tab-open-schema">
              <span id="open-schema" className="codicon codicon-file-code codicon-tab-menu-icon"></span>
              {l10n.t("Open Schema")}
            </div>
          )}
          <div className="tab-context-menu-item" onClick={() => handleContextMenuAction("autostore")} id="tab-toggle-autostore">
            <span className="codicon codicon-settings-gear codicon-tab-menu-icon"></span>
            {(() => {
              const config = configurations[contextMenu.tabIndex];
              if (config) {
                const currentValue = config.properties?.autoStore;
                const pendingValue = autostoreChanges[config.configPath];
                const displayValue = pendingValue !== undefined ? pendingValue : currentValue;

                if (displayValue === undefined || displayValue === null) {
                  return l10n.t("AutoStore: Unset");
                }

                return (
                  <>
                    {l10n.t("AutoStore:")}{" "}
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
              return l10n.t("AutoStore: Unset");
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
