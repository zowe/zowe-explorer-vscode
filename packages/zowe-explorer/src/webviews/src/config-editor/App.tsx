import { useEffect, useState, useCallback, useRef } from "react";
import { isSecureOrigin } from "../utils";
import { schemaValidation } from "../../../utils/ConfigSchemaHelpers";
import { Definitions } from "../../../configuration/Definitions";
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
  ProfileSortOrder,
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
import { handleMessage } from "./handlers/messageHandlers";
import {
  handleRenameProfile as handleRenameProfileHandler,
  handleDeleteProfile as handleDeleteProfileHandler,
  handleProfileSelection as handleProfileSelectionHandler,
  handleNavigateToSource as handleNavigateToSourceHandler,
} from "./handlers/profileHandlers";

const vscodeApi = acquireVsCodeApi();

type Configuration = {
  configPath: string;
  properties: any;
  secure: string[];
  global?: boolean;
  user?: boolean;
  schemaPath?: string;
};

type PendingChange = {
  value: string | number | boolean | Record<string, any>;
  path: string[];
  profile: string;
  secure?: boolean;
};

type PendingDefault = {
  value: string;
  path: string[];
};

const CONFIG_EDITOR_SETTINGS_KEY = Definitions.LocalStorageKey.CONFIG_EDITOR_SETTINGS;

const SORT_ORDER_OPTIONS: PropertySortOrder[] = ["alphabetical", "merged-first", "non-merged-first"];

