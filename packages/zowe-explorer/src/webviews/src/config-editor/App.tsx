import { useState, useCallback, useEffect, useRef } from "react";

import "./App.css";

import {
  Tabs,
  Panels,
  AddProfileModal,
  SaveModal,
  NewLayerModal,
  AddConfigModal,
  ConfigParseErrorsModal,
  RenameProfileModal,
  RenderProfiles,
  RenderProfileDetails,
  RenderDefaults,
  WizardManager,
} from "./components";

import { flattenKeys, flattenProfiles, getAllQualifiedProfileKeys, resolveOriginalProfileKeyFromRenames } from "./utils";
import { getProfileType } from "./utils/profileUtils";
import { getPropertyTypeForAddProfile, fetchTypeOptions, getPropertyDescriptions } from "./utils/propertyUtils";

import { getProfileNameForMergedProperties } from "./utils/renameUtils";
import { usePropertyHandlers, useConfigHandlers, useProfileUtils, useHandlerContext } from "./hooks";
import { usePanelResizer } from "./hooks/usePanelResizer";
import { useMessageHandler } from "./hooks/useMessageHandler";
import { useUtilityHelpers } from "./hooks/useUtilityHelpers";

import { ConfigProvider, useConfigContext } from "./context/ConfigContext";
import { WizardProvider, useWizardContext } from "./context/WizardContext";

import {
  handleRenameProfile as handleRenameProfileHandler,
  handleDeleteProfile as handleDeleteProfileHandler,
  handleProfileSelection as handleProfileSelectionHandler,
  handleNavigateToSource as handleNavigateToSourceHandler,
} from "./handlers/profileHandlers";

const vscodeApi = acquireVsCodeApi();

export function App() {
  return (
    <ConfigProvider vscodeApi={vscodeApi}>
      <WizardProvider vscodeApi={vscodeApi}>
        <AppContent />
      </WizardProvider>
    </ConfigProvider>
  );
}

