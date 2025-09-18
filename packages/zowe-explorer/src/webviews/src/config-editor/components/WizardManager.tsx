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

import { useEffect } from "react";
import { ProfileWizardModal } from "./modals/ProfileWizardModal";

// Types


// Props interface for the WizardManager component
interface WizardManagerProps {
  // Wizard state and handlers from useProfileWizard hook
  wizardModalOpen: boolean;
  wizardRootProfile: string;
  wizardSelectedType: string;
  wizardProfileName: string;
  wizardProperties: { key: string; value: string | boolean | number | Object; secure?: boolean }[];
  wizardShowKeyDropdown: boolean;
  wizardNewPropertyKey: string;
  wizardNewPropertyValue: string;
  wizardNewPropertySecure: boolean;
  wizardMergedProperties: { [key: string]: any };
  setWizardRootProfile: (profile: string) => void;
  setWizardSelectedType: (type: string) => void;
  setWizardProfileName: (name: string) => void;
  setWizardShowKeyDropdown: (show: boolean) => void;
  setWizardNewPropertyKey: (key: string) => void;
  setWizardNewPropertyValue: (value: string) => void;
  setWizardNewPropertySecure: (secure: boolean) => void;

  // Wizard functions from useProfileWizard hook
  getWizardTypeOptions: () => string[];
  getWizardPropertyOptions: () => string[];
  getPropertyType: (propertyKey: string) => string | undefined;
  isProfileNameTaken: () => boolean;
  handleWizardAddProperty: () => void;
  handleWizardRemoveProperty: (index: number) => void;
  handleWizardPropertyValueChange: (index: number, newValue: string) => void;
  handleWizardPropertySecureToggle: (index: number) => void;
  handleWizardCreateProfile: () => void;
  handleWizardCancel: () => void;
  requestWizardMergedProperties: () => void;
  handleWizardPopulateDefaults: () => void;

  // Additional props needed for wizard functionality
  selectedTab: number | null;
  secureValuesAllowed: boolean;
  vscodeApi: any;
  getAvailableProfiles: () => string[];
  canPropertyBeSecure: (displayKey: string, path: string[]) => boolean;
  canPropertyBeSecureForWizard: (displayKey: string, profileType: string) => boolean;
  stringifyValueByType: (value: any, type?: string) => string;

  // Event handlers for wizard-related messages
  onWizardMergedProperties: (data: any) => void;
  onFileSelected: (data: any) => void;
}

export const WizardManager = ({
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
  setWizardRootProfile,
  setWizardSelectedType,
  setWizardProfileName,
  setWizardShowKeyDropdown,
  setWizardNewPropertyKey,
  setWizardNewPropertyValue,
  setWizardNewPropertySecure,
  getWizardTypeOptions,
  getWizardPropertyOptions,
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
  selectedTab,
  secureValuesAllowed,
  vscodeApi,
  getAvailableProfiles,
  canPropertyBeSecure,
  canPropertyBeSecureForWizard,
  stringifyValueByType,
  onWizardMergedProperties,
  onFileSelected,
}: WizardManagerProps) => {
  // Trigger wizard merged properties request when root profile, type, or pending changes change
  useEffect(() => {
    if (wizardModalOpen && selectedTab !== null && (wizardRootProfile || wizardSelectedType)) {
      // Debounce the request to prevent excessive calls
      const timeoutId = setTimeout(() => {
        requestWizardMergedProperties();
      }, 1000); // 1 second delay

      return () => clearTimeout(timeoutId);
    }
  }, [wizardRootProfile, wizardSelectedType, wizardModalOpen, selectedTab, requestWizardMergedProperties]);

  // Handle wizard-related messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.command === "WIZARD_MERGED_PROPERTIES") {
        onWizardMergedProperties(event.data);
      } else if (event.data.command === "FILE_SELECTED") {
        onFileSelected(event.data);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onWizardMergedProperties, onFileSelected]);

  return (
    <ProfileWizardModal
      key={`wizard-${wizardModalOpen}`}
      isOpen={wizardModalOpen}
      wizardRootProfile={wizardRootProfile}
      wizardSelectedType={wizardSelectedType}
      wizardProfileName={wizardProfileName}
      wizardProperties={wizardProperties}
      wizardShowKeyDropdown={wizardShowKeyDropdown}
      wizardNewPropertyKey={wizardNewPropertyKey}
      wizardNewPropertyValue={wizardNewPropertyValue}
      wizardNewPropertySecure={wizardNewPropertySecure}
      wizardMergedProperties={wizardMergedProperties}
      availableProfiles={getAvailableProfiles()}
      typeOptions={getWizardTypeOptions()}
      propertyOptions={getWizardPropertyOptions()}
      isProfileNameTaken={isProfileNameTaken()}
      secureValuesAllowed={secureValuesAllowed}
      onRootProfileChange={setWizardRootProfile}
      onSelectedTypeChange={setWizardSelectedType}
      onProfileNameChange={setWizardProfileName}
      onNewPropertyKeyChange={setWizardNewPropertyKey}
      onNewPropertyValueChange={setWizardNewPropertyValue}
      onNewPropertySecureToggle={() => {
        if (secureValuesAllowed) {
          setWizardNewPropertySecure(!wizardNewPropertySecure);
        }
      }}
      onShowKeyDropdownChange={setWizardShowKeyDropdown}
      onAddProperty={handleWizardAddProperty}
      onRemoveProperty={handleWizardRemoveProperty}
      onPropertyValueChange={handleWizardPropertyValueChange}
      onPropertySecureToggle={handleWizardPropertySecureToggle}
      onCreateProfile={handleWizardCreateProfile}
      onCancel={handleWizardCancel}
      onPopulateDefaults={handleWizardPopulateDefaults}
      getPropertyType={getPropertyType}
      canPropertyBeSecure={canPropertyBeSecure}
      canPropertyBeSecureForWizard={canPropertyBeSecureForWizard}
      stringifyValueByType={stringifyValueByType}
      vscodeApi={vscodeApi}
    />
  );
};
