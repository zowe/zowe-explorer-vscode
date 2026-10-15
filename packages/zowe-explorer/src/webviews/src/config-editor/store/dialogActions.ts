/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 * SPDX-License-Identifier: EPL-2.0
 * Copyright Contributors to the Zowe Project.
 */

import type { EditorRuntime } from "./types";

export function createDialogActions(state: EditorRuntime) {
    const postFileCommand = (command: string, filePath: string) => state.vscodeApi.postMessage({ command, filePath });
    return {
        openAddProfileModalAtPath: (path: string[], key = "", value = "") => {
            state.setPendingPropertyDeletion(null);
            state.setNewProfileKeyPath(path);
            state.setNewProfileKey(key);
            state.setNewProfileValue(value);
            state.setNewProfileModalOpen(true);
        },
        handleAddNewLayer: () => {
            const config = state.selectedTab === null ? undefined : state.configurations[state.selectedTab];
            if (!config || !state.newLayerName.trim() || !state.newLayerPath) return;
            const path = [...state.newLayerPath, state.newLayerName.trim()];
            state.setPendingChanges((previous) => ({
                ...previous,
                [config.configPath]: {
                    ...previous[config.configPath],
                    [path.join(".")]: { value: {}, path, profile: path[0] },
                },
            }));
            state.setNewLayerName("");
            state.setNewLayerPath(null);
            state.setNewLayerModalOpen(false);
        },
        handleAddNewConfig: () => state.setAddConfigModalOpen(true),
        handleAddConfig: (configType: string) => {
            state.vscodeApi.postMessage({ command: "CREATE_NEW_CONFIG", configType });
            state.setAddConfigModalOpen(false);
            state.setHasPromptedForZeroConfigs(false);
        },
        handleCancelAddConfig: () => {
            state.setAddConfigModalOpen(false);
            state.setHasPromptedForZeroConfigs(false);
        },
        handleOpenConfigFile: (filePath: string) => postFileCommand("OPEN_CONFIG_FILE", filePath),
        handleRevealInFinder: (filePath: string) => postFileCommand("REVEAL_IN_FINDER", filePath),
        handleOpenSchemaFile: (filePath: string) => postFileCommand("OPEN_SCHEMA_FILE", filePath),
        handleExportRedacted: () => state.vscodeApi.postMessage({ command: "EXPORT_REDACTED_CONFIG" }),
        handleOpenTutorial: () => state.setShowTutorial(true),
        dismissTutorial: () => {
            state.setShowTutorial(false);
            if (!state.tutorialSeen) {
                state.setTutorialSeen(true);
                state.setLocalStorageValue("zowe.configEditor.tutorialSeen", true);
            }
        },
    };
}
