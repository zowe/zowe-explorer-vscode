/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 * SPDX-License-Identifier: EPL-2.0
 * Copyright Contributors to the Zowe Project.
 */

import { createStore, type StoreApi } from "zustand/vanilla";
import { createEditorData, CONFIG_EDITOR_SETTINGS_KEY } from "./initialization";
import type { EditorData, EditorRuntime, FieldSetters, StateUpdate } from "./types";
import { createConfigurationActions } from "./configurationActions";
import { createPropertyActions } from "./propertyActions";
import { createProfileActions } from "./profileActions";
import { createWizardActions } from "./wizardActions";
import { createDialogActions } from "./dialogActions";
import { createProfileUtils } from "./profileUtils";
import { createClipboardActions } from "./clipboardActions";
import { buildHistoryEntry, pushHistoryEntry, undoTransition, redoTransition } from "../utils/undoHistory";
import type { ConfigEditorWebviewApi } from "../handlers/messageHandlers";

export type EditorStoreState = EditorRuntime &
    ReturnType<typeof createConfigurationActions> &
    ReturnType<typeof createPropertyActions> &
    ReturnType<typeof createProfileActions> &
    ReturnType<typeof createDialogActions> &
    ReturnType<typeof createWizardActions> &
    ReturnType<typeof createProfileUtils> &
    Pick<ReturnType<typeof createClipboardActions>, "copyProfile" | "duplicateProfile" | "pasteProfile">;
export type EditorStore = StoreApi<EditorStoreState>;
export type { EditorData, EditorRuntime, StateUpdate } from "./types";

