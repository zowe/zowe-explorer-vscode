import { useEffect, useState, useCallback, useMemo } from "react";

import "./App.css";

import {
  Tabs,
  Panels,
  AddProfileModal,
  SaveModal,
  NewLayerModal,
  AddConfigModal,
  RenameProfileModal,
  RenderProfiles,
  RenderProfileDetails,
  RenderDefaults,
  WizardManager,
} from "./components";

import {
  flattenKeys,
  flattenProfiles,
  extractProfileKeyFromPath,
  stringifyValueByType,
  parseValueByType,
  getProfileType,
  getRenamedProfileKey,
  getRenamedProfileKeyWithNested,
  getOriginalProfileKey,
  getPropertyTypeForAddProfile,
  fetchTypeOptions,
  getPropertyDescriptions,
  PropertySortOrder,

  isPropertyActuallyInherited,
  mergePendingChangesForProfile,
  mergeMergedProperties,
  ensureProfileProperties,
  filterSecureProperties,
  mergePendingSecureProperties,
  isPropertyFromMergedProps,
  isMergedPropertySecure,
  canPropertyBeSecure,
  isPropertySecure,
  handleToggleSecure,
  hasPendingSecureChanges,
  extractPendingProfiles,
  isProfileOrParentDeleted,
  getAvailableProfilesByType,
  isProfileDefault,
  isCurrentProfileUntyped,
  sortProfilesAtLevel,
} from "./utils";

import { updateChangesForRenames, getProfileNameForMergedProperties, hasPendingRename } from "./utils/renameUtils";
import { useProfileWizard } from "./hooks";
import { usePanelResizer } from "./hooks/usePanelResizer";
import { useMessageHandler } from "./hooks/useMessageHandler";
import { useConfigState } from "./hooks/useConfigState";

import {
  handleRenameProfile as handleRenameProfileHandler,
  handleDeleteProfile as handleDeleteProfileHandler,
  handleProfileSelection as handleProfileSelectionHandler,
  handleNavigateToSource as handleNavigateToSourceHandler,
} from "./handlers/profileHandlers";


const vscodeApi = acquireVsCodeApi();

const SORT_ORDER_OPTIONS: PropertySortOrder[] = ["alphabetical", "merged-first", "non-merged-first"];

