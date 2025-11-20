import { useEffect, useCallback } from "react";
import { ConfigEditorSettings } from "../types";

export const CONFIG_EDITOR_SETTINGS_KEY = "zowe.configEditor.settings";

interface UsePanelResizerProps {
  profilesWidthPercent: number;
  setConfigEditorSettings: React.Dispatch<React.SetStateAction<ConfigEditorSettings>>;
  setLocalStorageValue: (key: string, value: any) => void;
  configEditorSettings: ConfigEditorSettings;
  configurations: any[];
}

export function usePanelResizer({
  profilesWidthPercent,
  setConfigEditorSettings,
  setLocalStorageValue,
  configEditorSettings,
  configurations,
}: UsePanelResizerProps) {
  // Function to apply stored width to panels
  const applyStoredWidth = useCallback(() => {
    const activePanel = document.querySelector(".panel.active .panel-content") as HTMLElement;
    if (activePanel) {
      const profilesSection = activePanel.querySelector(".profiles-section") as HTMLElement;
      const profileDetailsSection = activePanel.querySelector(".profile-details-section") as HTMLElement;

      if (profilesSection && profileDetailsSection) {
        const panelWidth = activePanel.getBoundingClientRect().width;
        const profilesWidth = (panelWidth * profilesWidthPercent) / 100;
        const minProfilesWidth = 200;
        const maxProfilesWidth = panelWidth * 0.7;

        const constrainedWidth = Math.max(minProfilesWidth, Math.min(maxProfilesWidth, profilesWidth));

        profilesSection.style.width = `${constrainedWidth}px`;
        profilesSection.style.flex = `0 0 auto`;
        profilesSection.style.maxWidth = `${maxProfilesWidth}px`;

        profileDetailsSection.style.width = "";
        profileDetailsSection.style.flex = "1";
        profileDetailsSection.style.maxWidth = "";
      }
    }
  }, [profilesWidthPercent]);

  // Apply stored width on initialization and when configurations change
  useEffect(() => {
    if (configurations.length > 0) {
      setTimeout(applyStoredWidth, 100);
    }
  }, [profilesWidthPercent, configurations, applyStoredWidth]);

  // Resize divider functionality
  useEffect(() => {
    const handleResize = (e: MouseEvent) => {
      const divider = document.querySelector(".resize-divider.dragging") as HTMLElement;
      if (!divider) return;

      const panelContent = divider.closest(".panel-content") as HTMLElement;
      if (!panelContent) return;

      const profilesSection = panelContent.querySelector(".profiles-section") as HTMLElement;
      const profileDetailsSection = panelContent.querySelector(".profile-details-section") as HTMLElement;

      if (!profilesSection || !profileDetailsSection) return;

      const panelRect = panelContent.getBoundingClientRect();
      const mouseX = e.clientX - panelRect.left;
      const panelWidth = panelRect.width;

      // Calculate new widths in pixels
      const dividerWidth = 22; // 22px for divider width and margins
      const availableWidth = panelWidth - dividerWidth;

      // Apply minimum and maximum constraints for profiles section only
      const minProfilesWidth = 200;
      const maxProfilesWidth = availableWidth * 0.7; // 70% of available width

      // Calculate desired width for profiles section based on mouse position
      const desiredProfilesWidth = mouseX;

      // Constrain profiles section
      const constrainedProfilesWidth = Math.max(minProfilesWidth, Math.min(maxProfilesWidth, desiredProfilesWidth));

      // Apply the new width to profiles section only
      profilesSection.style.width = `${constrainedProfilesWidth}px`;
      profilesSection.style.flex = `0 0 auto`;
      profilesSection.style.maxWidth = `${maxProfilesWidth}px`;

      // Let details section use remaining space (flex: 1)
      profileDetailsSection.style.width = "";
      profileDetailsSection.style.flex = "1";
      profileDetailsSection.style.maxWidth = "";
    };

    const handleMouseUp = () => {
      const draggingDivider = document.querySelector(".resize-divider.dragging");
      if (draggingDivider) {
        draggingDivider.classList.remove("dragging");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";

        // Save the current width percentage to localStorage
        const panelContent = draggingDivider.closest(".panel-content") as HTMLElement;
        if (panelContent) {
          const profilesSection = panelContent.querySelector(".profiles-section") as HTMLElement;
          if (profilesSection) {
            const panelWidth = panelContent.getBoundingClientRect().width;
            const profilesWidth = profilesSection.getBoundingClientRect().width;
            const newPercent = Math.round((profilesWidth / panelWidth) * 100);
            setConfigEditorSettings((prev) => ({ ...prev, profilesWidthPercent: newPercent }));
            setLocalStorageValue(CONFIG_EDITOR_SETTINGS_KEY, { ...configEditorSettings, profilesWidthPercent: newPercent });
          }
        }
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("resize-divider")) {
        e.preventDefault();
        target.classList.add("dragging");
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      }
    };

    document.addEventListener("mousemove", handleResize);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleMouseDown);

    return () => {
      document.removeEventListener("mousemove", handleResize);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [configEditorSettings, setConfigEditorSettings, setLocalStorageValue]);

  return { applyStoredWidth };
}
