import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { schemaValidation } from "../../../utils/ConfigSchemaHelpers";
import { PropertySortOrder, ProfileSortOrder } from "./utils";

// Types
export type Configuration = {
  configPath: string;
  properties: any;
  secure: string[];
  global?: boolean;
  user?: boolean;
  schemaPath?: string;
};

export type PendingChange = {
  value: string | number | boolean | Record<string, any>;
  path: string[];
  profile: string;
  secure?: boolean;
};

export type PendingDefault = {
  value: string;
  path: string[];
};

// State interface
interface ConfigEditorState {
  // Core data
  configurations: Configuration[];
  selectedTab: number | null;
  flattenedConfig: { [key: string]: { value: string; path: string[] } };
  flattenedDefaults: { [key: string]: { value: string; path: string[] } };
  pendingChanges: { [configPath: string]: { [key: string]: PendingChange } };
  pendingDefaults: { [configPath: string]: { [key: string]: PendingDefault } };
  deletions: { [configPath: string]: string[] };
  defaultsDeletions: { [configPath: string]: string[] };
  renames: { [configPath: string]: { [originalKey: string]: string } };
  renameCounts: { [configPath: string]: { [profileKey: string]: number } };
  autostoreChanges: { [configPath: string]: boolean };
  hiddenItems: { [configPath: string]: { [key: string]: { path: string } } };
  schemaValidations: { [configPath: string]: schemaValidation | undefined };
  selectedProfileKey: string | null;
  selectedProfilesByConfig: { [configPath: string]: string | null };
  mergedProperties: any;
  showMergedProperties: boolean;
  pendingMergedPropertiesRequest: string | null;
  viewMode: "flat" | "tree";
  propertySortOrder: PropertySortOrder;
  profileSortOrder: ProfileSortOrder | null;
  sortOrderVersion: number;
  isSaving: boolean;
  pendingSaveSelection: { tab: number | null; profile: string | null } | null;
  isNavigating: boolean;
  profileSearchTerm: string;
  profileFilterType: string | null;
  hasWorkspace: boolean;
  secureValuesAllowed: boolean;
  hasPromptedForZeroConfigs: boolean;
  expandedNodesByConfig: { [configPath: string]: Set<string> };
  newProfileKeyPath: string[] | null;
  newProfileKey: string;
  newProfileValue: string;
  newProfileModalOpen: boolean;
  focusValueInput: boolean;
  saveModalOpen: boolean;
  newLayerModalOpen: boolean;
  newLayerName: string;
  newLayerPath: string[] | null;
  isSecure: boolean;
  showDropdown: boolean;
  addConfigModalOpen: boolean;
  profileMenuOpen: string | null;
  renameProfileModalOpen: boolean;
}

