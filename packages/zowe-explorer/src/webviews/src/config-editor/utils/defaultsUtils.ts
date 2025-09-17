import { createStateVariables, useConsolidatedState } from "../App";
import { getProfileType } from "./profileUtils";

export const handleSetAsDefault = (profileKey: string) => {
    const { state, setState, ...refs } = useConsolidatedState();
    const { configurations, selectedTab, pendingChanges, renames, setPendingDefaults, setDefaultsDeletions } = createStateVariables(state, setState);
    const profileType = getProfileType(profileKey, selectedTab, configurations, pendingChanges, renames);
    if (!profileType) {
        return;
    }

    const configPath = configurations[selectedTab!]!.configPath;

    // Set the default for this profile type
    setPendingDefaults((prev) => ({
        ...prev,
        [configPath]: {
            ...prev[configPath],
            [profileType]: { value: profileKey, path: [profileType] },
        },
    }));

    // Remove any deletion for this default
    setDefaultsDeletions((prev) => ({
        ...prev,
        [configPath]: prev[configPath]?.filter((k) => k !== profileType) ?? [],
    }));
};
