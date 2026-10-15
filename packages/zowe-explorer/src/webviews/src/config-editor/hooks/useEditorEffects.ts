import { useEffect, useRef } from "react";
import { useEditorFields, useEditorStore, useEditorStoreApi } from "../context/EditorStoreContext";
import { usePanelResizer } from "./usePanelResizer";
import { selectHasPendingChanges } from "../store/selectors";
import { createUtilityHelpers } from "../store/utilityHelpers";
import { flattenProfiles } from "../utils";
import { getOriginalProfileKeyWithNested, getProfileType } from "../utils/profileUtils";

/** Browser effects are lifecycle-bound; all callbacks read the current scoped store. */
export function useEditorEffects() {
    const store = useEditorStoreApi();
    const {
        selectedTab,
        configurations,
        selectedProfileKey,
        pendingChanges,
        deletions,
        pendingDefaults,
        defaultsDeletions,
        autostoreChanges,
        renames,
        sortOrderVersion,
        isSaving,
        configEditorSettings,
        setConfigEditorSettings,
        setLocalStorageValue,
        profileFilterType,
        profileMenuOpen,
        undo,
        redo,
    } = useEditorFields(
        "selectedTab",
        "configurations",
        "selectedProfileKey",
        "pendingChanges",
        "deletions",
        "pendingDefaults",
        "defaultsDeletions",
        "autostoreChanges",
        "renames",
        "sortOrderVersion",
        "isSaving",
        "configEditorSettings",
        "setConfigEditorSettings",
        "setLocalStorageValue",
        "profileFilterType",
        "profileMenuOpen",
        "undo",
        "redo"
    );
    const hasPendingChanges = useEditorStore(selectHasPendingChanges);
    const modalOpen = useEditorStore(
        (state) =>
            state.newProfileModalOpen ||
            state.saveModalOpen ||
            state.newLayerModalOpen ||
            state.wizardModalOpen ||
            state.renameProfileModalOpen ||
            state.configParseErrors.length > 0 ||
            state.addConfigModalOpen
    );
    const previousSelection = useRef<string | null>(null);
    const { applyStoredWidth } = usePanelResizer({
        profilesWidthPercent: configEditorSettings.profilesWidthPercent,
        configEditorSettings,
        configurations,
        setConfigEditorSettings,
        setLocalStorageValue,
    });
    useEffect(applyStoredWidth, [selectedTab, applyStoredWidth]);
    useEffect(() => {
        store.getState().vscodeApi.postMessage({ command: "UNSAVED_CHANGES_STATUS", hasPendingChanges });
    }, [store, hasPendingChanges]);
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const element = document.activeElement as HTMLElement | null;
            if (element && (["INPUT", "TEXTAREA", "VSCODE-TEXTFIELD", "VSCODE-SINGLE-SELECT"].includes(element.tagName) || element.isContentEditable))
                return;
            if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
            event.preventDefault();
            if (event.shiftKey) redo();
            else undo();
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [undo, redo]);
    useEffect(() => {
        store.getState().transaction(() => {
            const state = store.getState();
            const seq = state.mergedPropertiesRequestSeq + 1;
            state.setMergedPropertiesRequestSeq(seq);
            const config = selectedTab === null ? undefined : configurations[selectedTab];
            const target = config && selectedProfileKey ? `${config.configPath}:${selectedProfileKey}` : null;
            if (!target || (previousSelection.current !== target && !isSaving)) state.setMergedProperties(null);
            previousSelection.current = target;
            if (!config || !selectedProfileKey) return;
            const changes = state.formatPendingChanges();
            state.vscodeApi.postMessage({
                command: "GET_MERGED_PROPERTIES",
                profilePath: getOriginalProfileKeyWithNested(selectedProfileKey, config.configPath, renames),
                configPath: config.configPath,
                changes,
                renames: changes.renames,
                mergedPropertiesRequestSeq: seq,
            });
        }, false);
    }, [
        store,
        selectedProfileKey,
        selectedTab,
        configurations,
        pendingChanges,
        deletions,
        pendingDefaults,
        defaultsDeletions,
        autostoreChanges,
        renames,
        sortOrderVersion,
        isSaving,
    ]);
    useEffect(() => {
        document.body.classList.toggle("modal-open", modalOpen);
        return () => document.body.classList.remove("modal-open");
    }, [modalOpen]);
    useEffect(() => {
        if (!profileMenuOpen) return;
        const close = () => store.getState().setProfileMenuOpen(null);
        document.addEventListener("click", close);
        return () => document.removeEventListener("click", close);
    }, [store, profileMenuOpen]);
    useEffect(() => {
        const state = store.getState();
        const config = selectedTab === null ? undefined : configurations[selectedTab];
        if (!profileFilterType || !config?.properties?.profiles) return;
        const helpers = createUtilityHelpers(state);
        const profiles = { ...flattenProfiles(config.properties.profiles), ...helpers.extractPendingProfiles(config.configPath) };
        const availableTypes = Object.keys(profiles)
            .filter((key) => !helpers.isProfileOrParentDeleted(key, config.configPath))
            .map((profileKey) => getProfileType({ ...state, profileKey }));
        if (!availableTypes.includes(profileFilterType)) state.setProfileFilterType(null);
    }, [store, selectedTab, configurations, profileFilterType, deletions, pendingChanges, renames]);
}