// Actions interface
interface ConfigEditorActions {
  // Core data actions
  setConfigurations: (configurations: Configuration[] | ((prev: Configuration[]) => Configuration[])) => void;
  setSelectedTab: (tab: number | null | ((prev: number | null) => number | null)) => void;
  setFlattenedConfig: (config: { [key: string]: { value: string; path: string[] } } | ((prev: { [key: string]: { value: string; path: string[] } }) => { [key: string]: { value: string; path: string[] } })) => void;
  setFlattenedDefaults: (defaults: { [key: string]: { value: string; path: string[] } } | ((prev: { [key: string]: { value: string; path: string[] } }) => { [key: string]: { value: string; path: string[] } })) => void;
  setPendingChanges: (changes: { [configPath: string]: { [key: string]: PendingChange } } | ((prev: { [configPath: string]: { [key: string]: PendingChange } }) => { [configPath: string]: { [key: string]: PendingChange } })) => void;
  setPendingDefaults: (defaults: { [configPath: string]: { [key: string]: PendingDefault } } | ((prev: { [configPath: string]: { [key: string]: PendingDefault } }) => { [configPath: string]: { [key: string]: PendingDefault } })) => void;
  setDeletions: (deletions: { [configPath: string]: string[] } | ((prev: { [configPath: string]: string[] }) => { [configPath: string]: string[] })) => void;
  setDefaultsDeletions: (deletions: { [configPath: string]: string[] } | ((prev: { [configPath: string]: string[] }) => { [configPath: string]: string[] })) => void;
  setRenames: (renames: { [configPath: string]: { [originalKey: string]: string } } | ((prev: { [configPath: string]: { [originalKey: string]: string } }) => { [configPath: string]: { [originalKey: string]: string } })) => void;
  setRenameCounts: (counts: { [configPath: string]: { [profileKey: string]: number } } | ((prev: { [configPath: string]: { [profileKey: string]: number } }) => { [configPath: string]: { [profileKey: string]: number } })) => void;
  setAutostoreChanges: (changes: { [configPath: string]: boolean } | ((prev: { [configPath: string]: boolean }) => { [configPath: string]: boolean })) => void;
  setHiddenItems: (items: { [configPath: string]: { [key: string]: { path: string } } } | ((prev: { [configPath: string]: { [key: string]: { path: string } } }) => { [configPath: string]: { [key: string]: { path: string } } })) => void;
  setSchemaValidations: (validations: { [configPath: string]: schemaValidation | undefined } | ((prev: { [configPath: string]: schemaValidation | undefined }) => { [configPath: string]: schemaValidation | undefined })) => void;
  setSelectedProfileKey: (key: string | null | ((prev: string | null) => string | null)) => void;
  setSelectedProfilesByConfig: (profiles: { [configPath: string]: string | null } | ((prev: { [configPath: string]: string | null }) => { [configPath: string]: string | null })) => void;
  setMergedProperties: (properties: any | ((prev: any) => any)) => void;
  setShowMergedProperties: (show: boolean | ((prev: boolean) => boolean)) => void;
  setPendingMergedPropertiesRequest: (request: string | null | ((prev: string | null) => string | null)) => void;
  setViewMode: (mode: "flat" | "tree" | ((prev: "flat" | "tree") => "flat" | "tree")) => void;
  setPropertySortOrder: (order: PropertySortOrder | ((prev: PropertySortOrder) => PropertySortOrder)) => void;
  setProfileSortOrder: (order: ProfileSortOrder | null | ((prev: ProfileSortOrder | null) => ProfileSortOrder | null)) => void;
  setSortOrderVersion: (version: number | ((prev: number) => number)) => void;
  setIsSaving: (saving: boolean | ((prev: boolean) => boolean)) => void;
  setPendingSaveSelection: (selection: { tab: number | null; profile: string | null } | null | ((prev: { tab: number | null; profile: string | null } | null) => { tab: number | null; profile: string | null } | null)) => void;
  setIsNavigating: (navigating: boolean | ((prev: boolean) => boolean)) => void;
  setProfileSearchTerm: (term: string | ((prev: string) => string)) => void;
  setProfileFilterType: (type: string | null | ((prev: string | null) => string | null)) => void;
  setHasWorkspace: (has: boolean | ((prev: boolean) => boolean)) => void;
  setSecureValuesAllowed: (allowed: boolean | ((prev: boolean) => boolean)) => void;
  setHasPromptedForZeroConfigs: (prompted: boolean | ((prev: boolean) => boolean)) => void;
  setExpandedNodesByConfig: (nodes: { [configPath: string]: Set<string> } | ((prev: { [configPath: string]: Set<string> }) => { [configPath: string]: Set<string> })) => void;
  setNewProfileKeyPath: (path: string[] | null | ((prev: string[] | null) => string[] | null)) => void;
  setNewProfileKey: (key: string | ((prev: string) => string)) => void;
  setNewProfileValue: (value: string | ((prev: string) => string)) => void;
  setNewProfileModalOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setFocusValueInput: (focus: boolean | ((prev: boolean) => boolean)) => void;
  setSaveModalOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setNewLayerModalOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setNewLayerName: (name: string | ((prev: string) => string)) => void;
  setNewLayerPath: (path: string[] | null | ((prev: string[] | null) => string[] | null)) => void;
  setIsSecure: (secure: boolean | ((prev: boolean) => boolean)) => void;
  setShowDropdown: (show: boolean | ((prev: boolean) => boolean)) => void;
  setAddConfigModalOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setProfileMenuOpen: (menu: string | null | ((prev: string | null) => string | null)) => void;
  setRenameProfileModalOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  
  // Utility actions
  reset: () => void;
}