export function App() {
  const {
    configurations, setConfigurations,
    selectedTab, setSelectedTab,
    flattenedConfig, setFlattenedConfig,
    flattenedDefaults, setFlattenedDefaults,
    pendingChanges, setPendingChanges,
    pendingDefaults, setPendingDefaults,
    deletions, setDeletions,
    defaultsDeletions, setDefaultsDeletions,
    renames, setRenames,
    dragDroppedProfiles, setDragDroppedProfiles,
    autostoreChanges, setAutostoreChanges,
    hiddenItems, setHiddenItems,
    schemaValidations, setSchemaValidations,
    selectedProfileKey, setSelectedProfileKey,
    selectedProfilesByConfig, setSelectedProfilesByConfig,
    mergedProperties, setMergedProperties,
    configEditorSettings, setConfigEditorSettings,
    pendingMergedPropertiesRequest, setPendingMergedPropertiesRequest,
    sortOrderVersion, setSortOrderVersion,
    isSaving, setIsSaving,
    pendingSaveSelection, setPendingSaveSelection,
    isNavigating, setIsNavigating,
    profileSearchTerm, setProfileSearchTerm,
    profileFilterType, setProfileFilterType,
    hasWorkspace, setHasWorkspace,
    secureValuesAllowed, setSecureValuesAllowed,
    hasPromptedForZeroConfigs, setHasPromptedForZeroConfigs,
    expandedNodesByConfig, setExpandedNodesByConfig,
    configurationsRef,
    pendingChangesRef,
    deletionsRef,
    pendingDefaultsRef,
    defaultsDeletionsRef,
    autostoreChangesRef,
    renamesRef,
    selectedProfileKeyRef,
    setLocalStorageValue,
    setShowMergedPropertiesWithStorage,
    setViewModeWithStorage,
    setPropertySortOrderWithStorage,
    setProfileSortOrderWithStorage,
    setDefaultsCollapsedWithStorage,
    setProfilesCollapsedWithStorage,

  } = useConfigState(vscodeApi);

  const { showMergedProperties, viewMode, propertySortOrder, profileSortOrder, profilesWidthPercent, defaultsCollapsed, profilesCollapsed } =
    configEditorSettings;

  usePanelResizer({
    profilesWidthPercent,
    setConfigEditorSettings,
    setLocalStorageValue,
    configEditorSettings,
    configurations,
  });

  const [newProfileKeyPath, setNewProfileKeyPath] = useState<string[] | null>(null);
  const [newProfileKey, setNewProfileKey] = useState("");
  const [newProfileValue, setNewProfileValue] = useState("");
  const [newProfileModalOpen, setNewProfileModalOpen] = useState(false);
  const [focusValueInput, setFocusValueInput] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [newLayerModalOpen, setNewLayerModalOpen] = useState(false);
  const [newLayerName, setNewLayerName] = useState("");
  const [newLayerPath, setNewLayerPath] = useState<string[] | null>(null);
  const [isSecure, setIsSecure] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [addConfigModalOpen, setAddConfigModalOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState<string | null>(null);
  const [renameProfileModalOpen, setRenameProfileModalOpen] = useState(false);
  const [pendingPropertyDeletion, setPendingPropertyDeletion] = useState<string | null>(null);
  const [pendingProfileDeletion, setPendingProfileDeletion] = useState<string | null>(null);

  const formatPendingChanges = useCallback(() => {
    const changes = Object.entries(pendingChanges).flatMap(([configPath, changesForPath]) =>
      Object.keys(changesForPath).map((key) => {
        const { value, path, profile, secure } = changesForPath[key];
        return { key, value, path, profile, configPath, secure };
      })
    );

    const deleteKeys = Object.entries(deletions).flatMap(([configPath, keys]) => keys.map((key) => ({ key, configPath, secure: false })));

    const defaultsChanges = Object.entries(pendingDefaults).flatMap(([configPath, changesForPath]) =>
      Object.keys(changesForPath).map((key) => {
        const { value, path } = changesForPath[key];
        return { key, value, path, configPath, secure: false };
      })
    );

    const defaultsDeleteKeys = Object.entries(defaultsDeletions).flatMap(([configPath, keys]) =>
      keys.map((key) => ({ key, configPath, secure: false }))
    );

    const renamesData = Object.entries(renames).flatMap(([configPath, configRenames]) =>
      Object.entries(configRenames).map(([originalKey, newKey]) => ({
        originalKey,
        newKey,
        configPath,
      }))
    );

    const updatedChanges = updateChangesForRenames(changes, renamesData);

    const result = {
      changes: updatedChanges,
      deletions: deleteKeys,
      defaultsChanges,
      defaultsDeleteKeys: defaultsDeleteKeys,
      renames: renamesData,
    };

    return result;
  }, [pendingChanges, deletions, pendingDefaults, defaultsDeletions, renames, updateChangesForRenames]);

  const getAvailableProfiles = useCallback(() => {
    if (selectedTab === null) return ["root"];

    const config = configurations[selectedTab].properties;
    const flatProfiles = flattenProfiles(config.profiles);
    const profileNames = Object.keys(flatProfiles);

    const pendingProfiles = new Set<string>();
    Object.entries(pendingChanges[configurations[selectedTab].configPath] || {}).forEach(([_, entry]) => {
      if (entry.profile) {
        pendingProfiles.add(entry.profile);
      }
    });

    const deletedProfiles = new Set<string>();
    const configPath = configurations[selectedTab].configPath;
    const deletedKeys = deletions[configPath] || [];
    deletedKeys.forEach((key) => {
      const keyParts = key.split(".");
      if (keyParts[0] === "profiles" && keyParts.length >= 2) {
        const profileParts: string[] = [];
        for (let i = 1; i < keyParts.length; i++) {
          if (keyParts[i] !== "profiles") {
            profileParts.push(keyParts[i]);
          }
        }
        const profileName = profileParts.join(".");
        deletedProfiles.add(profileName);

        const renamedDeletedProfile = getRenamedProfileKeyWithNested(profileName, configPath, renames);
        if (renamedDeletedProfile !== profileName) {
          deletedProfiles.add(renamedDeletedProfile);
        }

        profileNames.forEach((existingProfile) => {
          if (existingProfile.startsWith(profileName + ".")) {
            deletedProfiles.add(existingProfile);
            const renamedProfile = getRenamedProfileKeyWithNested(existingProfile, configPath, renames);
            deletedProfiles.add(renamedProfile);
          }
        });
      }
    });

    const renamedProfileNames = profileNames.map((profileName) => {
      const configPath = configurations[selectedTab].configPath;
      return getRenamedProfileKeyWithNested(profileName, configPath, renames);
    });

    const allProfiles = new Set(["root", ...renamedProfileNames, ...Array.from(pendingProfiles)]);
    deletedProfiles.forEach((profile) => allProfiles.delete(profile));

    const profilesToSort = Array.from(allProfiles);
    const result = sortProfilesAtLevel(profilesToSort, profileSortOrder);

    return result;
  }, [selectedTab, configurations, pendingChanges, deletions, renames, profileSortOrder]);

  const {
    wizardModalOpen,
    wizardRootProfile,
    wizardSelectedType,
    wizardProfileName,
    wizardProperties,
    wizardShowKeyDropdown,
    wizardNewPropertyKey,
    wizardNewPropertyValue,
    wizardNewPropertySecure,
    wizardMergedProperties,
    setWizardModalOpen,
    setWizardRootProfile,
    setWizardSelectedType,
    setWizardProfileName,
    setWizardProperties,
    setWizardShowKeyDropdown,
    setWizardNewPropertyKey,
    setWizardNewPropertyValue,
    setWizardNewPropertySecure,
    setWizardMergedProperties,
    getWizardTypeOptions,
    getWizardPropertyOptions,
    getWizardPropertyDescriptions,
    getPropertyType,
    isProfileNameTaken,
    handleWizardAddProperty,
    handleWizardRemoveProperty,
    handleWizardPropertyValueChange,
    handleWizardPropertySecureToggle,
    handleWizardCreateProfile,
    handleWizardCancel,
    requestWizardMergedProperties,
    handleWizardPopulateDefaults,
  } = useProfileWizard({
    selectedTab,
    configurations,
    schemaValidations,
    pendingChanges,
    setPendingChanges,
    setSelectedProfileKey,
    vscodeApi,
    formatPendingChanges,
    getAvailableProfiles,
    secureValuesAllowed,
    renames,
  });

  const hasPendingChanges = useCallback(() => {
    const hasChanges = Object.keys(pendingChanges).length > 0;
    const hasDeletions = Object.entries(deletions).some(([_, keys]) => keys.length > 0);
    const hasPendingDefaults = Object.keys(pendingDefaults).length > 0;
    const hasDefaultsDeletions = Object.entries(defaultsDeletions).some(([_, keys]) => keys.length > 0);
    const hasAutostoreChanges = Object.keys(autostoreChanges).length > 0;
    const hasRenames = Object.entries(renames).some(([_, configRenames]) => Object.keys(configRenames).length > 0);
    const hasDragDroppedProfiles = Object.entries(dragDroppedProfiles).some(([_, profiles]) => profiles.size > 0);

    return hasChanges || hasDeletions || hasPendingDefaults || hasDefaultsDeletions || hasAutostoreChanges || hasRenames || hasDragDroppedProfiles;
  }, [pendingChanges, deletions, pendingDefaults, defaultsDeletions, autostoreChanges, renames, dragDroppedProfiles]);

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
  }, [selectedTab, selectedProfileKey, hasPendingChanges]);



  useEffect(() => {
    if (selectedTab !== null && configurations[selectedTab]) {
      const config = configurations[selectedTab].properties;
      setFlattenedConfig(flattenKeys(config.profiles));
      setFlattenedDefaults(flattenKeys(config.defaults));
      if (!isSaving && !isNavigating) {
        setMergedProperties(null);
      }
    }
  }, [selectedTab, configurations, isSaving, isNavigating]);

  useEffect(() => {
    if (selectedProfileKey) {
      const configPath = configurations[selectedTab!]?.configPath;
      if (configPath) {
        const profileNameForMergedProperties = getProfileNameForMergedProperties(selectedProfileKey, configPath, renames);
        const timeoutId = setTimeout(() => {
          const changes = formatPendingChanges();
          vscodeApi.postMessage({
            command: "GET_MERGED_PROPERTIES",
            profilePath: profileNameForMergedProperties,
            configPath: configPath,
            changes: changes,
            renames: changes.renames,
          });
        }, 100);

        return () => clearTimeout(timeoutId);
      }
    }
  }, [selectedProfileKey, selectedTab, formatPendingChanges, renames, sortOrderVersion]);

  useEffect(() => {
    const isModalOpen = newProfileModalOpen || saveModalOpen || newLayerModalOpen || wizardModalOpen || renameProfileModalOpen;
    document.body.classList.toggle("modal-open", isModalOpen);
  }, [newProfileModalOpen, saveModalOpen, newLayerModalOpen, wizardModalOpen, renameProfileModalOpen]);



  useEffect(() => {
    const handleClickOutside = () => {
      if (profileMenuOpen) {
        setProfileMenuOpen(null);
      }
    };

    if (profileMenuOpen) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [profileMenuOpen]);

  const handleChange = (key: string, value: string) => {
    // Cancel any pending property deletion when user changes a value
    setPendingPropertyDeletion(null);

    const configPath = configurations[selectedTab!]!.configPath;
    const path = flattenedConfig[key]?.path ?? key.split(".");

    let profileKey = selectedProfileKey || extractProfileKeyFromPath(path);

    if (selectedProfileKey && renames[configPath]) {
      profileKey = getRenamedProfileKeyWithNested(selectedProfileKey, configPath, renames);
    }

    const displayKey = path[path.length - 1];
    const currentSecure = isPropertySecure(key, displayKey, path, undefined, selectedTab, configurations, pendingChanges, renames);
    setPendingChanges((prev) => ({
      ...prev,
      [configPath]: {
        ...prev[configPath],
        [key]: { value, path, profile: profileKey, secure: currentSecure },
      },
    }));

    if (deletions[configPath]?.includes(key)) {
      setDeletions((prev) => ({
        ...prev,
        [configPath]: prev[configPath]?.filter((k) => k !== key) ?? [],
      }));
    }
  };

  const handleDefaultsChange = (key: string, value: string) => {
    // Cancel any pending property deletion when user changes defaults
    setPendingPropertyDeletion(null);
    const configPath = configurations[selectedTab!]!.configPath;
    const path = flattenedDefaults[key]?.path ?? key.split(".");
    setPendingDefaults((prev) => ({
      ...prev,
      [configPath]: {
        ...prev[configPath],
        [key]: { value, path },
      },
    }));

    if (defaultsDeletions[configPath]?.includes(key)) {
      setDefaultsDeletions((prev) => ({
        ...prev,
        [configPath]: prev[configPath]?.filter((k) => k !== key) ?? [],
      }));
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

  const handleAddNewProfileKey = () => {
    if (!newProfileKey.trim() || !newProfileKeyPath) return;

    const configPath = configurations[selectedTab!]!.configPath;
    const path = [...newProfileKeyPath, newProfileKey.trim()];
    const fullKey = isSecure ? path.join(".").replace("secure", "properties") : path.join(".");
    const profileKey = extractProfileKeyFromPath(path);

    const propertyType = getPropertyTypeForAddProfile(
      newProfileKey.trim(),
      selectedTab!,
      configurations,
      selectedProfileKey,
      schemaValidations,
      getProfileType,
      pendingChanges,
      renames
    );
    const convertedValue = parseValueByType(newProfileValue, propertyType);

    setPendingChanges((prev) => ({
      ...prev,
      [configPath]: {
        ...prev[configPath],
        [fullKey]: { value: convertedValue, path: path.slice(-1), profile: profileKey, secure: isSecure },
      },
    }));

    setDeletions((prev) => {
      const newDeletions = { ...prev };
      const fullPath = path.join(".");
      if (newDeletions[configPath]) {
        newDeletions[configPath] = newDeletions[configPath].filter((key) => key !== fullPath);
      }
      return newDeletions;
    });

    if (isSecure) {
      setHiddenItems((prev) => {
        const newHiddenItems = { ...prev };
        const fullPath = path.join(".").replace("secure", "properties");

        const configHiddenItems = newHiddenItems[configPath];

        if (configHiddenItems) {
          const filteredItems = Object.fromEntries(Object.entries(configHiddenItems).filter(([, value]) => value.path !== fullPath));
          newHiddenItems[configPath] = filteredItems;
        }

        return newHiddenItems;
      });
    }

    setNewProfileKey("");
    setNewProfileValue("");
    setNewProfileKeyPath(null);
    setNewProfileModalOpen(false);
    setIsSecure(false);
    setFocusValueInput(false);
  };

  const handleDeleteProperty = (fullKey: string) => {
    // Show inline confirmation by setting the pending deletion key
    setPendingPropertyDeletion(fullKey);
  };

  const confirmDeleteProperty = useCallback(
    (fullKey: string, secure?: boolean) => {
      const configPath = configurations[selectedTab!]!.configPath;

      let index = fullKey.split(".").pop();
      if (secure) {
        setHiddenItems((prev) => ({
          ...prev,
          [configPath]: {
            ...prev[configPath],
            [index!]: { path: fullKey },
          },
        }));
      }
      setPendingChanges((prev) => {
        const newPendingChanges = { ...prev };
        delete newPendingChanges[configPath]?.[fullKey];

        return newPendingChanges;
      });
      setDeletions((prev) => {
        const newDeletions = {
          ...prev,
          [configPath]: [...(prev[configPath] ?? []), fullKey],
        };

        return newDeletions;
      });
      setPendingPropertyDeletion(null);
    },
    [selectedTab, configurations]
  );

  const handleUnlinkMergedProperty = (propertyKey: string | undefined, fullKey: string) => {
    if (!propertyKey) return;
    // Cancel any pending property deletion when user unlinks merged property
    setPendingPropertyDeletion(null);
    setNewProfileKey(propertyKey);
    setNewProfileValue("");
    setNewProfileKeyPath(fullKey.split(".").slice(0, -1));
    setNewProfileModalOpen(true);
    setFocusValueInput(true);
  };

  const handleSetAsDefault = (profileKey: string) => {
    // Cancel any pending profile deletion when user sets profile as default
    setPendingProfileDeletion(null);
    // Cancel any pending property deletion when user sets profile as default
    setPendingPropertyDeletion(null);
    const profileType = getProfileType(profileKey, selectedTab, configurations, pendingChanges, renames);
    if (!profileType) {
      return;
    }

    const configPath = configurations[selectedTab!]!.configPath;

    setPendingDefaults((prev) => ({
      ...prev,
      [configPath]: {
        ...prev[configPath],
        [profileType]: { value: profileKey, path: [profileType] },
      },
    }));

    setDefaultsDeletions((prev) => ({
      ...prev,
      [configPath]: prev[configPath]?.filter((k) => k !== profileType) ?? [],
    }));
  };

  const getExpandedNodesForConfig = useCallback(
    (configPath: string): Set<string> => {
      return expandedNodesByConfig[configPath] || new Set();
    },
    [expandedNodesByConfig]
  );

  const setExpandedNodesForConfig = useCallback((configPath: string, expandedNodes: Set<string>) => {
    setExpandedNodesByConfig((prev) => ({
      ...prev,
      [configPath]: expandedNodes,
    }));
  }, []);

  const handleOpenRawJson = (configPath: string) => {
    vscodeApi.postMessage({ command: "OPEN_CONFIG_FILE", filePath: configPath });
  };

  const handleRevealInFinder = (configPath: string) => {
    vscodeApi.postMessage({ command: "REVEAL_IN_FINDER", filePath: configPath });
  };

  const handleOpenSchemaFile = (schemaPath: string) => {
    vscodeApi.postMessage({ command: "OPEN_SCHEMA_FILE", filePath: schemaPath });
  };

  const handleTabChange = (index: number) => {
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
  };

  // Create a utility helpers object to eliminate wrapper functions
  // This consolidates all the common state/props that need to be passed to utility functions
  const utilityHelpers = useMemo(
    () => ({
      // State values
      selectedTab,
      configurations,
      pendingChanges,
      deletions,
      renames,
      schemaValidations,
      selectedProfileKey,
      showMergedProperties,
      pendingDefaults,
      profileSortOrder,

      // Utility functions that can be used with partial application
      mergePendingChangesForProfile: (baseObj: any, path: string[], configPath: string) =>
        mergePendingChangesForProfile(baseObj, path, configPath, pendingChanges, renames),

      mergeMergedProperties: (combinedConfig: any, path: string[], mergedProps: any, configPath: string) =>
        mergeMergedProperties(
          combinedConfig,
          path,
          mergedProps,
          configPath,
          selectedTab,
          configurations,
          pendingChanges,
          renames,
          schemaValidations,
          deletions
        ),

      filterSecureProperties: (value: any, combinedConfig: any, configPath?: string, pc?: any, del?: any, mergedProps?: any) =>
        filterSecureProperties(value, combinedConfig, configPath, pc || pendingChanges, del || deletions, mergedProps),

      mergePendingSecureProperties: (value: any[], path: string[], configPath: string) =>
        mergePendingSecureProperties(value, path, configPath, pendingChanges, renames),

      isPropertyFromMergedProps: (displayKey: string | undefined, path: string[], mergedProps: any, configPath: string) =>
        isPropertyFromMergedProps(
          displayKey,
          path,
          mergedProps,
          configPath,
          showMergedProperties,
          selectedTab,
          configurations,
          pendingChanges,
          renames,
          selectedProfileKey,
          isPropertyActuallyInherited
        ),

      canPropertyBeSecure: (displayKey: string, _path: string[]) =>
        canPropertyBeSecure(displayKey, selectedTab, configurations, schemaValidations, getProfileType, pendingChanges, renames, selectedProfileKey),

      handleToggleSecure: (fullKey: string, displayKey: string, path: string[]) => {
        setPendingPropertyDeletion(null);
        return handleToggleSecure(
          fullKey,
          displayKey,
          path,
          selectedTab,
          configurations,
          pendingChanges,
          setPendingChanges,
          selectedProfileKey,
          renames
        );
      },

      hasPendingSecureChanges: (configPath: string) => hasPendingSecureChanges(configPath, pendingChanges),

      extractPendingProfiles: (configPath: string) => {
        const profileNames = extractPendingProfiles(pendingChanges, configPath);
        const result: { [key: string]: any } = {};
        profileNames.forEach((profileName) => {
          result[profileName] = {};
        });
        return result;
      },

      isProfileOrParentDeleted: (profileKey: string, configPath: string) => isProfileOrParentDeleted(profileKey, deletions, configPath),

      isProfileOrParentDeletedForComponent: (profileKey: string, deletedProfiles: string[]) =>
        deletedProfiles.some((deletedProfile) => profileKey === deletedProfile || profileKey.startsWith(deletedProfile + ".")),

      getAvailableProfilesByType: (profileType: string) =>
        getAvailableProfilesByType(profileType, selectedTab, configurations, pendingChanges, renames),

      isProfileDefault: (profileKey: string) => isProfileDefault(profileKey, selectedTab, configurations, pendingChanges, pendingDefaults, renames),

      isCurrentProfileUntyped: () => isCurrentProfileUntyped(selectedProfileKey, selectedTab, configurations, pendingChanges, renames),

      sortProfilesAtLevel: (profileKeys: string[]) => sortProfilesAtLevel(profileKeys, profileSortOrder),
    }),
    [
      selectedTab,
      configurations,
      pendingChanges,
      deletions,
      renames,
      schemaValidations,
      selectedProfileKey,
      showMergedProperties,
      pendingDefaults,
      profileSortOrder,
      setPendingChanges,
    ]
  );

  const isProfileAffectedByDragDrop = useCallback(
    (profileKey: string): boolean => {
      if (selectedTab === null) return false;
      const configPath = configurations[selectedTab]?.configPath;
      if (!configPath || !dragDroppedProfiles[configPath]) return false;

      const dragDroppedSet = dragDroppedProfiles[configPath];

      if (dragDroppedSet.has(profileKey)) return true;

      const parts = profileKey.split(".");
      for (let i = 1; i < parts.length; i++) {
        const parentKey = parts.slice(0, i).join(".");
        if (dragDroppedSet.has(parentKey)) return true;
      }

      for (const dragDroppedProfile of dragDroppedSet) {
        if (dragDroppedProfile.startsWith(profileKey + ".")) return true;
      }

      return false;
    },
    [selectedTab, configurations, dragDroppedProfiles]
  );

  const getAvailableProfilesForConfig = useCallback(
    (configPath: string): string[] => {
      const config = configurations.find((c) => c.configPath === configPath);
      const profilesObj = config?.properties?.profiles;
      if (!profilesObj) {
        return [];
      }

      const pendingProfiles = utilityHelpers.extractPendingProfiles(configPath);

      const getAvailableProfiles = (profiles: any, parentKey = ""): string[] => {
        const available: string[] = [];
        for (const key of Object.keys(profiles)) {
          const profile = profiles[key];
          const qualifiedKey = parentKey ? `${parentKey}.${key}` : key;

          if (!utilityHelpers.isProfileOrParentDeleted(qualifiedKey, configPath)) {
            available.push(qualifiedKey);
          }

          if (profile.profiles) {
            available.push(...getAvailableProfiles(profile.profiles, qualifiedKey));
          }
        }
        return available;
      };

      const existingProfiles = getAvailableProfiles(profilesObj);
      const pendingProfileKeys = Object.keys(pendingProfiles).filter(
        (key) => !existingProfiles.includes(key) && !utilityHelpers.isProfileOrParentDeleted(key, configPath)
      );

      return [...existingProfiles, ...pendingProfileKeys];
    },
    [configurations, selectedTab, deletions, extractPendingProfiles, isProfileOrParentDeleted]
  );

  const doesProfileExist = useCallback(
    (profileKey: string, configPath: string): boolean => {
      const availableProfiles = getAvailableProfilesForConfig(configPath);
      return availableProfiles.includes(profileKey);
    },
    [getAvailableProfilesForConfig]
  );

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
    formatPendingChanges,
    renames,
    doesProfileExist,
    pendingChanges,
    deletions,
    pendingDefaults,
    defaultsDeletions,
    autostoreChanges,
    renames,
    dragDroppedProfiles,
  ]);

  const findOptimalReplacementProfile = useCallback(
    (deletedProfileKey: string, configPath: string): string | null => {
      const allAvailableProfiles = getAvailableProfilesForConfig(configPath);

      if (allAvailableProfiles.length === 0) {
        return null;
      }

      if (deletedProfileKey.includes(".")) {
        const parentKey = deletedProfileKey.split(".").slice(0, -1).join(".");
        if (allAvailableProfiles.includes(parentKey)) {
          return parentKey;
        }
      }

      const deletedParts = deletedProfileKey.split(".");
      if (deletedParts.length > 1) {
        const parentKey = deletedParts.slice(0, -1).join(".");
        const siblings = allAvailableProfiles.filter((profile) => profile.startsWith(parentKey + ".") && profile !== deletedProfileKey);
        if (siblings.length > 0) {
          return siblings[0];
        }
      }

      const currentIndex = allAvailableProfiles.indexOf(deletedProfileKey);
      if (currentIndex !== -1) {
        for (let i = currentIndex + 1; i < allAvailableProfiles.length; i++) {
          const candidate = allAvailableProfiles[i];
          if (candidate !== deletedProfileKey) {
            return candidate;
          }
        }

        for (let i = currentIndex - 1; i >= 0; i--) {
          const candidate = allAvailableProfiles[i];
          if (candidate !== deletedProfileKey) {
            return candidate;
          }
        }
      }

      return allAvailableProfiles[0] || null;
    },
    [getAvailableProfilesForConfig]
  );

  const handleRenameProfile = useCallback(
    (originalKey: string, newKey: string, isDragDrop: boolean = false): boolean => {
      return handleRenameProfileHandler(originalKey, newKey, isDragDrop, {
        setRenames,
        setSelectedProfileKey,
        setPendingMergedPropertiesRequest,
        setSortOrderVersion,
        setSelectedProfilesByConfig,
        setExpandedNodesByConfig,
        setPendingDefaults,
        setPendingChanges,
        setRenameProfileModalOpen,
        setDeletions,
        setSelectedTab,
        setIsNavigating,
        setDragDroppedProfiles,
        selectedTab,
        configurations,
        renames,
        dragDroppedProfiles,
        selectedProfileKey,
        pendingMergedPropertiesRequest,
        formatPendingChanges,
        extractPendingProfiles: utilityHelpers.extractPendingProfiles,
        findOptimalReplacementProfile,
        getAvailableProfilesForConfig,
        vscodeApi,
      });
    },
    [
      selectedTab,
      configurations,
      renames,
      dragDroppedProfiles,
      selectedProfileKey,
      pendingMergedPropertiesRequest,
      formatPendingChanges,
      extractPendingProfiles,
      findOptimalReplacementProfile,
      getAvailableProfilesForConfig,
      setRenames,
      setSelectedProfileKey,
      setPendingMergedPropertiesRequest,
      setSortOrderVersion,
      setSelectedProfilesByConfig,
      setExpandedNodesByConfig,
      setPendingDefaults,
      setPendingChanges,
      setRenameProfileModalOpen,
      setDeletions,
      setSelectedTab,
      setIsNavigating,
    ]
  );

  const confirmDeleteProfile = useCallback(
    (profileKey: string): void => {
      handleDeleteProfileHandler(profileKey, {
        setRenames,
        setSelectedProfileKey,
        setPendingMergedPropertiesRequest,
        setSortOrderVersion,
        setSelectedProfilesByConfig,
        setExpandedNodesByConfig,
        setPendingDefaults,
        setPendingChanges,
        setRenameProfileModalOpen,
        setDeletions,
        setSelectedTab,
        setIsNavigating,
        setDragDroppedProfiles,
        selectedTab,
        configurations,
        renames,
        dragDroppedProfiles,
        selectedProfileKey,
        pendingMergedPropertiesRequest,
        formatPendingChanges,
        extractPendingProfiles: utilityHelpers.extractPendingProfiles,
        findOptimalReplacementProfile,
        getAvailableProfilesForConfig,
        vscodeApi,
      });
      setPendingProfileDeletion(null);
    },
    [
      selectedTab,
      configurations,
      renames,
      dragDroppedProfiles,
      selectedProfileKey,
      pendingMergedPropertiesRequest,
      formatPendingChanges,
      extractPendingProfiles,
      findOptimalReplacementProfile,
      getAvailableProfilesForConfig,
      setRenames,
      setSelectedProfileKey,
      setPendingMergedPropertiesRequest,
      setSortOrderVersion,
      setSelectedProfilesByConfig,
      setExpandedNodesByConfig,
      setPendingDefaults,
      setPendingChanges,
      setRenameProfileModalOpen,
      setDeletions,
      setSelectedTab,
      setIsNavigating,
    ]
  );

  const handleDeleteProfile = useCallback((profileKey: string): void => {
    // Show inline confirmation by setting the pending deletion key
    setPendingProfileDeletion(profileKey);
  }, []);

  const handleProfileSelection = useCallback(
    (profileKey: string): void => {
      // Cancel any pending profile deletion when user selects a different profile
      setPendingProfileDeletion(null);
      // Cancel any pending property deletion when user selects a profile
      setPendingPropertyDeletion(null);
      return handleProfileSelectionHandler(profileKey, {
        setRenames,
        setSelectedProfileKey,
        setPendingMergedPropertiesRequest,
        setSortOrderVersion,
        setSelectedProfilesByConfig,
        setExpandedNodesByConfig,
        setPendingDefaults,
        setPendingChanges,
        setRenameProfileModalOpen,
        setDeletions,
        setSelectedTab,
        setIsNavigating,
        setDragDroppedProfiles,
        selectedTab,
        configurations,
        renames,
        dragDroppedProfiles,
        selectedProfileKey,
        pendingMergedPropertiesRequest,
        formatPendingChanges,
        extractPendingProfiles: utilityHelpers.extractPendingProfiles,
        findOptimalReplacementProfile,
        getAvailableProfilesForConfig,
        vscodeApi,
      });
    },
    [
      selectedTab,
      configurations,
      renames,
      dragDroppedProfiles,
      selectedProfileKey,
      pendingMergedPropertiesRequest,
      formatPendingChanges,
      extractPendingProfiles,
      findOptimalReplacementProfile,
      getAvailableProfilesForConfig,
      setRenames,
      setSelectedProfileKey,
      setPendingMergedPropertiesRequest,
      setSortOrderVersion,
      setSelectedProfilesByConfig,
      setExpandedNodesByConfig,
      setPendingDefaults,
      setPendingChanges,
      setRenameProfileModalOpen,
      setDeletions,
      setSelectedTab,
      setIsNavigating,
    ]
  );

  const handleNavigateToSource = useCallback(
    (jsonLoc: string, osLoc?: string[]): void => {
      const navigateHandler = handleNavigateToSourceHandler({
        setRenames,
        setSelectedProfileKey,
        setPendingMergedPropertiesRequest,
        setSortOrderVersion,
        setSelectedProfilesByConfig,
        setExpandedNodesByConfig,
        setPendingDefaults,
        setPendingChanges,
        setRenameProfileModalOpen,
        setDeletions,
        setSelectedTab,
        setIsNavigating,
        setDragDroppedProfiles,
        selectedTab,
        configurations,
        renames,
        dragDroppedProfiles,
        selectedProfileKey,
        pendingMergedPropertiesRequest,
        formatPendingChanges,
        extractPendingProfiles: utilityHelpers.extractPendingProfiles,
        findOptimalReplacementProfile,
        getAvailableProfilesForConfig,
        vscodeApi,
      });
      navigateHandler(jsonLoc, osLoc);
    },
    [
      selectedTab,
      configurations,
      renames,
      dragDroppedProfiles,
      selectedProfileKey,
      pendingMergedPropertiesRequest,
      formatPendingChanges,
      extractPendingProfiles,
      findOptimalReplacementProfile,
      getAvailableProfilesForConfig,
      setRenames,
      setSelectedProfileKey,
      setPendingMergedPropertiesRequest,
      setSortOrderVersion,
      setSelectedProfilesByConfig,
      setExpandedNodesByConfig,
      setPendingDefaults,
      setPendingChanges,
      setRenameProfileModalOpen,
      setDeletions,
      setSelectedTab,
      setIsNavigating,
      vscodeApi,
    ]
  );

  useEffect(() => {
    if (selectedTab !== null && profileFilterType) {
      const configPath = configurations[selectedTab]?.configPath;
      if (configPath) {
        const profilesObj = configurations[selectedTab]?.properties?.profiles;
        if (profilesObj) {
          const flatProfiles = flattenProfiles(profilesObj);
          const pendingProfiles = utilityHelpers.extractPendingProfiles(configPath);
          const allProfiles = { ...flatProfiles, ...pendingProfiles };
          const filteredProfileKeys = Object.keys(allProfiles).filter(
            (profileKey) => !utilityHelpers.isProfileOrParentDeleted(profileKey, configPath)
          );

          const availableTypes = Array.from(
            new Set(
              filteredProfileKeys
                .map((key) => getProfileType(key, selectedTab, configurations, pendingChanges, renames))
                .filter((type): type is string => type !== null)
            )
          );

          if (!availableTypes.includes(profileFilterType)) {
            setProfileFilterType(null);
          }
        }
      }
    }
  }, [selectedTab, configurations, profileFilterType, deletions, pendingChanges]);

  const openAddProfileModalAtPath = (path: string[]) => {
    // Cancel any pending property deletion when user opens add property modal
    setPendingPropertyDeletion(null);
    setNewProfileKeyPath(path);
    setNewProfileKey("");
    setNewProfileValue("");
    setNewProfileModalOpen(true);
  };

  const handleAddNewLayer = () => {
    if (!newLayerName.trim() || !newLayerPath) return;

    const path = [...newLayerPath, newLayerName.trim()];
    const fullKey = path.join(".");
    const profileKey = path[0];

    setPendingChanges((prev) => ({
      ...prev,
      [configurations[selectedTab!]!.configPath]: {
        ...prev[configurations[selectedTab!]!.configPath],
        [fullKey]: { value: {}, path, profile: profileKey },
      },
    }));

    setNewLayerName("");
    setNewLayerPath(null);
    setNewLayerModalOpen(false);
  };

  const handleAddNewConfig = () => {
    setAddConfigModalOpen(true);
  };
  const handleAddConfig = (configType: string) => {
    vscodeApi.postMessage({
      command: "CREATE_NEW_CONFIG",
      configType: configType,
    });
    setAddConfigModalOpen(false);
    setHasPromptedForZeroConfigs(false);
  };

  const handleCancelAddConfig = () => {
    setAddConfigModalOpen(false);
    setHasPromptedForZeroConfigs(false);
  };

  useMessageHandler({
    setConfigurations,
    setSelectedTab,
    setSelectedProfileKey,
    setFlattenedConfig,
    setFlattenedDefaults,
    setMergedProperties,
    setPendingChanges,
    setDeletions,
    setPendingDefaults,
    setDefaultsDeletions,
    setProfileSearchTerm,
    setProfileFilterType,
    setHasPromptedForZeroConfigs,
    setSaveModalOpen,
    setPendingMergedPropertiesRequest,
    setNewProfileValue,
    setHasWorkspace,
    setSelectedProfilesByConfig,
    setConfigEditorSettings,
    setSortOrderVersion,
    setSecureValuesAllowed,
    setSchemaValidations,
    setAddConfigModalOpen,
    setIsSaving,
    setPendingSaveSelection,
    configurationsRef,
    pendingSaveSelection,
    selectedTab,
    selectedProfilesByConfig,
    hasPromptedForZeroConfigs,
    handleRefresh,
    handleSave,
    vscodeApi,
    selectedProfileKeyRef,
  });

  return (
    <div className="app-container" data-testid="config-editor-app" data-config-count={configurations.length} data-selected-tab={selectedTab}>
      <Tabs
        configurations={configurations}
        selectedTab={selectedTab}
        onTabChange={handleTabChange}
        onOpenRawFile={handleOpenRawJson}
        onRevealInFinder={handleRevealInFinder}
        onOpenSchemaFile={handleOpenSchemaFile}
        onAddNewConfig={handleAddNewConfig}
        onToggleAutostore={handleAutostoreToggle}
        pendingChanges={pendingChanges}
        autostoreChanges={autostoreChanges}
        renames={renames}
        deletions={deletions}
      />
      <Panels
        configurations={configurations}
        selectedTab={selectedTab}
        renderProfiles={(profilesObj) => (
          <RenderProfiles
            profilesObj={profilesObj}
            configurations={configurations}
            selectedTab={selectedTab}
            deletions={deletions}
            pendingChanges={pendingChanges}
            renames={renames}
            selectedProfileKey={selectedProfileKey}
            profileMenuOpen={profileMenuOpen}
            vscodeApi={vscodeApi}
            viewMode={viewMode}
            profileSearchTerm={profileSearchTerm}
            profileFilterType={profileFilterType}
            profileSortOrder={profileSortOrder || "natural"}
            handleProfileSelection={handleProfileSelection}
            setProfileMenuOpen={setProfileMenuOpen}
            handleDeleteProfile={handleDeleteProfile}
            handleSetAsDefault={handleSetAsDefault}
            handleRenameProfile={handleRenameProfile}
            setProfileSearchTerm={setProfileSearchTerm}
            setProfileFilterType={setProfileFilterType}
            setProfileSortOrderWithStorage={setProfileSortOrderWithStorage}
            setExpandedNodesForConfig={setExpandedNodesForConfig}
            setPendingDefaults={setPendingDefaults}
            onViewModeToggle={() => setViewModeWithStorage(viewMode === "tree" ? "flat" : "tree")}
            extractPendingProfiles={utilityHelpers.extractPendingProfiles}
            isProfileOrParentDeleted={utilityHelpers.isProfileOrParentDeletedForComponent}
            getRenamedProfileKey={getRenamedProfileKey}
            getProfileType={getProfileType}
            hasPendingSecureChanges={utilityHelpers.hasPendingSecureChanges}
            hasPendingRename={hasPendingRename}
            isProfileDefault={utilityHelpers.isProfileDefault}
            sortProfilesAtLevel={utilityHelpers.sortProfilesAtLevel}
            getExpandedNodesForConfig={getExpandedNodesForConfig}
          />
        )}
        renderProfileDetails={() => (
          <RenderProfileDetails
            selectedProfileKey={selectedProfileKey}
            configurations={configurations}
            selectedTab={selectedTab}
            vscodeApi={vscodeApi}
            showMergedProperties={showMergedProperties}
            propertySortOrder={propertySortOrder}
            sortOrderVersion={sortOrderVersion}
            pendingChanges={pendingChanges}
            deletions={deletions}
            renames={renames}
            schemaValidations={schemaValidations}
            hiddenItems={hiddenItems}
            secureValuesAllowed={secureValuesAllowed}
            SORT_ORDER_OPTIONS={SORT_ORDER_OPTIONS}
            mergedProperties={mergedProperties}
            pendingDefaults={pendingDefaults}
            isProfileDefault={utilityHelpers.isProfileDefault}
            getProfileType={getProfileType}
            handleSetAsDefault={handleSetAsDefault}
            setPendingDefaults={setPendingDefaults}
            setShowMergedPropertiesWithStorage={setShowMergedPropertiesWithStorage}
            setRenameProfileModalOpen={(open: boolean) => {
              if (open) {
                // Cancel any pending profile deletion when user opens rename modal
                setPendingProfileDeletion(null);
              }
              setRenameProfileModalOpen(open);
            }}
            handleDeleteProfile={handleDeleteProfile}
            handleChange={handleChange}
            handleDeleteProperty={handleDeleteProperty}
            confirmDeleteProperty={confirmDeleteProperty}
            pendingPropertyDeletion={pendingPropertyDeletion}
            setPendingPropertyDeletion={setPendingPropertyDeletion}
            confirmDeleteProfile={confirmDeleteProfile}
            pendingProfileDeletion={pendingProfileDeletion}
            setPendingProfileDeletion={setPendingProfileDeletion}
            handleUnlinkMergedProperty={handleUnlinkMergedProperty}
            handleNavigateToSource={handleNavigateToSource}
            handleToggleSecure={utilityHelpers.handleToggleSecure}
            openAddProfileModalAtPath={openAddProfileModalAtPath}
            setPropertySortOrderWithStorage={setPropertySortOrderWithStorage}
            getWizardTypeOptions={getWizardTypeOptions}
            extractPendingProfiles={utilityHelpers.extractPendingProfiles}
            getOriginalProfileKey={getOriginalProfileKey}
            getProfileNameForMergedProperties={getProfileNameForMergedProperties}
            mergePendingChangesForProfile={utilityHelpers.mergePendingChangesForProfile}
            mergeMergedProperties={utilityHelpers.mergeMergedProperties}
            ensureProfileProperties={ensureProfileProperties}
            filterSecureProperties={utilityHelpers.filterSecureProperties}
            mergePendingSecureProperties={utilityHelpers.mergePendingSecureProperties}
            isCurrentProfileUntyped={utilityHelpers.isCurrentProfileUntyped}
            isPropertyFromMergedProps={utilityHelpers.isPropertyFromMergedProps}
            isPropertySecure={(fullKey: string, displayKey: string, path: string[], mergedProps?: any) =>
              isPropertySecure(fullKey, displayKey, path, mergedProps, selectedTab, configurations, pendingChanges, renames)
            }
            canPropertyBeSecure={utilityHelpers.canPropertyBeSecure}
            isMergedPropertySecure={isMergedPropertySecure}
            isProfileAffectedByDragDrop={isProfileAffectedByDragDrop}
            propertyDescriptions={getWizardPropertyDescriptions()}
          />
        )}
        renderDefaults={(defaults) => (
          <RenderDefaults
            defaults={defaults}
            configurations={configurations}
            selectedTab={selectedTab}
            pendingDefaults={pendingDefaults}
            defaultsDeletions={defaultsDeletions}
            renames={renames}
            handleDefaultsChange={handleDefaultsChange}
            getWizardTypeOptions={getWizardTypeOptions}
            getAvailableProfilesByType={utilityHelpers.getAvailableProfilesByType}
          />
        )}
        onProfileWizard={() => setWizardModalOpen(true)}
        viewMode={viewMode}
        onViewModeToggle={() => setViewModeWithStorage(viewMode === "tree" ? "flat" : "tree")}
        profileSortOrder={profileSortOrder || "natural"}
        onProfileSortOrderChange={setProfileSortOrderWithStorage}
        defaultsCollapsed={defaultsCollapsed}
        onDefaultsCollapsedChange={setDefaultsCollapsedWithStorage}
        profilesCollapsed={profilesCollapsed}
        onProfilesCollapsedChange={setProfilesCollapsedWithStorage}
        onClearChanges={handleRefresh}
        onSaveAll={() => {
          if (hasPendingChanges()) {
            handleSave();
            setSaveModalOpen(true);
          }
        }}
        hasPendingChanges={hasPendingChanges()}
      />
      {/* Modals */}

      <AddProfileModal
        key={`add-profile-${newProfileModalOpen}`}
        isOpen={newProfileModalOpen}
        newProfileKey={newProfileKey}
        newProfileValue={newProfileValue}
        showDropdown={showDropdown}
        typeOptions={
          newProfileKeyPath
            ? fetchTypeOptions(newProfileKeyPath, selectedTab, configurations, schemaValidations, getProfileType, pendingChanges, renames)
            : []
        }
        propertyDescriptions={
          newProfileKeyPath
            ? getPropertyDescriptions(newProfileKeyPath, selectedTab, configurations, schemaValidations, getProfileType, pendingChanges, renames)
            : {}
        }
        isSecure={isSecure}
        secureValuesAllowed={secureValuesAllowed}
        getPropertyType={(propertyKey: string) =>
          getPropertyTypeForAddProfile(
            propertyKey,
            selectedTab,
            configurations,
            selectedProfileKey,
            schemaValidations,
            getProfileType,
            pendingChanges,
            renames
          )
        }
        canPropertyBeSecure={utilityHelpers.canPropertyBeSecure}
        newProfileKeyPath={newProfileKeyPath || []}
        vscodeApi={vscodeApi}
        onNewProfileKeyChange={setNewProfileKey}
        onNewProfileValueChange={setNewProfileValue}
        onShowDropdownChange={setShowDropdown}
        onSecureToggle={() => {
          if (secureValuesAllowed) {
            setIsSecure(!isSecure);
          }
        }}
        onAdd={handleAddNewProfileKey}
        onCancel={() => {
          setNewProfileModalOpen(false);
          setIsSecure(false);
          setFocusValueInput(false);
        }}
        focusValueInput={focusValueInput}
      />

      <SaveModal isOpen={saveModalOpen} />

      <NewLayerModal
        key={`new-layer-${newLayerModalOpen}`}
        isOpen={newLayerModalOpen}
        newLayerName={newLayerName}
        onNewLayerNameChange={setNewLayerName}
        onAdd={handleAddNewLayer}
        onCancel={() => setNewLayerModalOpen(false)}
      />

      <WizardManager
        wizardModalOpen={wizardModalOpen}
        wizardRootProfile={wizardRootProfile}
        wizardSelectedType={wizardSelectedType}
        wizardProfileName={wizardProfileName}
        wizardProperties={wizardProperties}
        wizardShowKeyDropdown={wizardShowKeyDropdown}
        wizardNewPropertyKey={wizardNewPropertyKey}
        wizardNewPropertyValue={wizardNewPropertyValue}
        wizardNewPropertySecure={wizardNewPropertySecure}
        wizardMergedProperties={wizardMergedProperties}
        setWizardRootProfile={setWizardRootProfile}
        setWizardSelectedType={setWizardSelectedType}
        setWizardProfileName={setWizardProfileName}
        setWizardShowKeyDropdown={setWizardShowKeyDropdown}
        setWizardNewPropertyKey={setWizardNewPropertyKey}
        setWizardNewPropertyValue={setWizardNewPropertyValue}
        setWizardNewPropertySecure={setWizardNewPropertySecure}
        getWizardTypeOptions={getWizardTypeOptions}
        getWizardPropertyOptions={getWizardPropertyOptions}
        getWizardPropertyDescriptions={getWizardPropertyDescriptions}
        getPropertyType={getPropertyType}
        isProfileNameTaken={isProfileNameTaken}
        handleWizardAddProperty={handleWizardAddProperty}
        handleWizardRemoveProperty={handleWizardRemoveProperty}
        handleWizardPropertyValueChange={handleWizardPropertyValueChange}
        handleWizardPropertySecureToggle={handleWizardPropertySecureToggle}
        handleWizardCreateProfile={handleWizardCreateProfile}
        handleWizardCancel={handleWizardCancel}
        requestWizardMergedProperties={requestWizardMergedProperties}
        handleWizardPopulateDefaults={handleWizardPopulateDefaults}
        selectedTab={selectedTab}
        secureValuesAllowed={secureValuesAllowed}
        vscodeApi={vscodeApi}
        getAvailableProfiles={getAvailableProfiles}
        canPropertyBeSecure={utilityHelpers.canPropertyBeSecure}
        canPropertyBeSecureForWizard={(displayKey: string, profileType: string): boolean => {
          if (!displayKey) {
            return false;
          }

          // Allow secure properties for typeless profiles (when profileType is empty)
          if (!profileType) {
            return true;
          }

          // Get the schema validation for the current configuration
          const configPath = configurations[selectedTab!]?.configPath;
          if (!configPath) {
            return false;
          }

          // Create a mock path for the function call
          const mockPath = ["profiles", "mockProfile", "properties"];
          return utilityHelpers.canPropertyBeSecure(displayKey, mockPath);
        }}
        stringifyValueByType={stringifyValueByType}
        onWizardMergedProperties={(data) => {
          const mergedPropsData: { [key: string]: any } = {};
          if (Array.isArray(data.mergedArgs)) {
            data.mergedArgs.forEach((item: any) => {
              if (item.argName && item.argValue !== undefined) {
                let correctValue = item.argValue;
                if (item.dataType === "boolean") {
                  if (typeof item.argValue === "string") {
                    correctValue = item.argValue.toLowerCase() === "true";
                  } else {
                    correctValue = Boolean(item.argValue);
                  }
                } else if (item.dataType === "number") {
                  if (typeof item.argValue === "string") {
                    const num = Number(item.argValue);
                    correctValue = isNaN(num) ? item.argValue : num;
                  }
                }

                mergedPropsData[item.argName] = {
                  value: correctValue,
                  dataType: item.dataType,
                  secure: item.secure,
                  argLoc: item.argLoc,
                };
              }
            });
          }
          setWizardMergedProperties(mergedPropsData);
        }}
        onFileSelected={(data) => {
          if (data.filePath) {
            if (data.isNewProperty) {
              if (data.source === "wizard") {
                setWizardNewPropertyValue(data.filePath);
              }
            } else {
              const propertyIndex = data.propertyIndex;
              if (propertyIndex !== undefined && propertyIndex >= 0) {
                const updatedProperties = [...wizardProperties];
                updatedProperties[propertyIndex] = {
                  ...updatedProperties[propertyIndex],
                  value: data.filePath,
                };
                setWizardProperties(updatedProperties);
              }
            }
          }
        }}
      />

      <AddConfigModal
        key={`add-config-${addConfigModalOpen}`}
        isOpen={addConfigModalOpen}
        configurations={configurations}
        hasWorkspace={hasWorkspace}
        onAdd={handleAddConfig}
        onCancel={handleCancelAddConfig}
      />

      <RenameProfileModal
        key={`rename-profile-${renameProfileModalOpen}`}
        isOpen={renameProfileModalOpen}
        currentProfileName={selectedProfileKey ? selectedProfileKey.split(".").pop() || selectedProfileKey : ""}
        currentProfileKey={selectedProfileKey || ""}
        existingProfiles={(() => {
          if (selectedTab === null || !selectedProfileKey) return [];
          const config = configurations[selectedTab];
          if (!config?.properties?.profiles) return [];

          const getAllProfileKeys = (profiles: any, parentKey = ""): string[] => {
            const keys: string[] = [];
            for (const key of Object.keys(profiles)) {
              const profile = profiles[key];
              const qualifiedKey = parentKey ? `${parentKey}.${key}` : key;
              keys.push(qualifiedKey);

              if (profile.profiles) {
                keys.push(...getAllProfileKeys(profile.profiles, qualifiedKey));
              }
            }
            return keys;
          };

          return getAllProfileKeys(config.properties.profiles);
        })()}
        pendingProfiles={(() => {
          if (selectedTab === null) return [];
          const config = configurations[selectedTab];
          if (!config) return [];

          const pendingProfiles = utilityHelpers.extractPendingProfiles(config.configPath);
          return Object.keys(pendingProfiles);
        })()}
        pendingRenames={(() => {
          if (selectedTab === null) return {};
          const config = configurations[selectedTab];
          if (!config) return {};

          return renames[config.configPath] || {};
        })()}
        onRename={(newName) => {
          const configPath = configurations[selectedTab!]?.configPath;
          if (configPath) {
            const config = configurations[selectedTab!];
            const getAllOriginalKeys = (profiles: any, parentKey = ""): string[] => {
              const keys: string[] = [];
              for (const key of Object.keys(profiles)) {
                const qualifiedKey = parentKey ? `${parentKey}.${key}` : key;
                keys.push(qualifiedKey);
                if (profiles[key].profiles) {
                  keys.push(...getAllOriginalKeys(profiles[key].profiles, qualifiedKey));
                }
              }
              return keys;
            };

            const originalKeys = getAllOriginalKeys(config.properties?.profiles || {});

            let trueOriginalKey = selectedProfileKey!;
            for (const origKey of originalKeys) {
              const renamedKey = getRenamedProfileKeyWithNested(origKey, configPath, renames);
              if (renamedKey === selectedProfileKey) {
                trueOriginalKey = origKey;
                break;
              }
            }

            handleRenameProfile(trueOriginalKey, newName);
          }
        }}
        onCancel={() => setRenameProfileModalOpen(false)}
      />
    </div>
  );
}
