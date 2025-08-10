import * as l10n from "@vscode/l10n";

interface AddConfigModalProps {
  isOpen: boolean;
  configurations: { configPath: string; properties: any; secure: string[]; global?: boolean; user?: boolean }[];
  hasWorkspace: boolean;
  onAdd: (configType: string) => void;
  onCancel: () => void;
}

export function AddConfigModal({ isOpen, configurations, hasWorkspace, onAdd, onCancel }: AddConfigModalProps) {
  if (!isOpen) return null;

  // Determine available configuration types based on current state
  const getAvailableConfigTypes = () => {
    const types = [];
    const currentConfigs = configurations.length;

    // Check if we can add more configs (max 4)
    if (currentConfigs >= 4) {
      return [];
    }

    // Check existing config types
    const hasGlobalTeam = configurations.some((c) => c.global && !c.user);
    const hasGlobalUser = configurations.some((c) => c.global && c.user);
    const hasProjectTeam = configurations.some((c) => !c.global && !c.user);
    const hasProjectUser = configurations.some((c) => !c.global && c.user);

    // Global Team config
    if (!hasGlobalTeam) {
      types.push({ value: "global-team", label: "Global Team Configuration", description: "Shared across all users on this machine" });
    }

    // Global User config
    if (!hasGlobalUser) {
      types.push({ value: "global-user", label: "Global User Configuration", description: "Personal configuration for this user" });
    }

    // Project Team config (only if workspace is open)
    if (hasWorkspace && !hasProjectTeam) {
      types.push({ value: "project-team", label: "Project Team Configuration", description: "Shared configuration for this project" });
    }

    // Project User config (only if workspace is open)
    if (hasWorkspace && !hasProjectUser) {
      types.push({ value: "project-user", label: "Project User Configuration", description: "Personal configuration for this project" });
    }

    return types;
  };

  const availableTypes = getAvailableConfigTypes();

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
      onClick={onCancel}
    >
      <div
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
        ) : !hasWorkspace && !configurations.some((c) => !c.global) ? (
          <div style={{ color: "var(--vscode-errorForeground)", marginBottom: "16px" }}>
            {l10n.t("No workspace is currently open. Project configurations can only be created when a workspace is open.")}
          </div>
        ) : availableTypes.length === 0 ? (
          <div style={{ color: "var(--vscode-errorForeground)", marginBottom: "16px" }}>
            {l10n.t("All available configuration types are already in use.")}
          </div>
        ) : (
          <>
            <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "var(--vscode-descriptionForeground)" }}>
              {l10n.t("Select the type of configuration file to create:")}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
              {availableTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => onAdd(type.value)}
                  style={{
                    padding: "12px",
                    border: "1px solid var(--vscode-button-border)",
                    borderRadius: "4px",
                    backgroundColor: "var(--vscode-button-secondaryBackground)",
                    color: "var(--vscode-button-secondaryForeground)",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: "14px",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--vscode-button-secondaryHoverBackground)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--vscode-button-secondaryBackground)";
                  }}
                >
                  <div style={{ fontWeight: "500", marginBottom: "4px" }}>{type.label}</div>
                  <div style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)" }}>{type.description}</div>
                </button>
              ))}
            </div>
          </>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            onClick={onCancel}
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
