import { useMemo } from "react";
import { useConfigContext } from "../context/ConfigContext";
import {
    mergePendingChangesForProfile,
    mergeMergedProperties,
    filterSecureProperties,
    mergePendingSecureProperties,
    isPropertyFromMergedProps,
    canPropertyBeSecure,
    handleToggleSecure,
    hasPendingSecureChanges,
    extractPendingProfiles,
    isProfileOrParentDeleted,
    getAvailableProfilesByType,
    isProfileDefault,
    isCurrentProfileUntyped,
    sortProfilesAtLevel,
    isPropertyActuallyInherited,
    getProfileType,
    getRenamedProfileKeyWithNested,
    isPropertySecure,
    flattenProfiles,
} from "../utils";
import { hasPendingRename } from "../utils/renameUtils";
import { getWizardTypeOptions } from "../utils/schemaUtils";

export function useUtilityHelpers() {
    const {
        selectedTab,
        configurations,
        pendingChanges,
        deletions,
        renames,
        schemaValidations,
        selectedProfileKey,
        configEditorSettings,
        pendingDefaults,
        setPendingChanges,
        expandedNodesByConfig,
        setExpandedNodesByConfig,
        dragDroppedProfiles,
    } = useConfigContext();

    const { showMergedProperties, profileSortOrder } = configEditorSettings;

    return useMemo(
        () => ({
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
                    deletions,
                    showMergedProperties
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
                canPropertyBeSecure(
                    displayKey,
                    selectedTab,
                    configurations,
                    schemaValidations,
                    getProfileType,
                    pendingChanges,
                    renames,
                    selectedProfileKey
                ),

            handleToggleSecure: (fullKey: string, displayKey: string, path: string[], value: any) => {
                return handleToggleSecure(
                    fullKey,
                    displayKey,
                    path,
                    value,
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

            isProfileDefault: (profileKey: string) =>
                isProfileDefault(profileKey, selectedTab, configurations, pendingChanges, pendingDefaults, renames),

            isCurrentProfileUntyped: () => isCurrentProfileUntyped(selectedProfileKey, selectedTab, configurations, pendingChanges, renames),

            sortProfilesAtLevel: (profileKeys: string[]) => sortProfilesAtLevel(profileKeys, profileSortOrder),

            getExpandedNodesForConfig: (configPath: string): Set<string> => {
                return expandedNodesByConfig[configPath] || new Set();
            },

            setExpandedNodesForConfig: (configPath: string, expandedNodes: Set<string>) => {
                setExpandedNodesByConfig((prev: { [configPath: string]: Set<string> }) => ({
                    ...prev,
                    [configPath]: expandedNodes,
                }));
            },

            getRenamedProfileKeyWithNested: (
                originalKey: string,
                configPath: string,
                renames: { [configPath: string]: { [originalKey: string]: string } }
            ) => getRenamedProfileKeyWithNested(originalKey, configPath, renames),

            getProfileType: (profileKey: string, selectedTab: number | null, configurations: any[], pendingChanges: any, renames: any) =>
                getProfileType(profileKey, selectedTab, configurations, pendingChanges, renames),

            hasPendingRename: (profileKey: string, configPath: string, renames: any) => hasPendingRename(profileKey, configPath, renames),

            isProfileAffectedByDragDrop: (profileKey: string): boolean => {
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

            isPropertySecure: (fullKey: string, displayKey: string, path: string[], mergedProps?: any) =>
                isPropertySecure(fullKey, displayKey, path, mergedProps, selectedTab, configurations, pendingChanges, renames),

            getWizardTypeOptions: () => getWizardTypeOptions(selectedTab, configurations, schemaValidations, pendingChanges),
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
            expandedNodesByConfig,
            setExpandedNodesByConfig,
            dragDroppedProfiles,
        ]
    );
}
