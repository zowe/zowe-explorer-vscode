import * as l10n from "@vscode/l10n";
import { useModalClickOutside, useModalFocus } from "../../hooks";

interface AddConfigModalProps {
  isOpen: boolean;
  configurations: { configPath: string; properties: any; secure: string[]; global?: boolean; user?: boolean; schemaPath?: string }[];
  hasWorkspace: boolean;
  onAdd: (configType: string) => void;
  onCancel: () => void;
}

export function AddConfigModal({ isOpen, configurations, hasWorkspace, onAdd, onCancel }: AddConfigModalProps) {
  if (!isOpen) return null;

  const { modalRef: _clickOutsideRef, handleBackdropMouseDown, handleBackdropClick } = useModalClickOutside(onCancel);
  const modalRef = useModalFocus(isOpen, "button:not([disabled])");

  // Get all configuration types with their availability status
  const getAllConfigTypes = () => {
    const currentConfigs = configurations.length;
    const hasGlobalTeam = configurations.some((c) => c.global && !c.user);
    const hasGlobalUser = configurations.some((c) => c.global && c.user);
    const hasProjectTeam = configurations.some((c) => !c.global && !c.user);
    const hasProjectUser = configurations.some((c) => !c.global && c.user);

    const types = [
      {
        id: "global:true,user:false",
        value: "global-team",
        label: "Global Team Configuration",
        description: "Shared across all workspaces",
        disabled: hasGlobalTeam || currentConfigs >= 4,
        reason: hasGlobalTeam ? "Already exists" : currentConfigs >= 4 ? "Maximum configurations reached" : null,
      },
      {
        id: "global:true,user:true",
        value: "global-user",
        label: "Global User Configuration",
        description: "Global team configuration overwrites",
        disabled: hasGlobalUser || currentConfigs >= 4,
        reason: hasGlobalUser ? "Already exists" : currentConfigs >= 4 ? "Maximum configurations reached" : null,
      },
      {
        id: "global:false,user:false",
        value: "project-team",
        label: "Project Team Configuration",
        description: "Team configuration overwrites for this project",
        disabled: hasProjectTeam || currentConfigs >= 4 || !hasWorkspace,
        reason: hasProjectTeam
          ? "Already exists"
          : currentConfigs >= 4
          ? "Maximum configurations reached"
          : !hasWorkspace
          ? "No current workspace"
          : null,
      },
      {
        id: "global:false,user:true",
        value: "project-user",
        label: "Project User Configuration",
        description: "User configuration overwrites for this project",
        disabled: hasProjectUser || currentConfigs >= 4 || !hasWorkspace,
        reason: hasProjectUser
          ? "Already exists"
          : currentConfigs >= 4
          ? "Maximum configurations reached"
          : !hasWorkspace
          ? "No current workspace"
          : null,
      },
    ];

    return types;
  };

  const allConfigTypes = getAllConfigTypes();
  const availableTypes = allConfigTypes.filter((type) => !type.disabled);

  const handleKeyDown = (e: any) => {
    if (e.key === "Enter") {
      // Find the first available config type and add it
      const firstAvailableType = availableTypes[0];
      if (firstAvailableType) {
        onAdd(firstAvailableType.value);
      }
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div
        ref={modalRef}
        style={{
          backgroundColor: "var(--vscode-editor-background)",
          border: "1px solid var(--vscode-panel-border)",
          borderRadius: "6px",
          padding: "20px",
          minWidth: "400px",
          maxWidth: "500px",
          maxHeight: "80vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600" }}>{l10n.t("Add New Configuration File")}</h2>

        {configurations.length >= 4 ? (
          <div style={{ color: "var(--vscode-errorForeground)", marginBottom: "16px" }}>
            {l10n.t("Maximum of 4 configuration files allowed. Please remove an existing configuration before adding a new one.")}
          </div>
        ) : (
          <>
            {availableTypes.length === 0 && (
              <div
                style={{
                  color: "var(--vscode-warningForeground)",
                  marginBottom: "16px",
                  padding: "8px 12px",
                  backgroundColor: "var(--vscode-inputValidation-warningBackground)",
                  border: "1px solid var(--vscode-inputValidation-warningBorder)",
                  borderRadius: "4px",
                  fontSize: "13px",
                }}
              >
                {l10n.t(
                  "All configuration types are currently unavailable. Remove existing configurations or open a workspace to enable more options."
                )}
              </div>
            )}

            {/* <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "var(--vscode-descriptionForeground)" }}>
              {l10n.t("Select the type of configuration file to create:")}
            </p> */}
            <p
              style={{
                margin: "0 0 16px 0",
                fontSize: "140x",
                color: "var(--vscode-descriptionForeground)",
                fontStyle: "italic",
              }}
            >
              {l10n.t("Warning: Creation/deletion of configuration files are immediately written to disk and cannot be undone by refreshing")}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
              {allConfigTypes.map((type) => (
                <button
                  key={type.value}
                  id={type.id}
                  onClick={() => !type.disabled && onAdd(type.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !type.disabled) {
                      onAdd(type.value);
                    } else if (e.key === "Escape") {
                      onCancel();
                    }
                  }}
                  disabled={type.disabled}
                  style={{
                    padding: "12px",
                    border: "1px solid var(--vscode-button-border)",
                    borderRadius: "4px",
                    backgroundColor: type.disabled ? "var(--vscode-input-disabledBackground)" : "var(--vscode-button-secondaryBackground)",
                    color: type.disabled ? "var(--vscode-disabledForeground)" : "var(--vscode-button-secondaryForeground)",
                    cursor: type.disabled ? "not-allowed" : "pointer",
                    textAlign: "left",
                    fontSize: "14px",
                    transition: "all 0.2s ease",
                    opacity: type.disabled ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!type.disabled) {
                      e.currentTarget.style.backgroundColor = "var(--vscode-button-secondaryHoverBackground)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!type.disabled) {
                      e.currentTarget.style.backgroundColor = "var(--vscode-button-secondaryBackground)";
                    }
                  }}
                >
                  <div
                    style={{
                      fontWeight: "500",
                      marginBottom: "4px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>{type.label}</span>
                    {type.disabled && type.reason && (
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--vscode-errorForeground)",
                          fontWeight: "normal",
                        }}
                      >
                        {type.reason}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: type.disabled ? "var(--vscode-disabledForeground)" : "var(--vscode-descriptionForeground)",
                    }}
                  >
                    {type.description}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            onClick={onCancel}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                onCancel();
              }
            }}
            style={{
              padding: "8px 16px",
              border: "1px solid var(--vscode-button-border)",
              borderRadius: "4px",
              backgroundColor: "var(--vscode-button-secondaryBackground)",
              color: "var(--vscode-button-secondaryForeground)",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            {l10n.t("Cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