/** A synchronous transaction publishes one snapshot and records one undo entry, including edits spanning files. */
export function createEditorStore(vscodeApi: ConfigEditorWebviewApi = { postMessage: () => undefined }): EditorStore {
    let working: EditorStoreState | undefined;
    let shouldRecord = true;
    let read: () => EditorStoreState;
    const store = createStore<EditorStoreState>()((set, get) => {
        read = () => working ?? get();
        const transaction = <T>(action: () => T, recordHistory = true): T => {
            if (working) return action();
            const before = get();
            working = before;
            shouldRecord = recordHistory;
            try {
                const result = action();
                let after = working;
                if (shouldRecord) {
                    const entry = buildHistoryEntry(before, after, Date.now());
                    if (entry) after = { ...after, undoStack: pushHistoryEntry(after.undoStack, entry), redoStack: [] };
                }
                working = undefined;
                if (after !== before) set(after, true);
                return result;
            } catch (error) {
                working = undefined;
                throw error;
            }
        };
        const update = (patch: Partial<EditorStoreState>): void => {
            transaction(() => {
                working = { ...read(), ...patch };
            });
        };
        const initial = createEditorData();
        const setters = Object.fromEntries(
            Object.keys(initial).map((name) => {
                const key = name as keyof EditorData;
                return [
                    `set${name[0].toUpperCase()}${name.slice(1)}`,
                    (value: StateUpdate<EditorData[typeof key]>): void => {
                        transaction(() => {
                            const current = read()[key];
                            const next = typeof value === "function" ? value(current) : value;
                            if (next !== current) update({ [key]: next });
                        });
                    },
                ];
            })
        ) as FieldSetters<EditorData>;
        const bind = <T extends object, K extends keyof T>(factory: (state: EditorRuntime) => T, keys: K[], recordHistory = true): Pick<T, K> => {
            return Object.fromEntries(
                keys.map((key) => [
                    key,
                    (...args: unknown[]) =>
                        transaction(() => {
                            if (recordHistory && read().isSaving) return;
                            return Reflect.apply(factory(read())[key] as (...values: unknown[]) => unknown, undefined, args);
                        }, recordHistory),
                ])
            ) as Pick<T, K>;
        };
        const setting =
            <K extends keyof EditorData["configEditorSettings"]>(key: K, invalidate = false) =>
            (value: EditorData["configEditorSettings"][K]): void =>
                transaction(() => {
                    const configEditorSettings = { ...read().configEditorSettings, [key]: value };
                    update({ configEditorSettings, ...(invalidate ? { sortOrderVersion: read().sortOrderVersion + 1 } : {}) });
                    vscodeApi.postMessage({ command: "SET_LOCAL_STORAGE_VALUE", key: CONFIG_EDITOR_SETTINGS_KEY, value: configEditorSettings });
                }, false);
        return {
            ...initial,
            ...setters,
            vscodeApi,
            transaction,
            clearHistory: () => {
                shouldRecord = false;
                update({ undoStack: [], redoStack: [] });
            },
            undo: () =>
                transaction(() => {
                    if (read().isSaving) return;
                    const transition = undoTransition(read().undoStack, read().redoStack);
                    if (transition) update({ ...transition.snapshot, undoStack: transition.undoStack, redoStack: transition.redoStack });
                }, false),
            redo: () =>
                transaction(() => {
                    if (read().isSaving) return;
                    const transition = redoTransition(read().undoStack, read().redoStack);
                    if (transition) update({ ...transition.snapshot, undoStack: transition.undoStack, redoStack: transition.redoStack });
                }, false),
            setLocalStorageValue: (key, value) => vscodeApi.postMessage({ command: "SET_LOCAL_STORAGE_VALUE", key, value }),
            setShowMergedPropertiesWithStorage: setting("showMergedProperties", true),
            setViewModeWithStorage: setting("viewMode"),
            setPropertySortOrderWithStorage: setting("propertySortOrder", true),
            setProfileSortOrderWithStorage: setting("profileSortOrder"),
            setDefaultsCollapsedWithStorage: setting("defaultsCollapsed"),
            setProfilesCollapsedWithStorage: setting("profilesCollapsed"),
            toggleViewMode: () => read().setViewModeWithStorage(read().configEditorSettings.viewMode === "tree" ? "flat" : "tree"),
            ...bind(createConfigurationActions, ["handleSave", "handleRefresh", "handleTabChange"], false),
            ...bind(createConfigurationActions, ["handleAutostoreToggle"]),
            ...bind(createDialogActions, ["handleAddNewLayer"]),
            ...bind(
                createDialogActions,
                [
                    "openAddProfileModalAtPath",
                    "handleAddNewConfig",
                    "handleAddConfig",
                    "handleCancelAddConfig",
                    "handleOpenConfigFile",
                    "handleRevealInFinder",
                    "handleOpenSchemaFile",
                    "handleExportRedacted",
                    "handleOpenTutorial",
                    "dismissTutorial",
                ],
                false
            ),
            ...bind(createPropertyActions, [
                "handleChange",
                "handleDefaultsChange",
                "handleDeleteProperty",
                "confirmDeleteProperty",
                "handleUnlinkMergedProperty",
                "handleAddNewProfileKey",
            ]),
            ...bind(createProfileActions, [
                "openRenameProfile",
                "handleRenameProfile",
                "confirmDeleteProfile",
                "handleDeleteProfile",
                "handleProfileSelection",
                "handleNavigateToSource",
                "handleSetAsDefault",
            ]),
            ...bind(createWizardActions, ["handleWizardCreateProfile"]),
            ...bind(
                createWizardActions,
                [
                    "getWizardTypeOptions",
                    "getWizardPropertyOptions",
                    "getWizardPropertyDescriptions",
                    "getPropertyType",
                    "handleWizardAddProperty",
                    "handleWizardRemoveProperty",
                    "handleWizardPropertyValueChange",
                    "handleWizardPropertySecureToggle",
                    "handleWizardCancel",
                    "requestWizardMergedProperties",
                    "handleWizardPopulateDefaults",
                    "validateProfileNameWithServer",
                ],
                false
            ),
            ...bind(
                createProfileUtils,
                [
                    "formatPendingChanges",
                    "getAvailableProfiles",
                    "getAvailableProfilesForConfig",
                    "doesProfileExist",
                    "doesSavedProfileExist",
                    "hasPendingChanges",
                ],
                false
            ),
            ...bind(createClipboardActions, ["copyProfile", "duplicateProfile", "pasteProfile"]),
        };
    });
    return { ...store, getState: () => read() };
}
