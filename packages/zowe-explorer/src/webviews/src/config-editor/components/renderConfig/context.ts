import type { EditorStoreState } from "../../store/editorStore";
import type { createUtilityHelpers } from "../../store/utilityHelpers";
import type { ensureProfileProperties, isMergedPropertySecure } from "../../utils";
import type { MergedPropertiesVisibility, PropertySortOrder } from "../../types";

/** Shared editor dependencies resolved once for the recursive property renderer. */
type RenderConfigInputs = Pick<
    EditorStoreState,
    | "handleChange"
    | "handleDeleteProperty"
    | "confirmDeleteProperty"
    | "pendingPropertyDeletion"
    | "setPendingPropertyDeletion"
    | "handleUnlinkMergedProperty"
    | "handleNavigateToSource"
    | "openAddProfileModalAtPath"
> &
    Pick<
        ReturnType<typeof createUtilityHelpers>,
        | "handleToggleSecure"
        | "getWizardTypeOptions"
        | "mergePendingChangesForProfile"
        | "mergeMergedProperties"
        | "filterSecureProperties"
        | "mergePendingSecureProperties"
        | "isCurrentProfileUntyped"
        | "isPropertyFromMergedProps"
        | "isPropertySecure"
        | "canPropertyBeSecure"
    > & {
        propertyDescriptions: Record<string, string>;
        ensureProfileProperties: typeof ensureProfileProperties;
        isMergedPropertySecure: typeof isMergedPropertySecure;
    };

export type RenderConfigCtx = RenderConfigInputs &
    Pick<
        EditorStoreState,
        | "configurations"
        | "selectedTab"
        | "pendingChanges"
        | "deletions"
        | "renames"
        | "schemaValidations"
        | "hiddenItems"
        | "secureValuesAllowed"
        | "selectedProfileKey"
        | "vscodeApi"
        | "setPropertySortOrderWithStorage"
        | "setShowMergedPropertiesWithStorage"
    > & {
        showMergedProperties: MergedPropertiesVisibility;
        propertySortOrder: PropertySortOrder;
        isUntypedProfile: boolean;
    };
