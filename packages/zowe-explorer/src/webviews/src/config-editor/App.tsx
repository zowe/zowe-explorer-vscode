import { useState, useCallback, useEffect } from "react";

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
  flattenProfiles,
  getProfileType,
  getRenamedProfileKeyWithNested,
  getPropertyTypeForAddProfile,
  stringifyValueByType,
  fetchTypeOptions,
  getPropertyDescriptions,
} from "./utils";

import { getProfileNameForMergedProperties } from "./utils/renameUtils";
import { useProfileWizard, usePropertyHandlers, useConfigHandlers, useProfileUtils, useHandlerContext } from "./hooks";
import { usePanelResizer } from "./hooks/usePanelResizer";
import { useMessageHandler } from "./hooks/useMessageHandler";
import { useUtilityHelpers } from "./hooks/useUtilityHelpers";

import { ConfigProvider, useConfigContext } from "./context/ConfigContext";

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
      <AppContent />
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
    setLocalStorageValue,
    setViewModeWithStorage,
    profileMenuOpen,
    setProfileMenuOpen,
    renameProfileModalOpen,
    setRenameProfileModalOpen,
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

  // renameProfileModalOpen moved to context
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

  const { formatPendingChanges, getAvailableProfiles, hasPendingChanges } = useProfileUtils();

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
    wizardProfileNameValidation: _wizardProfileNameValidation,
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
    setWizardProfileNameValidation,
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

  useEffect(() => {
    if (selectedTab !== null && configurations[selectedTab]) {
      const config = configurations[selectedTab].properties;
      setFlattenedConfig(flattenProfiles(config.profiles));
      setFlattenedDefaults(flattenProfiles(config.defaults));
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
    configurationsRef,
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
            propertyDescriptions={getWizardPropertyDescriptions()}
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
