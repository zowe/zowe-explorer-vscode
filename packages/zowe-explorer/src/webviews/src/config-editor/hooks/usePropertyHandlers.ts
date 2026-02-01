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
import { useUtilityHelpers } from "./useUtilityHelpers";
import { extractProfileKeyFromPath, getRenamedProfileKeyWithNested, getPropertyTypeForAddProfile, parseValueByType, getProfileType } from "../utils";
import { isProfileDefault } from "../utils/profileHelpers";

interface PropertyHandlersParams {
    setPendingPropertyDeletion: (key: string | null) => void;
    setNewProfileKey: (key: string) => void;
    setNewProfileValue: (value: string) => void;
    setNewProfileKeyPath: (path: string[] | null) => void;
    setNewProfileModalOpen: (open: boolean) => void;
    setFocusValueInput: (focus: boolean) => void;
    newProfileKey: string;
    newProfileValue: string;
    newProfileKeyPath: string[] | null;
    isSecure: boolean;
    setIsSecure: (secure: boolean) => void;
}

export function usePropertyHandlers(params: PropertyHandlersParams) {
    const {
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
    } = params;

    const {
        configurations,
        selectedTab,
        selectedProfileKey,
        flattenedConfig,
        flattenedDefaults,
        renames,
        pendingChanges,
        setPendingChanges,
        deletions,
        setDeletions,
        setPendingDefaults,
        defaultsDeletions,
        setDefaultsDeletions,
        setHiddenItems,
        schemaValidations,
        pendingDefaults,
    } = useConfigContext();

    const utilityHelpers = useUtilityHelpers();

    const handleChange = useCallback(
        (key: string, value: string) => {
            // Cancel any pending property deletion when user changes a value
            setPendingPropertyDeletion(null);

            const configPath = configurations[selectedTab!]!.configPath;
            const path = flattenedConfig[key]?.path ?? key.split(".");

            let profileKey = selectedProfileKey || extractProfileKeyFromPath(path);

            if (selectedProfileKey && renames[configPath]) {
                profileKey = getRenamedProfileKeyWithNested(selectedProfileKey, configPath, renames);
            }

            const isProfileLevelType = path[path.length - 1] === "type" && !path.includes("properties");
            if (isProfileLevelType) {
                const oldType = getProfileType(profileKey, selectedTab, configurations, pendingChanges, renames);
                const newType = value?.trim() || null;
                const wasDefaultForOldType =
                    oldType && oldType !== newType && isProfileDefault(profileKey, selectedTab, configurations, pendingChanges, pendingDefaults, renames);

                if (wasDefaultForOldType) {
                    const config = configurations[selectedTab!].properties;
                    const savedDefaults = config?.defaults || {};
                    const currentDefaultForNewType = pendingDefaults[configPath]?.[newType]?.value ?? savedDefaults[newType] ?? "";
                    const shouldSetNew = newType && !currentDefaultForNewType;

                    setPendingDefaults((prev) => {
                        const next = { ...prev[configPath] };
                        next[oldType] = { value: "", path: [oldType] };
                        if (shouldSetNew && newType) {
                            next[newType] = { value: profileKey, path: [newType] };
                        }
                        return { ...prev, [configPath]: next };
                    });
                }
            }

            const displayKey = path[path.length - 1];
            const currentSecure = utilityHelpers.isPropertySecure(key, displayKey, path, undefined);
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
        },
        [
            configurations,
            selectedTab,
            selectedProfileKey,
            flattenedConfig,
            renames,
            deletions,
            pendingChanges,
            pendingDefaults,
            setPendingPropertyDeletion,
            setPendingChanges,
            setDeletions,
            setPendingDefaults,
            utilityHelpers,
        ]
    );

    const handleDefaultsChange = useCallback(
        (key: string, value: string) => {
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
        },
        [configurations, selectedTab, flattenedDefaults, defaultsDeletions, setPendingPropertyDeletion, setPendingDefaults, setDefaultsDeletions]
    );

    const handleDeleteProperty = useCallback(
        (fullKey: string) => {
            // Show inline confirmation by setting the pending deletion key
            setPendingPropertyDeletion(fullKey);
        },
        [setPendingPropertyDeletion]
    );

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
        [selectedTab, configurations, setHiddenItems, setPendingChanges, setDeletions, setPendingPropertyDeletion]
    );

    const handleUnlinkMergedProperty = useCallback(
        (propertyKey: string | undefined, fullKey: string) => {
            if (!propertyKey) return;
            // Cancel any pending property deletion when user unlinks merged property
            setPendingPropertyDeletion(null);
            setNewProfileKey(propertyKey);
            setNewProfileValue("");
            setNewProfileKeyPath(fullKey.split(".").slice(0, -1));
            setNewProfileModalOpen(true);
            setFocusValueInput(true);
        },
        [setPendingPropertyDeletion, setNewProfileKey, setNewProfileValue, setNewProfileKeyPath, setNewProfileModalOpen, setFocusValueInput]
    );

    const handleAddNewProfileKey = useCallback(() => {
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
    }, [
        newProfileKey,
        newProfileKeyPath,
        newProfileValue,
        isSecure,
        configurations,
        selectedTab,
        selectedProfileKey,
        schemaValidations,
        pendingChanges,
        renames,
        setPendingChanges,
        setDeletions,
        setHiddenItems,
        setNewProfileKey,
        setNewProfileValue,
        setNewProfileKeyPath,
        setNewProfileModalOpen,
        setIsSecure,
        setFocusValueInput,
    ]);

    return {
        handleChange,
        handleDefaultsChange,
        handleDeleteProperty,
        confirmDeleteProperty,
        handleUnlinkMergedProperty,
        handleAddNewProfileKey,
    };
}
