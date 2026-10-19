/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

import type { EditorRuntime } from "./types";
import { buildFormattedPendingChanges } from "../utils/renameUtils";
import { getOriginalProfileKeyWithNested } from "../utils/profileUtils";
import { createProfileUtils } from "./profileUtils";

export function createConfigurationActions(state: EditorRuntime) {
    const {
        setPendingProfileDeletion,
        setPendingPropertyDeletion,
        configurations,
        selectedTab,
        setSelectedTab,
        selectedProfileKey,
        setSelectedProfileKey,
        pendingChanges,
        setPendingChanges,
        deletions,
        setDeletions,
        pendingDefaults,
        setPendingDefaults,
        defaultsDeletions,
        setDefaultsDeletions,
        autostoreChanges,
        setAutostoreChanges,
        renames,
        setRenames,
        dragDroppedProfiles,
        setDragDroppedProfiles,
        setHiddenItems,
        setIsSaving,
        isSaving,
        saveRequestSeq,
        setSaveRequestSeq,
        setPendingSaveRequestId,
        setSaveModalOpen,
        setPendingSaveSelection,
        setProfileSearchTerm,
        setProfileFilterType,
        setMergedProperties,
        clearHistory,
        selectedProfilesByConfig,
        setSelectedProfilesByConfig,
        vscodeApi,
    } = state;

    const { doesProfileExist, doesSavedProfileExist } = createProfileUtils(state);

    const handleSave = () => {
        if (isSaving) return;
        const saveRequestId = saveRequestSeq + 1;
        setSaveRequestSeq(saveRequestId);
        setPendingSaveRequestId(saveRequestId);
        setIsSaving(true);
        setSaveModalOpen(true);
        setPendingSaveSelection({
            tab: selectedTab,
            profile: selectedProfileKey,
        });
        const {
            changes,
            deletions: deleteKeys,
            defaultsChanges,
            defaultsDeleteKeys,
            renames: renamesData,
        } = buildFormattedPendingChanges({
            pendingChanges: pendingChanges,
            deletions: deletions,
            pendingDefaults: pendingDefaults,
            defaultsDeletions: defaultsDeletions,
            renames: renames,
        });

        const otherChanges = Object.entries(autostoreChanges).map(([configPath, value]) => ({
            type: "autostore",
            value,
            configPath,
        }));

        vscodeApi.postMessage({
            command: "SAVE_CHANGES",
            saveRequestId,
            revisions: Object.fromEntries(configurations.map((config) => [config.configPath, config.revision])),
            changes,
            deletions: deleteKeys,
            defaultsChanges,
            defaultsDeleteKeys,
            otherChanges,
            renames: renamesData,
        });

        // Retain the draft and its base snapshot until the matching SAVE_SUCCESS response.
    };

    const handleRefresh = () => {
        if (isSaving) return;
        const currentSelectedTab = selectedTab;
        const currentSelectedProfileKey = selectedProfileKey;

        // Check if there are any pending changes before clearing
        const hasPendingChanges =
            Object.keys(pendingChanges).length > 0 ||
            Object.keys(deletions).length > 0 ||
            Object.keys(pendingDefaults).length > 0 ||
            Object.keys(defaultsDeletions).length > 0 ||
            Object.keys(autostoreChanges).length > 0 ||
            Object.keys(renames).length > 0 ||
            Object.keys(dragDroppedProfiles).length > 0;

        let originalSelectedProfileKey = currentSelectedProfileKey;
        if (currentSelectedProfileKey && currentSelectedTab !== null) {
            const configPath = configurations[currentSelectedTab]?.configPath;
            if (configPath) {
                originalSelectedProfileKey = getOriginalProfileKeyWithNested(currentSelectedProfileKey, configPath, renames);
            }
        }

        setHiddenItems({});
        setPendingChanges({});
        setDeletions({});
        setPendingDefaults({});
        setDefaultsDeletions({});
        setAutostoreChanges({});
        setRenames({});
        setDragDroppedProfiles({});
        setPendingPropertyDeletion(null);
        setPendingProfileDeletion(null);
        clearHistory();

        // Drop remembered per-tab selections that only existed as pending profiles, so switching
        // tabs cannot resurrect a profile this revert just discarded.
        setSelectedProfilesByConfig((prev) =>
            Object.fromEntries(Object.entries(prev).filter(([configPath, profileKey]) => profileKey && doesSavedProfileExist(profileKey, configPath)))
        );

        // Clear search bar and type filter if there are no pending changes
        if (!hasPendingChanges) {
            setProfileSearchTerm("");
            setProfileFilterType(null);
        }

        if (originalSelectedProfileKey !== null) {
            const configPath = currentSelectedTab !== null ? configurations[currentSelectedTab]?.configPath : undefined;
            // Revert discards pending profiles. Restore the saved selection before requesting data;
            if (configPath && doesSavedProfileExist(originalSelectedProfileKey, configPath)) {
                setSelectedProfileKey(originalSelectedProfileKey);
            } else {
                setSelectedProfileKey(null);
                setMergedProperties(null);
            }
        }

        vscodeApi.postMessage({ command: "GET_PROFILES" });
    };

    const handleTabChange = (index: number) => {
        // Cancel any pending deletions when user switches tabs
        setPendingProfileDeletion(null);
        setPendingPropertyDeletion(null);
        setSelectedTab(index);

        const configPath = configurations[index]?.configPath;
        if (configPath) {
            const previouslySelectedProfile = selectedProfilesByConfig[configPath];
            if (previouslySelectedProfile && doesProfileExist(previouslySelectedProfile, configPath)) {
                setSelectedProfileKey(previouslySelectedProfile);
            } else {
                setSelectedProfileKey(null);
                setMergedProperties(null);
            }
        }
    };

    const handleAutostoreToggle = (configPath: string) => {
        const currentValue = configurations.find((config) => config.configPath === configPath)?.properties?.autoStore;
        const pendingValue = autostoreChanges[configPath];
        const effectiveValue = pendingValue !== undefined ? pendingValue : currentValue;
        const newValue = effectiveValue === undefined || effectiveValue === null ? true : !effectiveValue;

        // Check if the new value would be the same as the original value
        if (newValue === currentValue) {
            setAutostoreChanges((prev) => {
                const newChanges = { ...prev };
                delete newChanges[configPath];
                return newChanges;
            });
        } else {
            setAutostoreChanges((prev) => ({
                ...prev,
                [configPath]: newValue,
            }));
        }
    };

    return {
        handleSave,
        handleRefresh,
        handleTabChange,
        handleAutostoreToggle,
    };
}
