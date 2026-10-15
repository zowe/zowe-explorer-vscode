import { useMemo } from "react";
import { useEditorFields } from "../context/EditorStoreContext";
import { createUtilityHelpers } from "../store/utilityHelpers";

export function useUtilityHelpers() {
    const fields = useEditorFields(
        "selectedTab",
        "configurations",
        "pendingChanges",
        "deletions",
        "renames",
        "schemaValidations",
        "selectedProfileKey",
        "configEditorSettings",
        "pendingDefaults",
        "setPendingChanges",
        "expandedNodesByConfig",
        "setExpandedNodesByConfig",
        "dragDroppedProfiles",
        "transaction"
    );
    return useMemo(() => createUtilityHelpers(fields), [fields]);
}
