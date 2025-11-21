import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { schemaValidation } from "../../../../utils/ConfigSchemaHelpers";
import { Configuration, PendingChange, PendingDefault, ConfigEditorSettings } from "../types";

export function useConfigState(vscodeApi: any) {
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

    const CONFIG_EDITOR_SETTINGS_KEY = "zowe.configEditor.settings";

    const [configEditorSettings, setConfigEditorSettings] = useState<ConfigEditorSettings>({
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

    const getLocalStorageValue = useCallback(
        (key: string, defaultValue: any) => {
            vscodeApi.postMessage({
                command: "GET_LOCAL_STORAGE_VALUE",
                key,
            });
            return defaultValue;
        },
        [vscodeApi]
    );

    const setLocalStorageValue = useCallback(
        (key: string, value: any) => {
            vscodeApi.postMessage({
                command: "SET_LOCAL_STORAGE_VALUE",
                key,
                value,
            });
        },
        [vscodeApi]
    );

    const createSettingSetterWithStorage = useCallback(
        <K extends keyof ConfigEditorSettings>(key: K, shouldIncrementSortVersion = false) => {
            return (value: ConfigEditorSettings[K]) => {
                setConfigEditorSettings((prev) => {
                    const updated = { ...prev, [key]: value };
                    setLocalStorageValue(CONFIG_EDITOR_SETTINGS_KEY, updated);
                    return updated;
                });
                if (shouldIncrementSortVersion) {
                    setSortOrderVersion((prev) => prev + 1);
                }
            };
        },
        [setLocalStorageValue]
    );

    const setShowMergedPropertiesWithStorage = useMemo(
        () => createSettingSetterWithStorage("showMergedProperties", true),
        [createSettingSetterWithStorage]
    );

    const setViewModeWithStorage = useMemo(() => createSettingSetterWithStorage("viewMode", false), [createSettingSetterWithStorage]);

    const setPropertySortOrderWithStorage = useMemo(
        () => createSettingSetterWithStorage("propertySortOrder", true),
        [createSettingSetterWithStorage]
    );

    const setProfileSortOrderWithStorage = useMemo(() => createSettingSetterWithStorage("profileSortOrder", false), [createSettingSetterWithStorage]);

    const setDefaultsCollapsedWithStorage = useMemo(
        () => createSettingSetterWithStorage("defaultsCollapsed", false),
        [createSettingSetterWithStorage]
    );

    const setProfilesCollapsedWithStorage = useMemo(
        () => createSettingSetterWithStorage("profilesCollapsed", false),
        [createSettingSetterWithStorage]
    );

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

    return {
        configurations,
        setConfigurations,
        selectedTab,
        setSelectedTab,
        flattenedConfig,
        setFlattenedConfig,
        flattenedDefaults,
        setFlattenedDefaults,
        pendingChanges,
        setPendingChanges,
        pendingDefaults,
        setPendingDefaults,
        deletions,
        setDeletions,
        defaultsDeletions,
        setDefaultsDeletions,
        renames,
        setRenames,
        dragDroppedProfiles,
        setDragDroppedProfiles,
        autostoreChanges,
        setAutostoreChanges,
        hiddenItems,
        setHiddenItems,
        schemaValidations,
        setSchemaValidations,
        selectedProfileKey,
        setSelectedProfileKey,
        selectedProfilesByConfig,
        setSelectedProfilesByConfig,
        mergedProperties,
        setMergedProperties,
        configEditorSettings,
        setConfigEditorSettings,
        pendingMergedPropertiesRequest,
        setPendingMergedPropertiesRequest,
        sortOrderVersion,
        setSortOrderVersion,
        isSaving,
        setIsSaving,
        pendingSaveSelection,
        setPendingSaveSelection,
        isNavigating,
        setIsNavigating,
        profileSearchTerm,
        setProfileSearchTerm,
        profileFilterType,
        setProfileFilterType,
        hasWorkspace,
        setHasWorkspace,
        secureValuesAllowed,
        setSecureValuesAllowed,
        hasPromptedForZeroConfigs,
        setHasPromptedForZeroConfigs,
        expandedNodesByConfig,
        setExpandedNodesByConfig,
        profileMenuOpen,
        setProfileMenuOpen,
        renameProfileModalOpen,
        setRenameProfileModalOpen,
        configurationsRef,
        pendingChangesRef,
        deletionsRef,
        pendingDefaultsRef,
        defaultsDeletionsRef,
        autostoreChangesRef,
        renamesRef,
        selectedProfileKeyRef,
        setLocalStorageValue,
        setShowMergedPropertiesWithStorage,
        setViewModeWithStorage,
        setPropertySortOrderWithStorage,
        setProfileSortOrderWithStorage,
        setDefaultsCollapsedWithStorage,
        setProfilesCollapsedWithStorage,
        CONFIG_EDITOR_SETTINGS_KEY,
        vscodeApi,
    };
}