// Initial state
const initialState: ConfigEditorState = {
  configurations: [],
  selectedTab: null,
  flattenedConfig: {},
  flattenedDefaults: {},
  pendingChanges: {},
  pendingDefaults: {},
  deletions: {},
  defaultsDeletions: {},
  renames: {},
  renameCounts: {},
  autostoreChanges: {},
  hiddenItems: {},
  schemaValidations: {},
  selectedProfileKey: null,
  selectedProfilesByConfig: {},
  mergedProperties: null,
  showMergedProperties: true,
  pendingMergedPropertiesRequest: null,
  viewMode: "tree",
  propertySortOrder: "alphabetical",
  profileSortOrder: null,
  sortOrderVersion: 0,
  isSaving: false,
  pendingSaveSelection: null,
  isNavigating: false,
  profileSearchTerm: "",
  profileFilterType: null,
  hasWorkspace: false,
  secureValuesAllowed: true,
  hasPromptedForZeroConfigs: false,
  expandedNodesByConfig: {},
  newProfileKeyPath: null,
  newProfileKey: "",
  newProfileValue: "",
  newProfileModalOpen: false,
  focusValueInput: false,
  saveModalOpen: false,
  newLayerModalOpen: false,
  newLayerName: "",
  newLayerPath: null,
  isSecure: false,
  showDropdown: false,
  addConfigModalOpen: false,
  profileMenuOpen: null,
  renameProfileModalOpen: false,
};

