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

import { useState, useEffect } from "react";
import { parseValueByType } from "../utils";
import { flattenProfiles } from "../utils";

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
}: UseProfileWizardProps) {
    // Profile Wizard state
    const [wizardModalOpen, setWizardModalOpen] = useState(false);
    const [wizardRootProfile, setWizardRootProfile] = useState("root");
    const [wizardSelectedType, setWizardSelectedType] = useState("");
    const [wizardProfileName, setWizardProfileName] = useState("");
    const [wizardProperties, setWizardProperties] = useState<{ key: string; value: string | boolean | number | Object; secure?: boolean }[]>([]);
    const [wizardShowKeyDropdown, setWizardShowKeyDropdown] = useState(false);
    const [wizardNewPropertyKey, setWizardNewPropertyKey] = useState("");
    const [wizardNewPropertyValue, setWizardNewPropertyValue] = useState("");
    const [wizardNewPropertySecure, setWizardNewPropertySecure] = useState(false);
    const [wizardMergedProperties, setWizardMergedProperties] = useState<{ [key: string]: any }>({});
    const [wizardPopulatedDefaults, setWizardPopulatedDefaults] = useState<Set<string>>(new Set());

    // Helper functions
    const getWizardTypeOptions = () => {
        if (selectedTab === null) return [];
        return schemaValidations[configurations[selectedTab].configPath]?.validDefaults || [];
    };

    const getWizardPropertyOptions = () => {
        if (selectedTab === null) return [];
        if (!wizardSelectedType) return [];
        const allOptions = schemaValidations[configurations[selectedTab].configPath]?.propertySchema[wizardSelectedType] || {};
        // Filter out properties that are already added
        const usedKeys = new Set(wizardProperties.map((prop) => prop.key));
        return Object.keys(allOptions)
            .filter((option) => !usedKeys.has(option))
            .sort((a, b) => a.localeCompare(b));
    };

    const getPropertyType = (propertyKey: string): string | undefined => {
        if (selectedTab === null) return undefined;
        if (!wizardSelectedType) return undefined;
        const propertySchema = schemaValidations[configurations[selectedTab].configPath]?.propertySchema[wizardSelectedType] || {};
        return propertySchema[propertyKey]?.type;
    };

    const isProfileNameTaken = () => {
        if (!wizardProfileName.trim() || selectedTab === null) return false;

        const config = configurations[selectedTab].properties;
        const flatProfiles = flattenProfiles(config.profiles);

        // Check existing profiles
        const existingProfilesUnderRoot = Object.keys(flatProfiles).some((profileKey) => {
            if (wizardRootProfile === "root") {
                return profileKey === wizardProfileName.trim();
            } else {
                return (
                    profileKey === `${wizardRootProfile}.${wizardProfileName.trim()}` ||
                    profileKey.startsWith(`${wizardRootProfile}.${wizardProfileName.trim()}.`)
                );
            }
        });

        // Check pending changes
        const pendingProfilesUnderRoot = Object.entries(pendingChanges[configurations[selectedTab].configPath] || {}).some(([_, entry]) => {
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

        return existingProfilesUnderRoot || pendingProfilesUnderRoot;
    };

    const handleWizardAddProperty = () => {
        if (!wizardNewPropertyKey.trim() || !wizardNewPropertyValue.trim()) return;

        // Check if the key already exists
        const keyExists = wizardProperties.some((prop) => prop.key === wizardNewPropertyKey.trim());
        if (keyExists) {
            return; // Don't add duplicate keys
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
                // For root, check if the profile name exists as a top-level profile
                return profileKey === wizardProfileName.trim();
            } else {
                // For nested profiles, check if the profile exists under the selected root
                return (
                    profileKey === `${wizardRootProfile}.${wizardProfileName.trim()}` ||
                    profileKey.startsWith(`${wizardRootProfile}.${wizardProfileName.trim()}.`)
                );
            }
        });

        // Also check pending changes for profiles being created
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
            // Profile already exists, don't create it
            return;
        }

        // Create the profile path
        let profilePath: string[];
        let newProfileKey: string;
        if (wizardRootProfile === "root") {
            profilePath = ["profiles", wizardProfileName];
            newProfileKey = wizardProfileName;
        } else {
            // For nested profiles, we need to build the path to the selected profile
            // and then add "profiles" and the new profile name
            const profileParts = wizardRootProfile.split(".");
            profilePath = ["profiles"];

            // Build the path to the selected profile
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

        // Add properties

        // If no properties/type are set, set an empty properties object on the profile
        if (wizardProperties.length === 0 && !wizardSelectedType) {
            wizardProperties.push({ key: "", value: {} });
        }
        wizardProperties.forEach((prop) => {
            // Always use properties path, but set secure flag if needed
            const propertyPath = [...profilePath, "properties"];

            // Logic for setting empty properties
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

        // Automatically select the newly created profile
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
            });
        }
    };

    const handleWizardPopulateDefaults = () => {
        if (!wizardSelectedType || selectedTab === null) return;

        const configPath = configurations[selectedTab].configPath;
        const propertySchema = schemaValidations[configPath]?.propertySchema[wizardSelectedType] || {};

        // Get existing property keys to avoid duplicates
        const existingKeys = new Set(wizardProperties.map((prop) => prop.key));

        // Get merged property keys and values to check for existing values
        const mergedKeys = new Set(Object.keys(wizardMergedProperties));

        // Create new properties from schema defaults
        const newProperties: { key: string; value: string | boolean | number | Object; secure?: boolean }[] = [];
        const populatedKeys = new Set<string>();

        Object.entries(propertySchema).forEach(([key, schema]: [string, any]) => {
            // Skip if property already exists in wizard properties
            if (existingKeys.has(key)) {
                return;
            }

            // Check if property has a default value in schema
            if (schema.default !== undefined) {
                // For port, always override merged values unless they're the same
                if (key === "port") {
                    const mergedValue = wizardMergedProperties[key]?.value;
                    if (mergedValue !== schema.default) {
                        newProperties.push({
                            key,
                            value: schema.default,
                            secure: false,
                        });
                        populatedKeys.add(key);
                    }
                    return;
                }

                // For other properties, only add if not in merged properties
                if (!mergedKeys.has(key)) {
                    newProperties.push({
                        key,
                        value: schema.default,
                        secure: false,
                    });
                    populatedKeys.add(key);
                }
            }
        });

        // Add new properties to wizard properties
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
