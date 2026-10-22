import { AddProfileModal } from "./modals/AddProfileModal";
import { SaveModal } from "./modals/SaveModal";
import { NewLayerModal } from "./modals/NewLayerModal";
import { AddConfigModal } from "./modals/AddConfigModal";
import { ConfigParseErrorsModal } from "./modals/ConfigParseErrorsModal";
import { RenameProfileModal } from "./modals/RenameProfileModal";
import { useEditorFields } from "../context/EditorStoreContext";
import { useUtilityHelpers } from "../hooks/useUtilityHelpers";
import { getPropertyTypeForAddProfile, fetchTypeOptions, getPropertyDescriptions } from "../utils/propertyUtils";
import { getAllQualifiedProfileKeys } from "../utils";

export function EditorDialogs() {
  const {
    configurations,
    selectedTab,
    pendingChanges,
    deletions,
    renames,
    schemaValidations,
    selectedProfileKey,
    secureValuesAllowed,
    configParseErrors,
    vscodeApi,
    newProfileKeyPath,
    newProfileKey,
    setNewProfileKey,
    newProfileValue,
    setNewProfileValue,
    newProfileModalOpen,
    setNewProfileModalOpen,
    focusValueInput,
    setFocusValueInput,
    saveModalOpen,
    newLayerModalOpen,
    setNewLayerModalOpen,
    newLayerName,
    setNewLayerName,
    isSecure,
    setIsSecure,
    showDropdown,
    setShowDropdown,
    addConfigModalOpen,
    hasWorkspace,
    renameProfileModalOpen,
    setRenameProfileModalOpen,
    handleAddNewProfileKey,
    handleAddNewLayer,
    handleAddConfig,
    handleCancelAddConfig,
    handleRenameProfile,
  } = useEditorFields(
    "configurations",
    "selectedTab",
    "pendingChanges",
    "deletions",
    "renames",
    "schemaValidations",
    "selectedProfileKey",
    "secureValuesAllowed",
    "configParseErrors",
    "vscodeApi",
    "newProfileKeyPath",
    "newProfileKey",
    "setNewProfileKey",
    "newProfileValue",
    "setNewProfileValue",
    "newProfileModalOpen",
    "setNewProfileModalOpen",
    "focusValueInput",
    "setFocusValueInput",
    "saveModalOpen",
    "newLayerModalOpen",
    "setNewLayerModalOpen",
    "newLayerName",
    "setNewLayerName",
    "isSecure",
    "setIsSecure",
    "showDropdown",
    "setShowDropdown",
    "addConfigModalOpen",
    "hasWorkspace",
    "renameProfileModalOpen",
    "setRenameProfileModalOpen",
    "handleAddNewProfileKey",
    "handleAddNewLayer",
    "handleAddConfig",
    "handleCancelAddConfig",
    "handleRenameProfile"
  );
  const utilityHelpers = useUtilityHelpers();
  return (
    <>
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

      <AddConfigModal
        key={`add-config-${addConfigModalOpen}`}
        isOpen={addConfigModalOpen}
        configurations={configurations}
        hasWorkspace={hasWorkspace}
        onAdd={handleAddConfig}
        onCancel={handleCancelAddConfig}
      />

      <RenameProfileModal
        key={`rename-profile-${renameProfileModalOpen}-${selectedProfileKey}`}
        isOpen={renameProfileModalOpen}
        currentProfileName={selectedProfileKey ? selectedProfileKey.split(".").pop() || selectedProfileKey : ""}
        currentProfileKey={selectedProfileKey || ""}
        existingProfiles={
          selectedTab === null || !selectedProfileKey ? [] : getAllQualifiedProfileKeys(configurations[selectedTab]?.properties?.profiles)
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
            handleRenameProfile(selectedProfileKey, newName);
          }
        }}
        onCancel={() => setRenameProfileModalOpen(false)}
      />
    </>
  );
}