// Create the store
export const useConfigEditorStore = create<ConfigEditorState & ConfigEditorActions>()(
  subscribeWithSelector((set) => ({
    ...initialState,

    // Core data actions
    setConfigurations: (configurations) =>
      set((state) => ({
        configurations: typeof configurations === "function" ? configurations(state.configurations) : configurations,
      })),

    setSelectedTab: (tab) =>
      set((state) => ({
        selectedTab: typeof tab === "function" ? tab(state.selectedTab) : tab,
      })),

    setFlattenedConfig: (config) =>
      set((state) => ({
        flattenedConfig: typeof config === "function" ? config(state.flattenedConfig) : config,
      })),

    setFlattenedDefaults: (defaults) =>
      set((state) => ({
        flattenedDefaults: typeof defaults === "function" ? defaults(state.flattenedDefaults) : defaults,
      })),

    setPendingChanges: (changes) =>
      set((state) => ({
        pendingChanges: typeof changes === "function" ? changes(state.pendingChanges) : changes,
      })),

    setPendingDefaults: (defaults) =>
      set((state) => ({
        pendingDefaults: typeof defaults === "function" ? defaults(state.pendingDefaults) : defaults,
      })),

    setDeletions: (deletions) =>
      set((state) => ({
        deletions: typeof deletions === "function" ? deletions(state.deletions) : deletions,
      })),

    setDefaultsDeletions: (deletions) =>
      set((state) => ({
        defaultsDeletions: typeof deletions === "function" ? deletions(state.defaultsDeletions) : deletions,
      })),

    setRenames: (renames) =>
      set((state) => ({
        renames: typeof renames === "function" ? renames(state.renames) : renames,
      })),

    setRenameCounts: (counts) =>
      set((state) => ({
        renameCounts: typeof counts === "function" ? counts(state.renameCounts) : counts,
      })),

    setAutostoreChanges: (changes) =>
      set((state) => ({
        autostoreChanges: typeof changes === "function" ? changes(state.autostoreChanges) : changes,
      })),

    setHiddenItems: (items) =>
      set((state) => ({
        hiddenItems: typeof items === "function" ? items(state.hiddenItems) : items,
      })),

    setSchemaValidations: (validations) =>
      set((state) => ({
        schemaValidations: typeof validations === "function" ? validations(state.schemaValidations) : validations,
      })),

    setSelectedProfileKey: (key) =>
      set((state) => ({
        selectedProfileKey: typeof key === "function" ? key(state.selectedProfileKey) : key,
      })),

    setSelectedProfilesByConfig: (profiles) =>
      set((state) => ({
        selectedProfilesByConfig: typeof profiles === "function" ? profiles(state.selectedProfilesByConfig) : profiles,
      })),

    setMergedProperties: (properties) =>
      set((state) => ({
        mergedProperties: typeof properties === "function" ? properties(state.mergedProperties) : properties,
      })),

    setShowMergedProperties: (show) =>
      set((state) => ({
        showMergedProperties: typeof show === "function" ? show(state.showMergedProperties) : show,
      })),

    setPendingMergedPropertiesRequest: (request) =>
      set((state) => ({
        pendingMergedPropertiesRequest: typeof request === "function" ? request(state.pendingMergedPropertiesRequest) : request,
      })),

    setViewMode: (mode) =>
      set((state) => ({
        viewMode: typeof mode === "function" ? mode(state.viewMode) : mode,
      })),

    setPropertySortOrder: (order) =>
      set((state) => ({
        propertySortOrder: typeof order === "function" ? order(state.propertySortOrder) : order,
      })),

    setProfileSortOrder: (order) =>
      set((state) => ({
        profileSortOrder: typeof order === "function" ? order(state.profileSortOrder) : order,
      })),

    setSortOrderVersion: (version) =>
      set((state) => ({
        sortOrderVersion: typeof version === "function" ? version(state.sortOrderVersion) : version,
      })),

    setIsSaving: (saving) =>
      set((state) => ({
        isSaving: typeof saving === "function" ? saving(state.isSaving) : saving,
      })),

    setPendingSaveSelection: (selection) =>
      set((state) => ({
        pendingSaveSelection: typeof selection === "function" ? selection(state.pendingSaveSelection) : selection,
      })),

    setIsNavigating: (navigating) =>
      set((state) => ({
        isNavigating: typeof navigating === "function" ? navigating(state.isNavigating) : navigating,
      })),

    setProfileSearchTerm: (term) =>
      set((state) => ({
        profileSearchTerm: typeof term === "function" ? term(state.profileSearchTerm) : term,
      })),

    setProfileFilterType: (type) =>
      set((state) => ({
        profileFilterType: typeof type === "function" ? type(state.profileFilterType) : type,
      })),

    setHasWorkspace: (has) =>
      set((state) => ({
        hasWorkspace: typeof has === "function" ? has(state.hasWorkspace) : has,
      })),

    setSecureValuesAllowed: (allowed) =>
      set((state) => ({
        secureValuesAllowed: typeof allowed === "function" ? allowed(state.secureValuesAllowed) : allowed,
      })),

    setHasPromptedForZeroConfigs: (prompted) =>
      set((state) => ({
        hasPromptedForZeroConfigs: typeof prompted === "function" ? prompted(state.hasPromptedForZeroConfigs) : prompted,
      })),

    setExpandedNodesByConfig: (nodes) =>
      set((state) => ({
        expandedNodesByConfig: typeof nodes === "function" ? nodes(state.expandedNodesByConfig) : nodes,
      })),

    setNewProfileKeyPath: (path) =>
      set((state) => ({
        newProfileKeyPath: typeof path === "function" ? path(state.newProfileKeyPath) : path,
      })),

    setNewProfileKey: (key) =>
      set((state) => ({
        newProfileKey: typeof key === "function" ? key(state.newProfileKey) : key,
      })),

    setNewProfileValue: (value) =>
      set((state) => ({
        newProfileValue: typeof value === "function" ? value(state.newProfileValue) : value,
      })),

    setNewProfileModalOpen: (open) =>
      set((state) => ({
        newProfileModalOpen: typeof open === "function" ? open(state.newProfileModalOpen) : open,
      })),

    setFocusValueInput: (focus) =>
      set((state) => ({
        focusValueInput: typeof focus === "function" ? focus(state.focusValueInput) : focus,
      })),

    setSaveModalOpen: (open) =>
      set((state) => ({
        saveModalOpen: typeof open === "function" ? open(state.saveModalOpen) : open,
      })),

    setNewLayerModalOpen: (open) =>
      set((state) => ({
        newLayerModalOpen: typeof open === "function" ? open(state.newLayerModalOpen) : open,
      })),

    setNewLayerName: (name) =>
      set((state) => ({
        newLayerName: typeof name === "function" ? name(state.newLayerName) : name,
      })),

    setNewLayerPath: (path) =>
      set((state) => ({
        newLayerPath: typeof path === "function" ? path(state.newLayerPath) : path,
      })),

    setIsSecure: (secure) =>
      set((state) => ({
        isSecure: typeof secure === "function" ? secure(state.isSecure) : secure,
      })),

    setShowDropdown: (show) =>
      set((state) => ({
        showDropdown: typeof show === "function" ? show(state.showDropdown) : show,
      })),

    setAddConfigModalOpen: (open) =>
      set((state) => ({
        addConfigModalOpen: typeof open === "function" ? open(state.addConfigModalOpen) : open,
      })),

    setProfileMenuOpen: (menu) =>
      set((state) => ({
        profileMenuOpen: typeof menu === "function" ? menu(state.profileMenuOpen) : menu,
      })),

    setRenameProfileModalOpen: (open) =>
      set((state) => ({
        renameProfileModalOpen: typeof open === "function" ? open(state.renameProfileModalOpen) : open,
      })),

    // Utility actions
    reset: () => set(initialState),
  }))
);

