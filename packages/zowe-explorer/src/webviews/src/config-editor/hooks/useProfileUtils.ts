import { useMemo } from "react";
import { useEditorFields } from "../context/EditorStoreContext";
import { createProfileUtils } from "../store/profileUtils";

export function useProfileUtils() {
    const fields = useEditorFields(
        "configurations",
        "selectedTab",
        "pendingChanges",
        "deletions",
        "pendingDefaults",
        "defaultsDeletions",
        "autostoreChanges",
        "renames",
        "dragDroppedProfiles",
        "configEditorSettings"
    );
    return useMemo(() => createProfileUtils(fields), [fields]);
}