function AppContent() {
  const {
    configurations,
    setConfigurations,
    selectedTab,
    setSelectedTab,
    setFlattenedConfig,
    setFlattenedDefaults,
    pendingChanges,
    setPendingChanges,
    deletions,
    setDeletions,
    setPendingDefaults,
    setDefaultsDeletions,
    renames,
    setRenames,
    schemaValidations,
    setSchemaValidations,
    selectedProfileKey,
    setSelectedProfileKey,
    selectedProfilesByConfig,
    setSelectedProfilesByConfig,
    setMergedProperties,
    configEditorSettings,
    setConfigEditorSettings,
    setPendingMergedPropertiesRequest,
    sortOrderVersion,
    setSortOrderVersion,
    isSaving,
    setIsSaving,
    pendingSaveSelection,
    setPendingSaveSelection,
    isNavigating,
    setProfileSearchTerm,
    profileFilterType,
    setProfileFilterType,
    hasWorkspace,
    setHasWorkspace,
    secureValuesAllowed,
    setSecureValuesAllowed,
    hasPromptedForZeroConfigs,
    setHasPromptedForZeroConfigs,
    configurationsRef,
    selectedProfileKeyRef,
    mergedPropertiesLatestRequestSeqRef,
    setLocalStorageValue,
    setViewModeWithStorage,
    profileMenuOpen,
    setProfileMenuOpen,
    renameProfileModalOpen,
    setRenameProfileModalOpen,
    configParseErrors,
    setConfigParseErrors,
  } = useConfigContext();

  const { viewMode, profilesWidthPercent } = configEditorSettings;

  const utilityHelpers = useUtilityHelpers();
  const handlerContext = useHandlerContext(vscodeApi);

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

  const prevMergedFetchSelectionRef = useRef<{ profileKey: string | null; tab: number | null }>({
    profileKey: null,
    tab: null,
  });

  const [pendingPropertyDeletion, setPendingPropertyDeletion] = useState<string | null>(null);
  const [pendingProfileDeletion, setPendingProfileDeletion] = useState<string | null>(null);

  const { handleChange, handleDefaultsChange, handleDeleteProperty, confirmDeleteProperty, handleUnlinkMergedProperty, handleAddNewProfileKey } =
    usePropertyHandlers({
      setPendingPropertyDeletion,
      setNewProfileKey,
      setNewProfileValue,
      setNewProfileKeyPath,
      setNewProfileModalOpen,
      setFocusValueInput,
      newProfileKey,
      newProfileValue,
      newProfileKeyPath,
      isSecure,
      setIsSecure,
    });

  const { handleSave, handleRefresh, handleTabChange, handleAutostoreToggle } = useConfigHandlers({
    setPendingProfileDeletion,
    setPendingPropertyDeletion,
  });

  const { formatPendingChanges, hasPendingChanges } = useProfileUtils();
  const { setWizardModalOpen, wizardModalOpen, setWizardProfileNameValidation } = useWizardContext();

  useEffect(() => {
    if (selectedTab !== null && configurations[selectedTab]) {
      const config = configurations[selectedTab].properties;
      setFlattenedConfig(flattenKeys(config.profiles ?? {}));
      setFlattenedDefaults(flattenKeys(config.defaults ?? {}));
      if (!isSaving && !isNavigating) {
        setMergedProperties(null);
      }
    }
  }, [selectedTab, configurations, isSaving, isNavigating]);

  useEffect(() => {
    if (!selectedProfileKey) {
      mergedPropertiesLatestRequestSeqRef.current += 1;
      setMergedProperties(null);
      prevMergedFetchSelectionRef.current = { profileKey: null, tab: selectedTab };
      return;
    }

    const configPath = configurations[selectedTab!]?.configPath;
    if (!configPath) {
      return;
    }

    const selectionChanged =
      prevMergedFetchSelectionRef.current.profileKey !== selectedProfileKey || prevMergedFetchSelectionRef.current.tab !== selectedTab;
    prevMergedFetchSelectionRef.current = { profileKey: selectedProfileKey, tab: selectedTab };

    if (selectionChanged && !isSaving && !isNavigating) {
      setMergedProperties(null);
    }

    mergedPropertiesLatestRequestSeqRef.current += 1;
    const seq = mergedPropertiesLatestRequestSeqRef.current;
    const profileNameForMergedProperties = getProfileNameForMergedProperties(selectedProfileKey, configPath, renames);
    const changes = formatPendingChanges();
    vscodeApi.postMessage({
      command: "GET_MERGED_PROPERTIES",
      profilePath: profileNameForMergedProperties,
      configPath: configPath,
      changes: changes,
      renames: changes.renames,
      mergedPropertiesRequestSeq: seq,
    });
  }, [
    selectedProfileKey,
    selectedTab,
    formatPendingChanges,
    renames,
    sortOrderVersion,
    isSaving,
    isNavigating,
    configurations,
    vscodeApi,
    setMergedProperties,
  ]);

  useEffect(() => {
    const isModalOpen =
      newProfileModalOpen || saveModalOpen || newLayerModalOpen || wizardModalOpen || renameProfileModalOpen || configParseErrors.length > 0;
    document.body.classList.toggle("modal-open", isModalOpen);
  }, [newProfileModalOpen, saveModalOpen, newLayerModalOpen, wizardModalOpen, renameProfileModalOpen, configParseErrors.length]);

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

  const handleSetAsDefault = (profileKey: string) => {
    // Cancel any pending profile deletion when user sets profile as default
    setPendingProfileDeletion(null);
    // Cancel any pending property deletion when user sets profile as default
    setPendingPropertyDeletion(null);
    const profileType = getProfileType({ profileKey, selectedTab, configurations, pendingChanges, renames });
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

  const handleOpenRawJson = (configPath: string) => {
    vscodeApi.postMessage({ command: "OPEN_CONFIG_FILE", filePath: configPath });
  };

  const handleRevealInFinder = (configPath: string) => {
    vscodeApi.postMessage({ command: "REVEAL_IN_FINDER", filePath: configPath });
  };

  const handleOpenSchemaFile = (schemaPath: string) => {
    vscodeApi.postMessage({ command: "OPEN_SCHEMA_FILE", filePath: schemaPath });
  };

  const handleRenameProfile = useCallback(
    (originalKey: string, newKey: string, isDragDrop: boolean = false): boolean => {
      return handleRenameProfileHandler(originalKey, newKey, isDragDrop, handlerContext);
    },
    [handlerContext]
  );

  const confirmDeleteProfile = useCallback(
    (profileKey: string): void => {
      handleDeleteProfileHandler(profileKey, handlerContext);
      setPendingProfileDeletion(null);
    },
    [handlerContext]
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
      return handleProfileSelectionHandler(profileKey, handlerContext);
    },
    [handlerContext]
  );

  const handleNavigateToSource = useCallback(
    (jsonLoc: string, osLoc?: string[]): void => {
      const navigateHandler = handleNavigateToSourceHandler(handlerContext);
      navigateHandler(jsonLoc, osLoc);
    },
    [handlerContext]
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
                .map((key) => getProfileType({ profileKey: key, selectedTab, configurations, pendingChanges, renames }))
                .filter((type): type is string => type !== null && type.trim() !== "")
            )
          );

          if (!availableTypes.includes(profileFilterType)) {
            setProfileFilterType(null);
          }
        }
      }
    }
  }, [selectedTab, configurations, profileFilterType, deletions, pendingChanges]);

  const openAddProfileModalAtPath = (path: string[], key?: string, value?: string) => {
    // Cancel any pending property deletion when user opens add property modal
    setPendingPropertyDeletion(null);
    setNewProfileKeyPath(path);
    setNewProfileKey(key || "");
    setNewProfileValue(value || "");
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
    setWizardProfileNameValidation,
    setRenames,
    setConfigParseErrors,
    configurationsRef,
    mergedPropertiesLatestRequestSeqRef,
    pendingSaveSelection,
    selectedTab,
    selectedProfilesByConfig,
    hasPromptedForZeroConfigs,
    handleRefresh,
    handleSave,
    handleChange,
    vscodeApi,
    selectedProfileKeyRef,
  });

  return (
    <div className="app-container" data-testid="config-editor-app" data-config-count={configurations.length} data-selected-tab={selectedTab}>
      <Tabs
        onTabChange={handleTabChange}
        onOpenRawFile={handleOpenRawJson}
        onRevealInFinder={handleRevealInFinder}
        onOpenSchemaFile={handleOpenSchemaFile}
        onAddNewConfig={handleAddNewConfig}
        onToggleAutostore={handleAutostoreToggle}
      />
      <Panels
        renderProfiles={(profilesObj) => (
          <RenderProfiles
            profilesObj={profilesObj}
            handleProfileSelection={handleProfileSelection}
            handleDeleteProfile={handleDeleteProfile}
            handleSetAsDefault={handleSetAsDefault}
            handleRenameProfile={handleRenameProfile}
          />
        )}
        renderProfileDetails={() => (
          <RenderProfileDetails
            handleSetAsDefault={handleSetAsDefault}
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
            openAddProfileModalAtPath={openAddProfileModalAtPath}
          />
        )}
        renderDefaults={(defaults) => <RenderDefaults defaults={defaults} handleDefaultsChange={handleDefaultsChange} />}
        onProfileWizard={() => setWizardModalOpen(true)}
        onViewModeToggle={() => setViewModeWithStorage(viewMode === "tree" ? "flat" : "tree")}
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

      <ConfigParseErrorsModal errors={configParseErrors} vscodeApi={vscodeApi} />

      <AddProfileModal
        key={`add-profile-${newProfileModalOpen}`}
        isOpen={newProfileModalOpen}
        newProfileKey={newProfileKey}
        newProfileValue={newProfileValue}
        showDropdown={showDropdown}
        typeOptions={
          newProfileKeyPath
            ? fetchTypeOptions({ path: newProfileKeyPath, selectedTab, configurations, schemaValidations, pendingChanges, renames, deletions })
            : []
        }
        propertyDescriptions={
          newProfileKeyPath
            ? getPropertyDescriptions({ path: newProfileKeyPath, selectedTab, configurations, schemaValidations, pendingChanges, renames })
            : {}
        }
        isSecure={isSecure}
        secureValuesAllowed={secureValuesAllowed}
        getPropertyType={(propertyKey: string) =>
          getPropertyTypeForAddProfile({
            propertyKey,
            selectedTab,
            configurations,
            selectedProfileKey,
            schemaValidations,
            pendingChanges,
            renames,
          })
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

      <WizardManager />

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
        existingProfiles={
          selectedTab === null || !selectedProfileKey
            ? []
            : getAllQualifiedProfileKeys(configurations[selectedTab]?.properties?.profiles)
        }
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
          const config = configurations[selectedTab!];
          if (configPath && config && selectedProfileKey) {
            const trueOriginalKey = resolveOriginalProfileKeyFromRenames(
              selectedProfileKey,
              configPath,
              config.properties?.profiles,
              renames
            );
            handleRenameProfile(trueOriginalKey, newName);
          }
        }}
        onCancel={() => setRenameProfileModalOpen(false)}
      />
    </div>
  );
}
