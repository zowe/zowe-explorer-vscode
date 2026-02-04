import { useConfigContext } from "../context/ConfigContext";
import { useProfileUtils } from "./useProfileUtils";
import { useUtilityHelpers } from "./useUtilityHelpers";
import { Configuration, PendingChange, PendingDefault } from "../types";

export interface HandlerContext {
    // State setters
    setRenames: React.Dispatch<React.SetStateAction<{ [configPath: string]: { [originalKey: string]: string } }>>;
    setSelectedProfileKey: React.Dispatch<React.SetStateAction<string | null>>;
    setPendingMergedPropertiesRequest: React.Dispatch<React.SetStateAction<string | null>>;
    setSortOrderVersion: React.Dispatch<React.SetStateAction<number>>;
    setSelectedProfilesByConfig: React.Dispatch<React.SetStateAction<{ [configPath: string]: string | null }>>;
    setExpandedNodesByConfig: React.Dispatch<React.SetStateAction<{ [configPath: string]: Set<string> }>>;
    setPendingDefaults: React.Dispatch<React.SetStateAction<{ [configPath: string]: { [key: string]: PendingDefault } }>>;
    setPendingChanges: React.Dispatch<React.SetStateAction<{ [configPath: string]: { [key: string]: PendingChange } }>>;
    setRenameProfileModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setDeletions: React.Dispatch<React.SetStateAction<{ [configPath: string]: string[] }>>;
    setSelectedTab: React.Dispatch<React.SetStateAction<number | null>>;
    setIsNavigating: React.Dispatch<React.SetStateAction<boolean>>;
    setDragDroppedProfiles: React.Dispatch<React.SetStateAction<{ [configPath: string]: Set<string> }>>;

    // State values
    selectedTab: number | null;
    configurations: Configuration[];
    renames: { [configPath: string]: { [originalKey: string]: string } };
    dragDroppedProfiles: { [configPath: string]: Set<string> };
    selectedProfileKey: string | null;
    pendingMergedPropertiesRequest: string | null;

    // Functions
    formatPendingChanges: () => any;
    extractPendingProfiles: (configPath: string) => { [key: string]: any };
    getAvailableProfilesForConfig: (configPath: string) => string[];
    vscodeApi: any;
}

export function useHandlerContext(vscodeApi: any): HandlerContext {
    const {
        setRenames,
        setSelectedProfileKey,
        setPendingMergedPropertiesRequest,
        setSortOrderVersion,
        setSelectedProfilesByConfig,
        setExpandedNodesByConfig,
        setPendingDefaults,
        setPendingChanges,
        setRenameProfileModalOpen,
        setDeletions,
        setSelectedTab,
        setIsNavigating,
        setDragDroppedProfiles,
        selectedTab,
        configurations,
        renames,
        dragDroppedProfiles,
        selectedProfileKey,
        pendingMergedPropertiesRequest,
    } = useConfigContext();

    const { formatPendingChanges, getAvailableProfilesForConfig } = useProfileUtils();

    const { extractPendingProfiles } = useUtilityHelpers();

    return {
        setRenames,
        setSelectedProfileKey,
        setPendingMergedPropertiesRequest,
        setSortOrderVersion,
        setSelectedProfilesByConfig,
        setExpandedNodesByConfig,
        setPendingDefaults,
        setPendingChanges,
        setRenameProfileModalOpen,
        setDeletions,
        setSelectedTab,
        setIsNavigating,
        setDragDroppedProfiles,
        selectedTab,
        configurations,
        renames,
        dragDroppedProfiles,
        selectedProfileKey,
        pendingMergedPropertiesRequest,
        formatPendingChanges,
        extractPendingProfiles,
        getAvailableProfilesForConfig,
        vscodeApi,
    };
}