export function App() {
  const [configurations, setConfigurations] = useState<Configuration[]>([]);
  const [selectedTab, setSelectedTab] = useState<number | null>(null);
  const [flattenedConfig, setFlattenedConfig] = useState<{ [key: string]: { value: string; path: string[] } }>({});
  const [flattenedDefaults, setFlattenedDefaults] = useState<{ [key: string]: { value: string; path: string[] } }>({});
  const [pendingChanges, setPendingChanges] = useState<{ [configPath: string]: { [key: string]: PendingChange } }>({});
  const [pendingDefaults, setPendingDefaults] = useState<{ [configPath: string]: { [key: string]: PendingDefault } }>({});
  const [deletions, setDeletions] = useState<{ [configPath: string]: string[] }>({});
  const [defaultsDeletions, setDefaultsDeletions] = useState<{ [configPath: string]: string[] }>({});
  const [renames, setRenames] = useState<{ [configPath: string]: { [originalKey: string]: string } }>({});
  const [dragDroppedProfiles, setDragDroppedProfiles] = useState<{ [configPath: string]: Set<string> }>({});
  const [autostoreChanges, setAutostoreChanges] = useState<{ [configPath: string]: boolean }>({});
  const [hiddenItems, setHiddenItems] = useState<{ [configPath: string]: { [key: string]: { path: string } } }>({});
  const [schemaValidations, setSchemaValidations] = useState<{ [configPath: string]: schemaValidation | undefined }>({});
  const [selectedProfileKey, setSelectedProfileKey] = useState<string | null>(null);
  const [selectedProfilesByConfig, setSelectedProfilesByConfig] = useState<{ [configPath: string]: string | null }>({});
  const [mergedProperties, setMergedProperties] = useState<any>(null);
  // Consolidated config editor settings
  const [configEditorSettings, setConfigEditorSettings] = useState<Definitions.ConfigEditorSettings>({
    showMergedProperties: true,
    viewMode: "tree",
    propertySortOrder: "alphabetical",
    profileSortOrder: "natural",
    profilesWidthPercent: 35,
    defaultsCollapsed: true,
    profilesCollapsed: false,
  });

  const [pendingMergedPropertiesRequest, setPendingMergedPropertiesRequest] = useState<string | null>(null);
  const [sortOrderVersion, setSortOrderVersion] = useState<number>(0);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [pendingSaveSelection, setPendingSaveSelection] = useState<{ tab: number | null; profile: string | null } | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [profileSearchTerm, setProfileSearchTerm] = useState("");
  const [profileFilterType, setProfileFilterType] = useState<string | null>(null);
  const [hasWorkspace, setHasWorkspace] = useState<boolean>(false);
  const [secureValuesAllowed, setSecureValuesAllowed] = useState<boolean>(true);
  const [hasPromptedForZeroConfigs, setHasPromptedForZeroConfigs] = useState(false);
  const [expandedNodesByConfig, setExpandedNodesByConfig] = useState<{ [configPath: string]: Set<string> }>({});

  // Destructured settings for easier access
  const { showMergedProperties, viewMode, propertySortOrder, profileSortOrder, profilesWidthPercent, defaultsCollapsed, profilesCollapsed } =
    configEditorSettings;

  // Setters for individual settings
  const setShowMergedProperties = (value: boolean) => {
    setConfigEditorSettings((prev) => ({ ...prev, showMergedProperties: value }));
    setSortOrderVersion((prev) => prev + 1);
  };

  const setViewMode = (value: "flat" | "tree") => {
    setConfigEditorSettings((prev) => ({ ...prev, viewMode: value }));
  };

  const setPropertySortOrder = (value: PropertySortOrder) => {
    setConfigEditorSettings((prev) => ({ ...prev, propertySortOrder: value }));
    setSortOrderVersion((prev) => prev + 1);
  };

  const setProfileSortOrder = (value: ProfileSortOrder | null) => {
    setConfigEditorSettings((prev) => ({ ...prev, profileSortOrder: value || "natural" }));
  };

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

  const configurationsRef = useRef<Configuration[]>([]);
  const pendingChangesRef = useRef<{ [configPath: string]: { [key: string]: PendingChange } }>({});
  const deletionsRef = useRef<{ [configPath: string]: string[] }>({});
  const pendingDefaultsRef = useRef<{ [configPath: string]: { [key: string]: PendingDefault } }>({});
  const defaultsDeletionsRef = useRef<{ [configPath: string]: string[] }>({});
  const autostoreChangesRef = useRef<{ [configPath: string]: boolean }>({});
  const renamesRef = useRef<{ [configPath: string]: { [originalKey: string]: string } }>({});
  const selectedProfileKeyRef = useRef<string | null>(null);

  useEffect(() => {
    pendingChangesRef.current = pendingChanges;
  }, [pendingChanges]);

  useEffect(() => {
    deletionsRef.current = deletions;
  }, [deletions]);

  useEffect(() => {
    pendingDefaultsRef.current = pendingDefaults;
  }, [pendingDefaults]);

  useEffect(() => {
    defaultsDeletionsRef.current = defaultsDeletions;
  }, [defaultsDeletions]);

  useEffect(() => {
    autostoreChangesRef.current = autostoreChanges;
  }, [autostoreChanges]);

  useEffect(() => {
    renamesRef.current = renames;
  }, [renames]);

  useEffect(() => {
    selectedProfileKeyRef.current = selectedProfileKey;
  }, [selectedProfileKey]);

  const getLocalStorageValue = useCallback((key: string, defaultValue: any) => {
    vscodeApi.postMessage({
      command: "GET_LOCAL_STORAGE_VALUE",
      key,
    });
    return defaultValue;
  }, []);

  const setLocalStorageValue = useCallback((key: string, value: any) => {
    vscodeApi.postMessage({
      command: "SET_LOCAL_STORAGE_VALUE",
      key,
      value,
    });
  }, []);
  const setShowMergedPropertiesWithStorage = useCallback(
    (value: boolean) => {
      setConfigEditorSettings((prev) => ({ ...prev, showMergedProperties: value }));
      setLocalStorageValue(CONFIG_EDITOR_SETTINGS_KEY, { ...configEditorSettings, showMergedProperties: value });
      setSortOrderVersion((prev) => prev + 1);
    },
    [setLocalStorageValue, configEditorSettings]
  );

  const setViewModeWithStorage = useCallback(
    (value: "flat" | "tree") => {
      setConfigEditorSettings((prev) => ({ ...prev, viewMode: value }));
      setLocalStorageValue(CONFIG_EDITOR_SETTINGS_KEY, { ...configEditorSettings, viewMode: value });
    },
    [setLocalStorageValue, configEditorSettings]
  );

  const setPropertySortOrderWithStorage = useCallback(
    (value: PropertySortOrder) => {
      setConfigEditorSettings((prev) => ({ ...prev, propertySortOrder: value }));
      setLocalStorageValue(CONFIG_EDITOR_SETTINGS_KEY, { ...configEditorSettings, propertySortOrder: value });
      setSortOrderVersion((prev) => prev + 1);
    },
    [setLocalStorageValue, configEditorSettings]
  );

  const setProfileSortOrderWithStorage = useCallback(
    (value: ProfileSortOrder) => {
      setConfigEditorSettings((prev) => ({ ...prev, profileSortOrder: value }));
      setLocalStorageValue(CONFIG_EDITOR_SETTINGS_KEY, { ...configEditorSettings, profileSortOrder: value });
    },
    [setLocalStorageValue, configEditorSettings]
  );

  const setDefaultsCollapsedWithStorage = useCallback(
    (value: boolean) => {
      setConfigEditorSettings((prev) => ({ ...prev, defaultsCollapsed: value }));
      setLocalStorageValue(CONFIG_EDITOR_SETTINGS_KEY, { ...configEditorSettings, defaultsCollapsed: value });
    },
    [setLocalStorageValue, configEditorSettings]
  );

  const setProfilesCollapsedWithStorage = useCallback(
    (value: boolean) => {
      setConfigEditorSettings((prev) => ({ ...prev, profilesCollapsed: value }));
      setLocalStorageValue(CONFIG_EDITOR_SETTINGS_KEY, { ...configEditorSettings, profilesCollapsed: value });
    },
    [setLocalStorageValue, configEditorSettings]
  );

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
  }, [selectedTab, selectedProfileKey]);

  useEffect(() => {
    getLocalStorageValue(CONFIG_EDITOR_SETTINGS_KEY, {
      showMergedProperties: true,
      viewMode: "tree",
      propertySortOrder: "alphabetical",
      profileSortOrder: "natural",
      profilesWidthPercent: 35,
      defaultsCollapsed: true,
      profilesCollapsed: false,
    });
  }, [getLocalStorageValue]);

  useEffect(() => {
    setConfigurations([]);
    setSelectedTab(null);
    setSelectedProfileKey(null);
    setFlattenedConfig({});
    setFlattenedDefaults({});
    setMergedProperties(null);
    setPendingChanges({});
    setDeletions({});
    setPendingDefaults({});
    setDefaultsDeletions({});
    setProfileSearchTerm("");
    setProfileFilterType(null);
    setHasPromptedForZeroConfigs(false);

    window.addEventListener("message", (event) => {
      if (!isSecureOrigin(event.origin)) {
        return;
      }

      const messageHandlerProps = {
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
        setShowMergedProperties,
        setSortOrderVersion,
        setViewMode,
        setPropertySortOrder,
        setProfileSortOrder,
        setSecureValuesAllowed,
        setSchemaValidations,
        setAddConfigModalOpen,
        setIsSaving,
        setPendingSaveSelection,
        setConfigEditorSettings,
        configurationsRef,
        pendingSaveSelection,
        selectedTab,
        selectedProfilesByConfig,
        hasPromptedForZeroConfigs,
        handleRefresh,
        handleSave,
        vscodeApi,
      };

      handleMessage(event, messageHandlerProps);
    });

    vscodeApi.postMessage({ command: "GET_PROFILES" });
    vscodeApi.postMessage({ command: "GET_ENV_INFORMATION" });

    const handleWindowFocus = () => {
      if (!selectedProfileKeyRef.current) {
        vscodeApi.postMessage({ command: "GET_PROFILES" });
        vscodeApi.postMessage({ command: "GET_ENV_INFORMATION" });
        vscodeApi.postMessage({ command: "GET_KEYBINDS" });
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        if (!selectedProfileKeyRef.current) {
          vscodeApi.postMessage({ command: "GET_PROFILES" });
          vscodeApi.postMessage({ command: "GET_ENV_INFORMATION" });
        }
      }
    };

    const handleBeforeUnload = () => {};

    const handleLoad = () => {
      setTimeout(() => {
        vscodeApi.postMessage({ command: "GET_PROFILES" });
        vscodeApi.postMessage({ command: "GET_ENV_INFORMATION" });
      }, 100);
    };

    const handleDOMContentLoaded = () => {
      vscodeApi.postMessage({ command: "GET_PROFILES" });
      vscodeApi.postMessage({ command: "GET_ENV_INFORMATION" });
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("load", handleLoad);
    document.addEventListener("DOMContentLoaded", handleDOMContentLoaded);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("load", handleLoad);
      document.removeEventListener("DOMContentLoaded", handleDOMContentLoaded);
    };
  }, []);

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
  }, []);

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

    setAutostoreChanges((prev) => ({
      ...prev,
      [configPath]: newValue,
    }));
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

  const handleDeleteProperty = (fullKey: string, secure?: boolean) => {
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
  };

  const handleUnlinkMergedProperty = (propertyKey: string | undefined, fullKey: string) => {
    if (!propertyKey) return;
    setNewProfileKey(propertyKey);
    setNewProfileValue("");
    setNewProfileKeyPath(fullKey.split(".").slice(0, -1));
    setNewProfileModalOpen(true);
    setFocusValueInput(true);
  };

  const handleSetAsDefault = (profileKey: string) => {
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

  const mergePendingChangesForProfileWrapper = useCallback(
    (baseObj: any, path: string[], configPath: string): any => {
      return mergePendingChangesForProfile(baseObj, path, configPath, pendingChanges, renames);
    },
    [pendingChanges, renames]
  );

  const mergeMergedPropertiesWrapper = useCallback(
    (combinedConfig: any, path: string[], mergedProps: any, configPath: string): any => {
      return mergeMergedProperties(
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
      );
    },
    [selectedTab, configurations, pendingChanges, renames, schemaValidations, deletions]
  );

  const filterSecurePropertiesWrapper = useCallback(
    (value: any, combinedConfig: any, configPath?: string, pendingChanges?: any, deletions?: any, mergedProps?: any): any => {
      return filterSecureProperties(value, combinedConfig, configPath, pendingChanges || {}, deletions || {}, mergedProps);
    },
    [pendingChanges, deletions]
  );

  const mergePendingSecurePropertiesWrapper = useCallback(
    (value: any[], path: string[], configPath: string): any[] => {
      return mergePendingSecureProperties(value, path, configPath, pendingChanges, renames);
    },
    [pendingChanges, renames]
  );

  const isPropertyFromMergedPropsWrapper = useCallback(
    (displayKey: string | undefined, path: string[], mergedProps: any, configPath: string): boolean => {
      return isPropertyFromMergedProps(
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
      );
    },
    [showMergedProperties, selectedTab, configurations, pendingChanges, renames, selectedProfileKey, isPropertyActuallyInherited]
  );

  const canPropertyBeSecureWrapper = useCallback(
    (displayKey: string, _path: string[]): boolean => {
      return canPropertyBeSecure(
        displayKey,
        selectedTab,
        configurations,
        schemaValidations,
        getProfileType,
        pendingChanges,
        renames,
        selectedProfileKey
      );
    },
    [selectedTab, configurations, schemaValidations, pendingChanges, renames, selectedProfileKey]
  );

  const handleToggleSecureWrapper = useCallback(
    (fullKey: string, displayKey: string, path: string[]): void => {
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
    [selectedTab, configurations, pendingChanges, setPendingChanges, selectedProfileKey, renames]
  );

  const hasPendingSecureChangesWrapper = useCallback(
    (configPath: string): boolean => {
      return hasPendingSecureChanges(configPath, pendingChanges);
    },
    [pendingChanges]
  );

  const extractPendingProfilesWrapper = useCallback(
    (configPath: string): { [key: string]: any } => {
      const profileNames = extractPendingProfiles(pendingChanges, configPath);
      const result: { [key: string]: any } = {};
      profileNames.forEach((profileName) => {
        result[profileName] = {};
      });
      return result;
    },
    [pendingChanges]
  );

  const isProfileOrParentDeletedWrapper = useCallback(
    (profileKey: string, configPath: string): boolean => {
      return isProfileOrParentDeleted(profileKey, deletions, configPath);
    },
    [deletions]
  );

  const isProfileOrParentDeletedForComponent = useCallback((profileKey: string, deletedProfiles: string[]): boolean => {
    return deletedProfiles.some((deletedProfile) => profileKey === deletedProfile || profileKey.startsWith(deletedProfile + "."));
  }, []);

  const getAvailableProfilesByTypeWrapper = useCallback(
    (profileType: string): string[] => {
      return getAvailableProfilesByType(profileType, selectedTab, configurations, pendingChanges, renames);
    },
    [selectedTab, configurations, pendingChanges, renames]
  );

  const isProfileDefaultWrapper = useCallback(
    (profileKey: string): boolean => {
      return isProfileDefault(profileKey, selectedTab, configurations, pendingChanges, pendingDefaults, renames);
    },
    [selectedTab, configurations, pendingChanges, pendingDefaults, renames]
  );

  const isCurrentProfileUntypedWrapper = useCallback((): boolean => {
    return isCurrentProfileUntyped(selectedProfileKey, selectedTab, configurations, pendingChanges, renames);
  }, [selectedProfileKey, selectedTab, configurations, pendingChanges, renames]);

  const sortProfilesAtLevelWrapper = useCallback(
    (profileKeys: string[]): string[] => {
      return sortProfilesAtLevel(profileKeys, profileSortOrder);
    },
    [profileSortOrder]
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

      const pendingProfiles = extractPendingProfilesWrapper(configPath);

      const getAvailableProfiles = (profiles: any, parentKey = ""): string[] => {
        const available: string[] = [];
        for (const key of Object.keys(profiles)) {
          const profile = profiles[key];
          const qualifiedKey = parentKey ? `${parentKey}.${key}` : key;

          if (!isProfileOrParentDeletedWrapper(qualifiedKey, configPath)) {
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
        (key) => !existingProfiles.includes(key) && !isProfileOrParentDeletedWrapper(key, configPath)
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
        extractPendingProfiles: extractPendingProfilesWrapper,
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

  const handleDeleteProfile = useCallback(
    (profileKey: string): void => {
      return handleDeleteProfileHandler(profileKey, {
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
        extractPendingProfiles: extractPendingProfilesWrapper,
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

  const handleProfileSelection = useCallback(
    (profileKey: string): void => {
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
        extractPendingProfiles: extractPendingProfilesWrapper,
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
        extractPendingProfiles: extractPendingProfilesWrapper,
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
          const pendingProfiles = extractPendingProfilesWrapper(configPath);
          const allProfiles = { ...flatProfiles, ...pendingProfiles };
          const filteredProfileKeys = Object.keys(allProfiles).filter((profileKey) => !isProfileOrParentDeletedWrapper(profileKey, configPath));

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
            extractPendingProfiles={extractPendingProfilesWrapper}
            isProfileOrParentDeleted={isProfileOrParentDeletedForComponent}
            getRenamedProfileKey={getRenamedProfileKey}
            getProfileType={getProfileType}
            hasPendingSecureChanges={hasPendingSecureChangesWrapper}
            hasPendingRename={hasPendingRename}
            isProfileDefault={isProfileDefaultWrapper}
            sortProfilesAtLevel={sortProfilesAtLevelWrapper}
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
            isProfileDefault={isProfileDefaultWrapper}
            getProfileType={getProfileType}
            handleSetAsDefault={handleSetAsDefault}
            setPendingDefaults={setPendingDefaults}
            setShowMergedPropertiesWithStorage={setShowMergedPropertiesWithStorage}
            setRenameProfileModalOpen={setRenameProfileModalOpen}
            handleDeleteProfile={handleDeleteProfile}
            handleChange={handleChange}
            handleDeleteProperty={handleDeleteProperty}
            handleUnlinkMergedProperty={handleUnlinkMergedProperty}
            handleNavigateToSource={handleNavigateToSource}
            handleToggleSecure={handleToggleSecureWrapper}
            openAddProfileModalAtPath={openAddProfileModalAtPath}
            setPropertySortOrderWithStorage={setPropertySortOrderWithStorage}
            getWizardTypeOptions={getWizardTypeOptions}
            extractPendingProfiles={extractPendingProfilesWrapper}
            getOriginalProfileKey={getOriginalProfileKey}
            getProfileNameForMergedProperties={getProfileNameForMergedProperties}
            mergePendingChangesForProfile={mergePendingChangesForProfileWrapper}
            mergeMergedProperties={mergeMergedPropertiesWrapper}
            ensureProfileProperties={ensureProfileProperties}
            filterSecureProperties={filterSecurePropertiesWrapper}
            mergePendingSecureProperties={mergePendingSecurePropertiesWrapper}
            isCurrentProfileUntyped={isCurrentProfileUntypedWrapper}
            isPropertyFromMergedProps={isPropertyFromMergedPropsWrapper}
            isPropertySecure={(fullKey: string, displayKey: string, path: string[], mergedProps?: any) =>
              isPropertySecure(fullKey, displayKey, path, mergedProps, selectedTab, configurations, pendingChanges, renames)
            }
            canPropertyBeSecure={canPropertyBeSecureWrapper}
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
            getAvailableProfilesByType={getAvailableProfilesByTypeWrapper}
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
          handleSave();
          setSaveModalOpen(true);
        }}
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
        canPropertyBeSecure={canPropertyBeSecureWrapper}
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
        canPropertyBeSecure={canPropertyBeSecureWrapper}
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
          return canPropertyBeSecureWrapper(displayKey, mockPath);
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

          const pendingProfiles = extractPendingProfilesWrapper(config.configPath);
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
