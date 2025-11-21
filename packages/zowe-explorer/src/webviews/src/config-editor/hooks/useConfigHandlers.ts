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

import { useCallback } from "react";
import { useConfigContext } from "../context/ConfigContext";
import { updateChangesForRenames, getProfileNameForMergedProperties } from "../utils/renameUtils";
import { useProfileUtils } from "./useProfileUtils";

interface ConfigHandlersParams {
  setPendingProfileDeletion: (key: string | null) => void;
  setPendingPropertyDeletion: (key: string | null) => void;
}

export function useConfigHandlers(params: ConfigHandlersParams) {
  const {
    setPendingProfileDeletion,
    setPendingPropertyDeletion,
  } = params;

  const {
    formatPendingChanges,
    doesProfileExist,
  } = useProfileUtils();

  const {
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
    setPendingSaveSelection,
    setProfileSearchTerm,
    setProfileFilterType,
    setMergedProperties,
    selectedProfilesByConfig,
    configEditorSettings,
    pendingChangesRef,
    deletionsRef,
    pendingDefaultsRef,
    defaultsDeletionsRef,
    autostoreChangesRef,
    renamesRef,
    vscodeApi,
  } = useConfigContext();

  const { profilesWidthPercent } = configEditorSettings;

  const handleSave = useCallback(() => {
    setIsSaving(true);
    setPendingSaveSelection({
      tab: selectedTab,
      profile: selectedProfileKey,
    });
    const changes = Object.entries(pendingChangesRef.current).flatMap(([configPath, changesForPath]) =>
      Object.keys(changesForPath).map((key) => {
        const { value, path, profile, secure } = changesForPath[key];
        return { key, value, path, profile, configPath, secure };
      })
    );

    const deleteKeys = Object.entries(deletionsRef.current).flatMap(([configPath, keys]) => keys.map((key) => ({ key, configPath, secure: false })));

    const defaultsChanges = Object.entries(pendingDefaultsRef.current).flatMap(([configPath, changesForPath]) =>
      Object.keys(changesForPath).map((key) => {
        const { value, path } = changesForPath[key];
        return { key, value, path, configPath, secure: false };
      })
    );

    const defaultsDeleteKeys = Object.entries(defaultsDeletionsRef.current).flatMap(([configPath, keys]) =>
      keys.map((key) => ({ key, configPath, secure: false }))
    );

    const otherChanges = Object.entries(autostoreChangesRef.current).map(([configPath, value]) => ({
      type: "autostore",
      value,
      configPath,
    }));

    const renamesData = Object.entries(renamesRef.current).flatMap(([configPath, configRenames]) =>
      Object.entries(configRenames).map(([originalKey, newKey]) => ({
        originalKey,
        newKey,
        configPath,
      }))
    );

    const updatedChanges = updateChangesForRenames(changes, renamesData);

    vscodeApi.postMessage({
      command: "SAVE_CHANGES",
      changes: updatedChanges,
      deletions: deleteKeys,
      defaultsChanges,
      defaultsDeleteKeys: defaultsDeleteKeys,
      otherChanges,
      renames: renamesData,
    });

    setHiddenItems({});
    setPendingChanges({});
    setDeletions({});
    setPendingDefaults({});
    setDefaultsDeletions({});
    setAutostoreChanges({});
    setRenames({});
    setDragDroppedProfiles({});

    vscodeApi.postMessage({ command: "GET_PROFILES" });
  }, [
    selectedTab,
    selectedProfileKey,
    pendingChangesRef,
    deletionsRef,
    pendingDefaultsRef,
    defaultsDeletionsRef,
    autostoreChangesRef,
    renamesRef,
    vscodeApi,
    setIsSaving,
    setPendingSaveSelection,
    setHiddenItems,
    setPendingChanges,
    setDeletions,
    setPendingDefaults,
    setDefaultsDeletions,
    setAutostoreChanges,
    setRenames,
    setDragDroppedProfiles,
  ]);

  const handleRefresh = useCallback(() => {
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
        originalSelectedProfileKey = getProfileNameForMergedProperties(currentSelectedProfileKey, configPath, renames);
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

    // Clear search bar and type filter if there are no pending changes
    if (!hasPendingChanges) {
      setProfileSearchTerm("");
      setProfileFilterType(null);
    }

    vscodeApi.postMessage({ command: "GET_PROFILES" });

    setTimeout(() => {
      if (currentSelectedTab !== null) {
        setSelectedTab(currentSelectedTab);
      }
      if (originalSelectedProfileKey !== null) {
        const configPath = currentSelectedTab !== null ? configurations[currentSelectedTab]?.configPath : undefined;
        if (configPath && doesProfileExist(originalSelectedProfileKey, configPath)) {
          setSelectedProfileKey(originalSelectedProfileKey);

          const changes = formatPendingChanges();
          vscodeApi.postMessage({
            command: "GET_MERGED_PROPERTIES",
            profilePath: originalSelectedProfileKey,
            configPath: configPath,
            changes: changes,
            renames: changes.renames,
          });
        } else {
          setSelectedProfileKey(null);
          setMergedProperties(null);
        }
      }
    }, 100);
  }, [
    selectedTab,
    selectedProfileKey,
    configurations,
    pendingChanges,
    deletions,
    pendingDefaults,
    defaultsDeletions,
    autostoreChanges,
    renames,
    dragDroppedProfiles,
    setHiddenItems,
    setPendingChanges,
    setDeletions,
    setPendingDefaults,
    setDefaultsDeletions,
    setAutostoreChanges,
    setRenames,
    setDragDroppedProfiles,
    setProfileSearchTerm,
    setProfileFilterType,
    vscodeApi,
    setSelectedTab,
    setSelectedProfileKey,
    doesProfileExist,
    formatPendingChanges,
    setMergedProperties,
  ]);

  const handleTabChange = useCallback((index: number) => {
    // Cancel any pending deletions when user switches tabs
    setPendingProfileDeletion(null);
    setPendingPropertyDeletion(null);
    setSelectedTab(index);

    setTimeout(() => {
      const panelContent = document.querySelector(`.panel:nth-child(${index + 1}) .panel-content`) as HTMLElement;
      if (panelContent) {
        const profilesSection = panelContent.querySelector(".profiles-section") as HTMLElement;
        const profileDetailsSection = panelContent.querySelector(".profile-details-section") as HTMLElement;

        if (profilesSection && profileDetailsSection) {
          const panelWidth = panelContent.getBoundingClientRect().width;
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
    }, 0);

    const configPath = configurations[index]?.configPath;
    if (configPath) {
      const previouslySelectedProfile = selectedProfilesByConfig[configPath];
      if (previouslySelectedProfile && doesProfileExist(previouslySelectedProfile, configPath)) {
        setSelectedProfileKey(previouslySelectedProfile);

        const profileNameForMergedProperties = getProfileNameForMergedProperties(previouslySelectedProfile, configPath, renames);
        const changes = formatPendingChanges();
        vscodeApi.postMessage({
          command: "GET_MERGED_PROPERTIES",
          profilePath: profileNameForMergedProperties,
          configPath: configPath,
          changes: changes,
          renames: changes.renames,
        });
      } else {
        setSelectedProfileKey(null);
        setMergedProperties(null);
      }
    }
  }, [
    setPendingProfileDeletion,
    setPendingPropertyDeletion,
    setSelectedTab,
    profilesWidthPercent,
    configurations,
    selectedProfilesByConfig,
    doesProfileExist,
    setSelectedProfileKey,
    renames,
    formatPendingChanges,
    vscodeApi,
    setMergedProperties,
  ]);

  const handleAutostoreToggle = useCallback((configPath: string) => {
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
  }, [configurations, autostoreChanges, setAutostoreChanges]);

  return {
    handleSave,
    handleRefresh,
    handleTabChange,
    handleAutostoreToggle,
  };
}
