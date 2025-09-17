import { 
  useConfigurations, 
  useSelectedTab, 
  usePendingChanges, 
  useRenames, 
  useConfigEditorActions 
} from "../store";
import { getProfileType } from "./profileUtils";

export const handleSetAsDefault = (profileKey: string) => {
    const configurations = useConfigurations();
    const selectedTab = useSelectedTab();
    const pendingChanges = usePendingChanges();
    const renames = useRenames();
    const { setPendingDefaults, setDefaultsDeletions } = useConfigEditorActions();
    const profileType = getProfileType(profileKey, selectedTab, configurations, pendingChanges, renames);
    if (!profileType) {
        return;
    }

    const configPath = configurations[selectedTab!]!.configPath;

    // Set the default for this profile type
    setPendingDefaults((prev: any) => ({
        ...prev,
        [configPath]: {
            ...prev[configPath],
            [profileType]: { value: profileKey, path: [profileType] },
        },
    }));

    // Remove any deletion for this default
    setDefaultsDeletions((prev: any) => ({
        ...prev,
        [configPath]: prev[configPath]?.filter((k: any) => k !== profileType) ?? [],
    }));
};
