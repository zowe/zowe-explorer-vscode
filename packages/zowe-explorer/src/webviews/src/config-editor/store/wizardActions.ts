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

import { profileKeyToPath } from "../utils/configUtils";
import { parseValueByType, flattenProfiles } from "../utils";
import {
    getWizardTypeOptions as getTypeOptions,
    getWizardPropertyOptions as getPropertyOptions,
    getWizardPropertyDescriptions as getPropertyDescriptions,
    getPropertyType as getSchemaPropertyType,
} from "../utils/schemaUtils";
import type { ProfileSchemaEntry } from "../types";
import type { EditorRuntime, WizardState } from "./types";
import { createProfileUtils } from "./profileUtils";

export function createWizardActions(state: EditorRuntime) {
    const {
        selectedTab,
        configurations,
        schemaValidations,
        pendingChanges,
        setPendingChanges,
        setSelectedProfileKey,
        vscodeApi,
        secureValuesAllowed,
        renames,
    } = state;
    const { formatPendingChanges } = createProfileUtils(state);
    const {
        wizardRootProfile,
        wizardSelectedType,
        wizardProfileName,
        wizardProperties,
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
        setWizardPopulatedDefaults,
        setWizardProfileNameValidation,
    } = state;

    const getWizardTypeOptions = () => getTypeOptions({ selectedTab, configurations, schemaValidations, pendingChanges });
    const getWizardPropertyOptions = () =>
        getPropertyOptions({ selectedTab, configurations, schemaValidations, wizardSelectedType, wizardProperties });
    const getWizardPropertyDescriptions = () => getPropertyDescriptions({ selectedTab, configurations, schemaValidations, wizardSelectedType });
    const getPropertyType = (propertyKey: string) =>
        getSchemaPropertyType({ propertyKey, selectedTab, configurations, schemaValidations, wizardSelectedType });

    const validateProfileNameWithServer = () => {
        if (!wizardProfileName.trim() || selectedTab === null) {
            setWizardProfileNameValidation({ isValid: true });
            return;
        }

        const configPath = configurations[selectedTab].configPath;
        const config = configurations[selectedTab].properties;

        const requestSeq = state.validationRequestSeq + 1;
        state.setValidationRequestSeq(requestSeq);
        vscodeApi.postMessage({
            command: "VALIDATE_PROFILE_NAME",
            profileName: wizardProfileName,
            rootProfile: wizardRootProfile,
            configPath: configPath,
            profiles: config.profiles,
            pendingChanges: pendingChanges,
            renames: renames,
            requestSeq,
        });
    };

    const handleWizardAddProperty = () => {
        if (!wizardNewPropertyKey.trim()) return;

        const keyExists = wizardProperties.some((prop) => prop.key === wizardNewPropertyKey.trim());
        if (keyExists) {
            return;
        }

        const propertyType = getPropertyType(wizardNewPropertyKey.trim());
        const parsedValue = parseValueByType(wizardNewPropertyValue, propertyType);

        setWizardProperties((prev) => [
            ...prev,
            {
                key: wizardNewPropertyKey,
                value: parsedValue,
                secure: wizardNewPropertySecure,
            },
        ]);
        setWizardNewPropertyKey("");
        setWizardNewPropertyValue("");
        setWizardNewPropertySecure(false);
        setWizardShowKeyDropdown(false);
    };

    const handleWizardRemoveProperty = (index: number) => {
        setWizardProperties((prev) => prev.filter((_, i) => i !== index));
    };

    const handleWizardPropertyValueChange = (index: number, newValue: string) => {
        setWizardProperties((prev) => {
            const updated = [...prev];
            const propertyType = getPropertyType(updated[index].key);
            updated[index] = {
                ...updated[index],
                value: parseValueByType(newValue, propertyType),
            };
            return updated;
        });
    };

    const handleWizardPropertySecureToggle = (index: number) => {
        if (!secureValuesAllowed) {
            return;
        }

        setWizardProperties((prev) => {
            const updated = [...prev];
            updated[index] = {
                ...updated[index],
                secure: !updated[index].secure,
            };
            return updated;
        });
    };

    const handleWizardCreateProfile = () => {
        if (!wizardProfileName.trim()) return;

        const configPath = configurations[selectedTab!]!.configPath;

        // Check if profile already exists under the selected root
        const config = configurations[selectedTab!].properties;
        const flatProfiles = flattenProfiles(config.profiles);

        const newProfileKeyLower = (
            wizardRootProfile === "root" ? wizardProfileName.trim() : `${wizardRootProfile}.${wizardProfileName.trim()}`
        ).toLowerCase();

        // Get all existing profile names under the selected root
        const existingProfilesUnderRoot = Object.keys(flatProfiles).filter((profileKey) => {
            const profileKeyLower = profileKey.toLowerCase();
            return profileKeyLower === newProfileKeyLower || profileKeyLower.startsWith(`${newProfileKeyLower}.`);
        });

        // check pending changes for profiles being created
        const pendingProfilesUnderRoot = Object.entries(pendingChanges[configPath] || {}).some(([_, entry]) => {
            if (entry.profile) {
                const entryProfileLower = entry.profile.toLowerCase();
                return entryProfileLower === newProfileKeyLower || entryProfileLower.startsWith(`${newProfileKeyLower}.`);
            }
            return false;
        });

        if (existingProfilesUnderRoot.length > 0 || pendingProfilesUnderRoot) {
            // Profile already exists don't create it
            return;
        }

        const newProfileKey = wizardRootProfile === "root" ? wizardProfileName : `${wizardRootProfile}.${wizardProfileName}`;
        const profilePath = profileKeyToPath(newProfileKey);

        // Add type property only if selected
        if (wizardSelectedType) {
            const typePath = [...profilePath, "type"];
            const typeKey = typePath.join(".");

            setPendingChanges((prev) => ({
                ...prev,
                [configPath]: {
                    ...prev[configPath],
                    [typeKey]: {
                        value: wizardSelectedType,
                        path: typePath.slice(-1),
                        profile: newProfileKey,
                    },
                },
            }));
        }
        if (wizardProperties.length === 0 && !wizardSelectedType) {
            setWizardProperties([{ key: "", value: {} }]);
        }
        const propertiesToCreate: WizardState["wizardProperties"] =
            wizardProperties.length === 0 && !wizardSelectedType ? [{ key: "", value: {} }] : wizardProperties;
        propertiesToCreate.forEach((prop) => {
            const propertyPath = [...profilePath, "properties"];

            if (prop.key !== "") propertyPath.push(prop.key);

            const propertyKey = propertyPath.join(".");

            setPendingChanges((prev) => ({
                ...prev,
                [configPath]: {
                    ...prev[configPath],
                    [propertyKey]: {
                        value: prop.value,
                        path: propertyPath.slice(-1),
                        profile: newProfileKey,
                        secure: prop.secure,
                    },
                },
            }));
        });

        setSelectedProfileKey(newProfileKey);

        handleWizardCancel();
    };

    const handleWizardCancel = () => {
        state.setValidationRequestSeq(state.validationRequestSeq + 1);
        state.setWizardMergedPropertiesRequestSeq(state.wizardMergedPropertiesRequestSeq + 1);
        setWizardModalOpen(false);
        setWizardRootProfile("root");
        setWizardSelectedType("");
        setWizardProfileName("");
        setWizardProperties([]);
        setWizardNewPropertyKey("");
        setWizardNewPropertyValue("");
        setWizardNewPropertySecure(false);
        setWizardShowKeyDropdown(false);
        setWizardMergedProperties({});
        setWizardPopulatedDefaults(new Set());
        setWizardProfileNameValidation({ isValid: true });
    };

    const requestWizardMergedProperties = () => {
        if (selectedTab !== null) {
            const configPath = configurations[selectedTab].configPath;
            const changes = formatPendingChanges();
            const requestSeq = state.wizardMergedPropertiesRequestSeq + 1;
            state.setWizardMergedPropertiesRequestSeq(requestSeq);
            vscodeApi.postMessage({
                command: "GET_WIZARD_MERGED_PROPERTIES",
                rootProfile: wizardRootProfile,
                profileType: wizardSelectedType,
                configPath: configPath,
                profileName: wizardProfileName,
                changes: changes,
                renames: changes.renames,
                requestSeq,
            });
        }
    };

    const handleWizardPopulateDefaults = () => {
        if (!wizardSelectedType || selectedTab === null) return;

        const configPath = configurations[selectedTab].configPath;
        const propertySchema = schemaValidations[configPath]?.propertySchema[wizardSelectedType] || {};

        const existingKeys = new Set(wizardProperties.map((prop) => prop.key));

        const newProperties: WizardState["wizardProperties"] = [];
        const populatedKeys = new Set<string>();

        Object.entries(propertySchema).forEach(([key, schema]: [string, ProfileSchemaEntry]) => {
            if (existingKeys.has(key)) {
                return;
            }

            if (schema.default !== undefined) {
                // Check if we should add the default value
                // We add it if:
                // 1. There is no merged value (inherited)
                // 2. The merged value is different from the default (override inheritance)
                const mergedValue = wizardMergedProperties[key]?.value;
                if (mergedValue !== schema.default) {
                    newProperties.push({
                        key,
                        value: schema.default as string | boolean | number | Record<string, unknown>,
                        secure: false,
                    });
                    populatedKeys.add(key);
                }
            }
        });

        if (newProperties.length > 0) {
            setWizardProperties((prev) => [...prev, ...newProperties]);
            setWizardPopulatedDefaults((prev) => new Set([...prev, ...populatedKeys]));
        }
    };

    return {
        // Functions
        validateProfileNameWithServer,
        getWizardTypeOptions,
        getWizardPropertyOptions,
        getWizardPropertyDescriptions,
        getPropertyType,
        handleWizardAddProperty,
        handleWizardRemoveProperty,
        handleWizardPropertyValueChange,
        handleWizardPropertySecureToggle,
        handleWizardCreateProfile,
        handleWizardCancel,
        requestWizardMergedProperties,
        handleWizardPopulateDefaults,
    };
}
