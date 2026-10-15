import { useEffect, useRef } from "react";
import { useEditorFields } from "../context/EditorStoreContext";

export function useWizardEffects() {
    const {
        wizardSelectedType,
        wizardPopulatedDefaults,
        wizardMergedProperties,
        setWizardProperties,
        setWizardPopulatedDefaults,
        wizardModalOpen,
        selectedTab,
        wizardRootProfile,
        pendingChanges,
        wizardProfileName,
        renames,
        requestWizardMergedProperties,
        validateProfileNameWithServer,
    } = useEditorFields(
        "wizardSelectedType",
        "wizardPopulatedDefaults",
        "wizardMergedProperties",
        "setWizardProperties",
        "setWizardPopulatedDefaults",
        "wizardModalOpen",
        "selectedTab",
        "wizardRootProfile",
        "pendingChanges",
        "wizardProfileName",
        "renames",
        "requestWizardMergedProperties",
        "validateProfileNameWithServer"
    );
    const wizardMergedPropertiesTargetRef = useRef<string | null>(null);
    // Clear populated defaults when type changes
    useEffect(() => {
        if (wizardSelectedType && wizardPopulatedDefaults.size > 0) {
            // Clear properties that were populated from defaults (not merged properties)
            setWizardProperties((prev) => {
                const mergedKeys = new Set(Object.keys(wizardMergedProperties));
                return prev.filter((prop) => mergedKeys.has(prop.key) || !wizardPopulatedDefaults.has(prop.key));
            });
            setWizardPopulatedDefaults(new Set());
        }
    }, [wizardSelectedType]);

    useEffect(() => {
        if (!wizardModalOpen || selectedTab === null || !(wizardRootProfile || wizardSelectedType)) {
            wizardMergedPropertiesTargetRef.current = null;
            return;
        }

        // Fetch immediately when the target itself changes (modal opened, different parent or
        // type) so inherited values aren't delayed; only debounce follow-up pendingChanges churn.
        const target = `${selectedTab}:${wizardRootProfile}:${wizardSelectedType}`;
        if (wizardMergedPropertiesTargetRef.current !== target) {
            wizardMergedPropertiesTargetRef.current = target;
            requestWizardMergedProperties();
            return;
        }

        const timeoutId = setTimeout(() => requestWizardMergedProperties(), 1000);
        return () => clearTimeout(timeoutId);
    }, [wizardRootProfile, wizardSelectedType, wizardModalOpen, selectedTab, pendingChanges]);

    // Validate only the current target; the action reads the latest state when the debounce fires.
    useEffect(() => {
        const timeout = setTimeout(validateProfileNameWithServer, 300);
        return () => clearTimeout(timeout);
    }, [wizardProfileName, wizardRootProfile, selectedTab, pendingChanges, renames, validateProfileNameWithServer]);
}