// Selector hooks for better performance
export const useConfigurations = () => useConfigEditorStore((state) => state.configurations);
export const useSelectedTab = () => useConfigEditorStore((state) => state.selectedTab);
export const useFlattenedConfig = () => useConfigEditorStore((state) => state.flattenedConfig);
export const useFlattenedDefaults = () => useConfigEditorStore((state) => state.flattenedDefaults);
export const usePendingChanges = () => useConfigEditorStore((state) => state.pendingChanges);
export const usePendingDefaults = () => useConfigEditorStore((state) => state.pendingDefaults);
export const useDeletions = () => useConfigEditorStore((state) => state.deletions);
export const useDefaultsDeletions = () => useConfigEditorStore((state) => state.defaultsDeletions);
export const useRenames = () => useConfigEditorStore((state) => state.renames);
export const useRenameCounts = () => useConfigEditorStore((state) => state.renameCounts);
export const useAutostoreChanges = () => useConfigEditorStore((state) => state.autostoreChanges);
export const useHiddenItems = () => useConfigEditorStore((state) => state.hiddenItems);
export const useSchemaValidations = () => useConfigEditorStore((state) => state.schemaValidations);
export const useSelectedProfileKey = () => useConfigEditorStore((state) => state.selectedProfileKey);
export const useSelectedProfilesByConfig = () => useConfigEditorStore((state) => state.selectedProfilesByConfig);
export const useMergedProperties = () => useConfigEditorStore((state) => state.mergedProperties);
export const useShowMergedProperties = () => useConfigEditorStore((state) => state.showMergedProperties);
export const usePendingMergedPropertiesRequest = () => useConfigEditorStore((state) => state.pendingMergedPropertiesRequest);
export const useViewMode = () => useConfigEditorStore((state) => state.viewMode);
export const usePropertySortOrder = () => useConfigEditorStore((state) => state.propertySortOrder);
export const useProfileSortOrder = () => useConfigEditorStore((state) => state.profileSortOrder);
export const useSortOrderVersion = () => useConfigEditorStore((state) => state.sortOrderVersion);
export const useIsSaving = () => useConfigEditorStore((state) => state.isSaving);
export const usePendingSaveSelection = () => useConfigEditorStore((state) => state.pendingSaveSelection);
export const useIsNavigating = () => useConfigEditorStore((state) => state.isNavigating);
export const useProfileSearchTerm = () => useConfigEditorStore((state) => state.profileSearchTerm);
export const useProfileFilterType = () => useConfigEditorStore((state) => state.profileFilterType);
export const useHasWorkspace = () => useConfigEditorStore((state) => state.hasWorkspace);
export const useSecureValuesAllowed = () => useConfigEditorStore((state) => state.secureValuesAllowed);
export const useHasPromptedForZeroConfigs = () => useConfigEditorStore((state) => state.hasPromptedForZeroConfigs);
export const useExpandedNodesByConfig = () => useConfigEditorStore((state) => state.expandedNodesByConfig);
export const useNewProfileKeyPath = () => useConfigEditorStore((state) => state.newProfileKeyPath);
export const useNewProfileKey = () => useConfigEditorStore((state) => state.newProfileKey);
export const useNewProfileValue = () => useConfigEditorStore((state) => state.newProfileValue);
export const useNewProfileModalOpen = () => useConfigEditorStore((state) => state.newProfileModalOpen);
export const useFocusValueInput = () => useConfigEditorStore((state) => state.focusValueInput);
export const useSaveModalOpen = () => useConfigEditorStore((state) => state.saveModalOpen);
export const useNewLayerModalOpen = () => useConfigEditorStore((state) => state.newLayerModalOpen);
export const useNewLayerName = () => useConfigEditorStore((state) => state.newLayerName);
export const useNewLayerPath = () => useConfigEditorStore((state) => state.newLayerPath);
export const useIsSecure = () => useConfigEditorStore((state) => state.isSecure);
export const useShowDropdown = () => useConfigEditorStore((state) => state.showDropdown);
export const useAddConfigModalOpen = () => useConfigEditorStore((state) => state.addConfigModalOpen);
export const useProfileMenuOpen = () => useConfigEditorStore((state) => state.profileMenuOpen);
export const useRenameProfileModalOpen = () => useConfigEditorStore((state) => state.renameProfileModalOpen);

