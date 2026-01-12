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
import { parseValueByType, flattenProfiles } from "../utils";
import { isProfileNameTaken as checkProfileNameTaken } from "../utils/wizardValidation";
import {
    getWizardTypeOptions as getTypeOptions,
    getWizardPropertyOptions as getPropertyOptions,
    getWizardPropertyDescriptions as getPropertyDescriptions,
    getPropertyType as getSchemaPropertyType,
} from "../utils/schemaUtils";
import { useWizardState } from "./useWizardState";

interface UseProfileWizardProps {
    selectedTab: number | null;
    configurations: { configPath: string; properties: any; secure: string[]; global?: boolean; user?: boolean }[];
    schemaValidations: { [configPath: string]: any };
    pendingChanges: {
        [configPath: string]: {
            [key: string]: {
                value: string | number | boolean | Record<string, any>;
                path: string[];
                profile: string;
                secure?: boolean;
            };
        };
    };
    setPendingChanges: React.Dispatch<
        React.SetStateAction<{
            [configPath: string]: {
                [key: string]: {
                    value: string | number | boolean | Record<string, any>;
                    path: string[];
                    profile: string;
                    secure?: boolean;
                };
            };
        }>
    >;
    setSelectedProfileKey: (key: string | null) => void;
    vscodeApi: any;
    formatPendingChanges: () => any;
    getAvailableProfiles: () => string[];
    secureValuesAllowed: boolean;
    renames: { [configPath: string]: { [originalKey: string]: string } };
}

export function useProfileWizard({
    selectedTab,
    configurations,
    schemaValidations,
    pendingChanges,
    setPendingChanges,
    setSelectedProfileKey,
    vscodeApi,
    formatPendingChanges,
    secureValuesAllowed,
    renames,
}: UseProfileWizardProps) {
    // Profile Wizard state - delegated to useWizardState hook
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
        wizardPopulatedDefaults,
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
    } = useWizardState();

    // Helper functions - now using extracted utilities
    const getWizardTypeOptions = () => getTypeOptions(selectedTab, configurations, schemaValidations, pendingChanges);
    const getWizardPropertyOptions = () => getPropertyOptions(selectedTab, configurations, schemaValidations, wizardSelectedType, wizardProperties);
    const getWizardPropertyDescriptions = () => getPropertyDescriptions(selectedTab, configurations, schemaValidations, wizardSelectedType);
    const getPropertyType = (propertyKey: string) =>
        getSchemaPropertyType(propertyKey, selectedTab, configurations, schemaValidations, wizardSelectedType);

    const isProfileNameTaken = () => {
        if (!wizardProfileName.trim() || selectedTab === null) return false;
        const configPath = configurations[selectedTab].configPath;
        const config = configurations[selectedTab].properties;
        return checkProfileNameTaken(wizardProfileName, wizardRootProfile, configPath, config.profiles, pendingChanges, renames);
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

        // Get all existing profile names under the selected root
        const existingProfilesUnderRoot = Object.keys(flatProfiles).filter((profileKey) => {
            if (wizardRootProfile === "root") {
                return profileKey === wizardProfileName.trim();
            } else {
                return (
                    profileKey === `${wizardRootProfile}.${wizardProfileName.trim()}` ||
                    profileKey.startsWith(`${wizardRootProfile}.${wizardProfileName.trim()}.`)
                );
            }
        });

        // check pending changes for profiles being created
        const pendingProfilesUnderRoot = Object.entries(pendingChanges[configPath] || {}).some(([_, entry]) => {
            if (entry.profile) {
                if (wizardRootProfile === "root") {
                    return entry.profile === wizardProfileName.trim();
                } else {
                    return (
                        entry.profile === `${wizardRootProfile}.${wizardProfileName.trim()}` ||
                        entry.profile.startsWith(`${wizardRootProfile}.${wizardProfileName.trim()}.`)
                    );
                }
            }
            return false;
        });

        if (existingProfilesUnderRoot.length > 0 || pendingProfilesUnderRoot) {
            // Profile already exists don't create it
            return;
        }

        // Create the profile path
        let profilePath: string[];
        let newProfileKey: string;
        if (wizardRootProfile === "root") {
            profilePath = ["profiles", wizardProfileName];
            newProfileKey = wizardProfileName;
        } else {
            // build the path to the selected profile
            const profileParts = wizardRootProfile.split(".");
            profilePath = ["profiles"];

            for (let i = 0; i < profileParts.length; i++) {
                profilePath.push(profileParts[i]);
                // Add "profiles" between each level
                if (i < profileParts.length - 1) {
                    profilePath.push("profiles");
                }
            }

            // Add "profiles" after the selected profile, then the new profile name
            profilePath.push("profiles", wizardProfileName);
            newProfileKey = `${wizardRootProfile}.${wizardProfileName}`;
        }

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
            wizardProperties.push({ key: "", value: {} });
        }
        wizardProperties.forEach((prop) => {
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

        // Reset wizard state
        setWizardModalOpen(false);
        setWizardRootProfile("root");
        setWizardSelectedType("");
        setWizardProfileName("");
        setWizardProperties([]);
        setWizardNewPropertyKey("");
        setWizardNewPropertyValue("");
        setWizardNewPropertySecure(false);
        setWizardShowKeyDropdown(false);
        setWizardPopulatedDefaults(new Set());
    };

    const handleWizardCancel = () => {
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
    };

    const requestWizardMergedProperties = () => {
        if (selectedTab !== null) {
            const configPath = configurations[selectedTab].configPath;
            const changes = formatPendingChanges();
            vscodeApi.postMessage({
                command: "GET_WIZARD_MERGED_PROPERTIES",
                rootProfile: wizardRootProfile,
                profileType: wizardSelectedType,
                configPath: configPath,
                profileName: wizardProfileName,
                changes: changes,
                renames: changes.renames,
            });
        }
    };

    const handleWizardPopulateDefaults = () => {
        if (!wizardSelectedType || selectedTab === null) return;

        const configPath = configurations[selectedTab].configPath;
        const propertySchema = schemaValidations[configPath]?.propertySchema[wizardSelectedType] || {};

        const existingKeys = new Set(wizardProperties.map((prop) => prop.key));

        const newProperties: { key: string; value: string | boolean | number | Object; secure?: boolean }[] = [];
        const populatedKeys = new Set<string>();

        Object.entries(propertySchema).forEach(([key, schema]: [string, any]) => {
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
                        value: schema.default,
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

    // Clear populated defaults when type changes
    useEffect(() => {
        if (wizardSelectedType && wizardPopulatedDefaults.size > 0) {
            // Clear properties that were populated from defaults (not merged properties)
            setWizardProperties((prev) => {
                const mergedKeys = new Set(Object.keys(wizardMergedProperties));
                return prev.filter((prop) => mergedKeys.has(prop.key) || !wizardPopulatedDefaults.has(prop.key));
            });
            setWizardPopulatedDefaults(new Set());
        }
    }, [wizardSelectedType]);

    // Trigger wizard merged properties request when root profile, type, or pending changes change
    useEffect(() => {
        if (wizardModalOpen && selectedTab !== null && (wizardRootProfile || wizardSelectedType)) {
            requestWizardMergedProperties();
        }
    }, [wizardRootProfile, wizardSelectedType, wizardModalOpen, selectedTab, pendingChanges]);

    return {
        // State
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

        // Setters
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

        // Functions
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
    };
}
