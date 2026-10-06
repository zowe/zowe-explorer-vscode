import { useState, useEffect, useRef } from "react";
import * as l10n from "@vscode/l10n";
import { VscodeToolbarButton } from "@vscode-elements/react-elements";
import { useConfigContext } from "../context/ConfigContext";
import { useElementWidth } from "../hooks/useElementWidth";

export interface TabsProps {
  onTabChange: (index: number) => void;
  onOpenFile: (filePath: string) => void;
  onRevealInFinder: (filePath: string) => void;
  onOpenSchemaFile: (filePath: string) => void;
  onAddNewConfig: () => void;
  onToggleAutostore: (configPath: string) => void;
  onShowTutorial: () => void;
  onExportRedacted: () => void;
}

export function Tabs({
  onTabChange,
  onOpenFile,
  onRevealInFinder,
  onOpenSchemaFile,
  onAddNewConfig,
  onToggleAutostore,
  onShowTutorial,
  onExportRedacted,
}: TabsProps) {
  const { configurations, selectedTab, pendingChanges, autostoreChanges, renames, deletions, pendingDefaults, defaultsDeletions } =
    useConfigContext();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabIndex: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const [tabBarRef, tabBarWidth] = useElementWidth<HTMLDivElement>();
  const isNarrowToolbar = tabBarWidth > 0 && tabBarWidth < 650;
  const isNarrowTabs = tabBarWidth > 0 && tabBarWidth < 340;
  const shouldCollapseTabs = isNarrowTabs && configurations.length > 1;

  const [kebabOpen, setKebabOpen] = useState(false);
  const [kebabPos, setKebabPos] = useState<{ top: number; right: number } | null>(null);
  const kebabButtonRef = useRef<HTMLDivElement>(null);
  const kebabMenuRef = useRef<HTMLDivElement>(null);

  const [tabDropdownOpen, setTabDropdownOpen] = useState(false);
  const [tabDropdownPos, setTabDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const tabDropdownTriggerRef = useRef<HTMLDivElement>(null);
  const tabDropdownMenuRef = useRef<HTMLDivElement>(null);

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

  const checkPendingChanges = (config: { configPath: string }) => {
    const configPendingChanges = pendingChanges[config.configPath] || {};
    const configPendingDefaults = pendingDefaults[config.configPath] || {};
    const hasRegularChanges = Object.keys(configPendingChanges).length > 0;
    const hasDefaultsChanges = Object.keys(configPendingDefaults).length > 0;
    const hasProfilePropertyChanges = Object.keys(configPendingChanges).some((key) => key.startsWith("profiles."));
    const hasDeletions = deletions[config.configPath] && deletions[config.configPath].length > 0;
    const hasDefaultsDeletions = defaultsDeletions[config.configPath] && defaultsDeletions[config.configPath].length > 0;
    return (
      hasRegularChanges ||
      hasDefaultsChanges ||
      hasProfilePropertyChanges ||
      autostoreChanges[config.configPath] !== undefined ||
      (renames[config.configPath] && Object.keys(renames[config.configPath]).length > 0) ||
      hasDeletions ||
      hasDefaultsDeletions
    );
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
          onOpenFile(config.configPath);
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

  const handleKebabToggle = () => {
    if (!kebabOpen && kebabButtonRef.current) {
      const rect = kebabButtonRef.current.getBoundingClientRect();
      const top = rect.bottom + 2;
      const right = Math.max(8, window.innerWidth - rect.right);
      setKebabPos({ top, right });
      setKebabOpen(true);
      setTabDropdownOpen(false);
      setContextMenu(null);
    } else {
      setKebabOpen(false);
    }
  };

  const handleTabDropdownToggle = () => {
    if (!tabDropdownOpen && tabDropdownTriggerRef.current) {
      const rect = tabDropdownTriggerRef.current.getBoundingClientRect();
      const top = rect.bottom + 2;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - 240));
      setTabDropdownPos({ top, left });
      setTabDropdownOpen(true);
      setKebabOpen(false);
      setContextMenu(null);
    } else {
      setTabDropdownOpen(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideContextMenu = contextMenuRef.current && contextMenuRef.current.contains(target);
      if (contextMenu && !isInsideContextMenu) {
        setContextMenu(null);
      }
      const isInsideKebab =
        (kebabButtonRef.current && kebabButtonRef.current.contains(target)) || (kebabMenuRef.current && kebabMenuRef.current.contains(target));
      if (kebabOpen && !isInsideKebab) {
        setKebabOpen(false);
      }

      const isInsideTabDropdown =
        (tabDropdownTriggerRef.current && tabDropdownTriggerRef.current.contains(target)) ||
        (tabDropdownMenuRef.current && tabDropdownMenuRef.current.contains(target));
      if (tabDropdownOpen && !isInsideTabDropdown) {
        setTabDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setKebabOpen(false);
        setTabDropdownOpen(false);
        setContextMenu(null);
      }
    };

    const handleResize = () => {
      setKebabOpen(false);
      setTabDropdownOpen(false);
      setContextMenu(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [contextMenu, kebabOpen, tabDropdownOpen]);

  const activeConfig = selectedTab !== null ? configurations[selectedTab] : null;
  const activeHasPendingChanges = activeConfig ? checkPendingChanges(activeConfig) : false;

  return (
    <div className="tabs" ref={tabBarRef}>
      <div className="tabs-row-flex">
        {shouldCollapseTabs ? (
          <div className="tabs-collapsed-container">
            <div className="tab-dropdown-container" ref={tabDropdownTriggerRef}>
              <div
                className="tab active tab-dropdown-trigger"
                id={activeConfig ? `global:${activeConfig.global},user:${activeConfig.user}` : undefined}
                onClick={handleTabDropdownToggle}
                onContextMenu={(e) => {
                  if (selectedTab !== null) {
                    handleTabRightClick(e, selectedTab);
                  }
                }}
                tabIndex={0}
                role="tab"
                aria-haspopup="true"
                aria-expanded={tabDropdownOpen}
                title={activeConfig?.configPath}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleTabDropdownToggle();
                  }
                }}
              >
                <span className="tab-label tab-label-row">
                  <span className={`codicon codicon-size-14 ${activeConfig ? getConfigIcon(activeConfig) : "codicon-folder"}`}></span>
                  <span className="tab-label-text">{activeConfig ? getTabLabel(activeConfig) : l10n.t("Select Configuration")}</span>
                  {activeHasPendingChanges && (
                    <span className="codicon codicon-circle-filled tab-unsaved-indicator" title={l10n.t("Unsaved changes")} />
                  )}
                  <span className={`codicon ${tabDropdownOpen ? "codicon-chevron-up" : "codicon-chevron-down"} tab-dropdown-trigger-chevron`}></span>
                </span>
              </div>
            </div>

            {/* Add new configuration button positioned like a browser tab */}
            {configurations.length > 0 && (
              <div
                className="tab add-tab"
                id="add-config-layer-button"
                onClick={onAddNewConfig}
                role="button"
                tabIndex={0}
                title={l10n.t("Add new configuration")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onAddNewConfig();
                  }
                }}
              >
                <span className="codicon codicon-add codicon-size-14"></span>
              </div>
            )}
          </div>
        ) : (
          <div className="tabs-list-scrollable">
            {configurations.map((config, index) => {
              const hasPendingChanges = checkPendingChanges(config);
              return (
                <div
                  key={index}
                  className={`tab ${selectedTab === index ? "active" : ""}`}
                  id={`global:${config.global},user:${config.user}`}
                  onClick={() => onTabChange(index)}
                  onContextMenu={(e) => handleTabRightClick(e, index)}
                  tabIndex={0}
                  role="tab"
                  aria-selected={selectedTab === index}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onTabChange(index);
                    }
                  }}
                >
                  <span className="tab-label tab-label-row" title={config.configPath}>
                    <span className={`codicon codicon-size-14 ${getConfigIcon(config)}`}></span>
                    <span className="tab-label-text">{getTabLabel(config)}</span>
                    {hasPendingChanges && <span className="codicon codicon-circle-filled tab-unsaved-indicator" title={l10n.t("Unsaved changes")} />}
                  </span>
                </div>
              );
            })}
            {/* Add new configuration button positioned like a browser tab - only show if there are existing configurations */}
            {configurations.length > 0 && (
              <div
                className="tab add-tab"
                id="add-config-layer-button"
                onClick={onAddNewConfig}
                role="button"
                tabIndex={0}
                title={l10n.t("Add new configuration")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onAddNewConfig();
                  }
                }}
              >
                <span className="codicon codicon-add codicon-size-14"></span>
              </div>
            )}
          </div>
        )}

        {isNarrowToolbar ? (
          <div className="tabs-toolbar">
            <div className="sort-dropdown tabs-overflow-dropdown" ref={kebabButtonRef}>
              <VscodeToolbarButton
                className="sort-dropdown-trigger"
                onClick={handleKebabToggle}
                aria-expanded={kebabOpen}
                aria-haspopup="true"
                title={l10n.t("More Actions")}
                data-testid="tabs-more-actions"
              >
                <span className="codicon codicon-more"></span>
              </VscodeToolbarButton>
            </div>
          </div>
        ) : (
          <div className="tabs-toolbar">
            <VscodeToolbarButton
              onClick={
                selectedTab === null
                  ? undefined
                  : () => {
                      const configPath = configurations[selectedTab]?.configPath;
                      if (configPath) {
                        onOpenFile(configPath);
                      }
                    }
              }
              aria-disabled={selectedTab === null}
              tabIndex={selectedTab === null ? -1 : 0}
              title={l10n.t("Open File")}
              data-testid="open-config-file"
            >
              <span className="codicon codicon-go-to-file codicon-size-16"></span>
            </VscodeToolbarButton>
            <VscodeToolbarButton onClick={onExportRedacted} title={l10n.t("Export redacted configuration")} data-testid="export-redacted">
              <span className="codicon codicon-export codicon-size-16"></span>
            </VscodeToolbarButton>
            <span className="tabs-toolbar-separator" role="separator" />
            <VscodeToolbarButton onClick={onShowTutorial} title={l10n.t("Open Tutorial")} data-testid="open-tutorial">
              <span className="codicon codicon-mortar-board codicon-size-16"></span>
            </VscodeToolbarButton>
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
        )}
      </div>

      {/* Tab Dropdown Menu (Narrow View) */}
      {tabDropdownOpen && tabDropdownPos && (
        <div
          ref={tabDropdownMenuRef}
          className="sort-dropdown-list tab-dropdown-list"
          role="tablist"
          style={{
            position: "fixed",
            top: tabDropdownPos.top,
            left: tabDropdownPos.left,
            right: "auto",
            minWidth: "220px",
            maxWidth: "calc(100vw - 16px)",
            maxHeight: "300px",
            overflowX: "hidden",
            overflowY: "auto",
            zIndex: 1000,
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {configurations.map((config, index) => {
            const isSelected = selectedTab === index;
            const hasPendingChanges = checkPendingChanges(config);
            return (
              <div
                key={index}
                className={`sort-dropdown-item tab-dropdown-item ${isSelected ? "selected" : ""}`}
                role="tab"
                aria-selected={isSelected}
                tabIndex={0}
                id={`global:${config.global},user:${config.user}`}
                onClick={() => {
                  onTabChange(index);
                  setTabDropdownOpen(false);
                }}
                onContextMenu={(e) => {
                  handleTabRightClick(e, index);
                  setTabDropdownOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onTabChange(index);
                    setTabDropdownOpen(false);
                  }
                }}
              >
                <span className={`codicon codicon-size-14 ${getConfigIcon(config)} sort-dropdown-item-icon`}></span>
                <div className="sort-dropdown-item-content">
                  <div className="sort-dropdown-item-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>{getTabLabel(config)}</span>
                    {hasPendingChanges && <span className="codicon codicon-circle-filled tab-unsaved-indicator" title={l10n.t("Unsaved changes")} />}
                  </div>
                  <div className="sort-dropdown-item-description" title={config.configPath}>
                    {config.configPath}
                  </div>
                </div>
                {isSelected && <span className="codicon codicon-check" style={{ marginLeft: "auto", fontSize: "14px" }}></span>}
              </div>
            );
          })}
          <div className="header-overflow-divider" style={{ height: "1px", backgroundColor: "var(--vscode-dropdown-border)", margin: "4px 0" }}></div>
          <div
            className="sort-dropdown-item"
            role="button"
            tabIndex={0}
            onClick={() => {
              onAddNewConfig();
              setTabDropdownOpen(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onAddNewConfig();
                setTabDropdownOpen(false);
              }
            }}
          >
            <span className="codicon codicon-add sort-dropdown-item-icon"></span>
            <div className="sort-dropdown-item-content">
              <div className="sort-dropdown-item-label">{l10n.t("Add new configuration")}</div>
            </div>
          </div>
        </div>
      )}

      {/* Kebab Overflow Menu (Narrow View) */}
      {kebabOpen && kebabPos && (
        <div
          ref={kebabMenuRef}
          className="sort-dropdown-list tabs-kebab-menu"
          role="menu"
          style={{
            position: "fixed",
            top: kebabPos.top,
            right: kebabPos.right,
            left: "auto",
            width: "max-content",
            maxWidth: "calc(100vw - 16px)",
            maxHeight: "none",
            overflowX: "hidden",
            overflowY: "auto",
            zIndex: 1000,
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div
            className={`sort-dropdown-item ${selectedTab === null ? "disabled" : ""}`}
            role="menuitem"
            aria-disabled={selectedTab === null}
            tabIndex={selectedTab === null ? -1 : 0}
            data-testid="open-config-file"
            onClick={() => {
              if (selectedTab !== null) {
                const configPath = configurations[selectedTab]?.configPath;
                if (configPath) {
                  onOpenFile(configPath);
                }
              }
              setKebabOpen(false);
            }}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && selectedTab !== null) {
                e.preventDefault();
                const configPath = configurations[selectedTab]?.configPath;
                if (configPath) {
                  onOpenFile(configPath);
                }
                setKebabOpen(false);
              }
            }}
          >
            <span className="codicon codicon-go-to-file sort-dropdown-item-icon"></span>
            <div className="sort-dropdown-item-content">
              <div className="sort-dropdown-item-label">{l10n.t("Open File")}</div>
            </div>
          </div>
          <div
            className="sort-dropdown-item"
            role="menuitem"
            tabIndex={0}
            data-testid="export-redacted"
            onClick={() => {
              onExportRedacted();
              setKebabOpen(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onExportRedacted();
                setKebabOpen(false);
              }
            }}
          >
            <span className="codicon codicon-export sort-dropdown-item-icon"></span>
            <div className="sort-dropdown-item-content">
              <div className="sort-dropdown-item-label">{l10n.t("Export redacted configuration")}</div>
            </div>
          </div>
          <div className="header-overflow-divider" style={{ height: "1px", backgroundColor: "var(--vscode-dropdown-border)", margin: "4px 0" }}></div>
          <div
            className="sort-dropdown-item"
            role="menuitem"
            tabIndex={0}
            data-testid="open-tutorial"
            onClick={() => {
              onShowTutorial();
              setKebabOpen(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onShowTutorial();
                setKebabOpen(false);
              }
            }}
          >
            <span className="codicon codicon-mortar-board sort-dropdown-item-icon"></span>
            <div className="sort-dropdown-item-content">
              <div className="sort-dropdown-item-label">{l10n.t("Open Tutorial")}</div>
            </div>
          </div>
          <a
            className="sort-dropdown-item"
            role="menuitem"
            href="https://docs.zowe.org/stable/user-guide/cli-using-using-team-profiles"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setKebabOpen(false)}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <span className="codicon codicon-question sort-dropdown-item-icon"></span>
            <div className="sort-dropdown-item-content">
              <div className="sort-dropdown-item-label">{l10n.t("Team Configuration Documentation")}</div>
            </div>
          </a>
          <a
            className="sort-dropdown-item"
            role="menuitem"
            href="https://github.com/zowe/zowe-explorer-vscode/issues"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setKebabOpen(false)}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <span className="codicon codicon-bug sort-dropdown-item-icon"></span>
            <div className="sort-dropdown-item-content">
              <div className="sort-dropdown-item-label">{l10n.t("Report Issues")}</div>
            </div>
          </a>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="tab-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="tab-context-menu-item" onClick={() => handleContextMenuAction("open")} id="tab-open-file">
            <span className="codicon codicon-go-to-file codicon-tab-menu-icon"></span>
            {l10n.t("Open File")}
          </div>
          <div className="tab-context-menu-item" onClick={() => handleContextMenuAction("reveal")} id="tab-reveal-file">
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