// Action hooks
export const useConfigEditorActions = () => useConfigEditorStore((state) => ({
  setConfigurations: state.setConfigurations,
  setSelectedTab: state.setSelectedTab,
  setFlattenedConfig: state.setFlattenedConfig,
  setFlattenedDefaults: state.setFlattenedDefaults,
  setPendingChanges: state.setPendingChanges,
  setPendingDefaults: state.setPendingDefaults,
  setDeletions: state.setDeletions,
  setDefaultsDeletions: state.setDefaultsDeletions,
  setRenames: state.setRenames,
  setRenameCounts: state.setRenameCounts,
  setAutostoreChanges: state.setAutostoreChanges,
  setHiddenItems: state.setHiddenItems,
  setSchemaValidations: state.setSchemaValidations,
  setSelectedProfileKey: state.setSelectedProfileKey,
  setSelectedProfilesByConfig: state.setSelectedProfilesByConfig,
  setMergedProperties: state.setMergedProperties,
  setShowMergedProperties: state.setShowMergedProperties,
  setPendingMergedPropertiesRequest: state.setPendingMergedPropertiesRequest,
  setViewMode: state.setViewMode,
  setPropertySortOrder: state.setPropertySortOrder,
  setProfileSortOrder: state.setProfileSortOrder,
  setSortOrderVersion: state.setSortOrderVersion,
  setIsSaving: state.setIsSaving,
  setPendingSaveSelection: state.setPendingSaveSelection,
  setIsNavigating: state.setIsNavigating,
  setProfileSearchTerm: state.setProfileSearchTerm,
  setProfileFilterType: state.setProfileFilterType,
  setHasWorkspace: state.setHasWorkspace,
  setSecureValuesAllowed: state.setSecureValuesAllowed,
  setHasPromptedForZeroConfigs: state.setHasPromptedForZeroConfigs,
  setExpandedNodesByConfig: state.setExpandedNodesByConfig,
  setNewProfileKeyPath: state.setNewProfileKeyPath,
  setNewProfileKey: state.setNewProfileKey,
  setNewProfileValue: state.setNewProfileValue,
  setNewProfileModalOpen: state.setNewProfileModalOpen,
  setFocusValueInput: state.setFocusValueInput,
  setSaveModalOpen: state.setSaveModalOpen,
  setNewLayerModalOpen: state.setNewLayerModalOpen,
  setNewLayerName: state.setNewLayerName,
  setNewLayerPath: state.setNewLayerPath,
  setIsSecure: state.setIsSecure,
  setShowDropdown: state.setShowDropdown,
  setAddConfigModalOpen: state.setAddConfigModalOpen,
  setProfileMenuOpen: state.setProfileMenuOpen,
  setRenameProfileModalOpen: state.setRenameProfileModalOpen,
  reset: state.reset,
}));
