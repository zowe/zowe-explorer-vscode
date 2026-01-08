/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

import { useState } from "react";

/**
 * Hook to manage all wizard state.
 * This is a pure state container with no business logic.
 */
export function useWizardState() {
    const [wizardModalOpen, setWizardModalOpen] = useState(false);
    const [wizardRootProfile, setWizardRootProfile] = useState("root");
    const [wizardSelectedType, setWizardSelectedType] = useState("");
    const [wizardProfileName, setWizardProfileName] = useState("");
    const [wizardProperties, setWizardProperties] = useState<{ key: string; value: string | boolean | number | Object; secure?: boolean }[]>([]);
    const [wizardShowKeyDropdown, setWizardShowKeyDropdown] = useState(false);
    const [wizardNewPropertyKey, setWizardNewPropertyKey] = useState("");
    const [wizardNewPropertyValue, setWizardNewPropertyValue] = useState("");
    const [wizardNewPropertySecure, setWizardNewPropertySecure] = useState(false);
    const [wizardMergedProperties, setWizardMergedProperties] = useState<{ [key: string]: any }>({});
    const [wizardPopulatedDefaults, setWizardPopulatedDefaults] = useState<Set<string>>(new Set());

    return {
        // State values
        wizardModalOpen,
        wizardRootProfile,
        wizardSelectedType,
        wizardProfileName,
        wizardProperties,
        wizardShowKeyDropdown,
        wizardNewPropertyKey,
        wizardNewPropertyValue,
        wizardNewPropertySecure,
        wizardMergedProperties,
        wizardPopulatedDefaults,

        // Setters
        setWizardModalOpen,
        setWizardRootProfile,
        setWizardSelectedType,
        setWizardProfileName,
        setWizardProperties,
        setWizardShowKeyDropdown,
        setWizardNewPropertyKey,
        setWizardNewPropertyValue,
        setWizardNewPropertySecure,
        setWizardMergedProperties,
        setWizardPopulatedDefaults,
    };
}
