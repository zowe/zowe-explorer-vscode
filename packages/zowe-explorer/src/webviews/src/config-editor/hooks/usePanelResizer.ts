import { applyProfilePanelWidth, MIN_PROFILES_WIDTH, MIN_DETAILS_WIDTH, PROFILE_DIVIDER_WIDTH } from "../utils/panelWidths";
import { useEffect, useCallback } from "react";
import type { Configuration, ConfigEditorSettings } from "../types";

export const CONFIG_EDITOR_SETTINGS_KEY = "zowe.configEditor.settings";
const DEFAULT_PROFILES_WIDTH_PERCENT = 35;

interface UsePanelResizerProps {
    profilesWidthPercent: number;
    setConfigEditorSettings: React.Dispatch<React.SetStateAction<ConfigEditorSettings>>;
    setLocalStorageValue: (key: string, value: unknown) => void;
    configEditorSettings: ConfigEditorSettings;
    configurations: Configuration[];
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
            const panelWidth = activePanel.getBoundingClientRect().width;
            applyProfilePanelWidth(
                activePanel,
                (panelWidth * profilesWidthPercent) / 100,
                Math.max(MIN_PROFILES_WIDTH, panelWidth - MIN_DETAILS_WIDTH)
            );
        }
    }, [profilesWidthPercent]);

    useEffect(() => {
        if (configurations.length === 0) {
            return;
        }
        let rafId = requestAnimationFrame(() => {
            rafId = requestAnimationFrame(applyStoredWidth);
        });
        return () => cancelAnimationFrame(rafId);
    }, [profilesWidthPercent, configurations, applyStoredWidth]);

    // Resize divider functionality
    useEffect(() => {
        const handleResize = (e: MouseEvent) => {
            const divider = document.querySelector(".resize-divider.dragging") as HTMLElement;
            if (!divider) return;

            const panelContent = divider.closest(".panel-content") as HTMLElement;
            if (!panelContent) return;

            const panelRect = panelContent.getBoundingClientRect();
            const desiredWidth = e.clientX - panelRect.left;
            const maxWidth = Math.max(MIN_PROFILES_WIDTH, panelRect.width - PROFILE_DIVIDER_WIDTH - MIN_DETAILS_WIDTH);
            applyProfilePanelWidth(panelContent, desiredWidth, maxWidth);
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

        const handleDoubleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains("resize-divider")) {
                e.preventDefault();
                setConfigEditorSettings((prev) => ({ ...prev, profilesWidthPercent: DEFAULT_PROFILES_WIDTH_PERCENT }));
                setLocalStorageValue(CONFIG_EDITOR_SETTINGS_KEY, {
                    ...configEditorSettings,
                    profilesWidthPercent: DEFAULT_PROFILES_WIDTH_PERCENT,
                });
            }
        };

        document.addEventListener("mousemove", handleResize);
        document.addEventListener("mouseup", handleMouseUp);
        document.addEventListener("mousedown", handleMouseDown);
        document.addEventListener("dblclick", handleDoubleClick);

        return () => {
            document.removeEventListener("mousemove", handleResize);
            document.removeEventListener("mouseup", handleMouseUp);
            document.removeEventListener("mousedown", handleMouseDown);
            document.removeEventListener("dblclick", handleDoubleClick);
        };
    }, [configEditorSettings, setConfigEditorSettings, setLocalStorageValue]);

    return { applyStoredWidth };
}
