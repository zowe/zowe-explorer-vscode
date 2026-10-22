/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 * SPDX-License-Identifier: EPL-2.0
 * Copyright Contributors to the Zowe Project.
 */

import { handleRenameProfile, handleDeleteProfile, handleProfileSelection, handleNavigateToSource } from "../handlers/profileHandlers";
import { getProfileType } from "../utils/profileUtils";
import { createProfileUtils } from "./profileUtils";
import { createUtilityHelpers } from "./utilityHelpers";
import type { EditorRuntime } from "./types";

export type ProfileHandlerContext = EditorRuntime &
    Pick<ReturnType<typeof createProfileUtils>, "formatPendingChanges" | "getAvailableProfilesForConfig"> &
    Pick<ReturnType<typeof createUtilityHelpers>, "extractPendingProfiles">;

export function createProfileActions(state: EditorRuntime) {
    const context: ProfileHandlerContext = {
        ...state,
        ...createProfileUtils(state),
        extractPendingProfiles: createUtilityHelpers(state).extractPendingProfiles,
    };
    return {
        openRenameProfile: () => {
            state.setPendingProfileDeletion(null);
            state.setRenameProfileModalOpen(true);
        },
        handleRenameProfile: (profileKey: string, newKey: string, isDragDrop = false) => handleRenameProfile(profileKey, newKey, isDragDrop, context),
        confirmDeleteProfile: (profileKey: string) => {
            handleDeleteProfile(profileKey, context);
            state.setPendingProfileDeletion(null);
        },
        handleDeleteProfile: (profileKey: string) => state.setPendingProfileDeletion(profileKey),
        handleProfileSelection: (profileKey: string) => {
            state.setPendingProfileDeletion(null);
            state.setPendingPropertyDeletion(null);
            handleProfileSelection(profileKey, context);
        },
        handleNavigateToSource: (jsonLoc: string, osLoc?: string[]) => handleNavigateToSource(context)(jsonLoc, osLoc),
        handleSetAsDefault: (profileKey: string) => {
            state.setPendingProfileDeletion(null);
            state.setPendingPropertyDeletion(null);
            const type = getProfileType({ profileKey, ...state });
            const config = state.selectedTab === null ? undefined : state.configurations[state.selectedTab];
            if (!type || !config) return;
            state.setPendingDefaults((previous) => ({
                ...previous,
                [config.configPath]: {
                    ...previous[config.configPath],
                    [type]: { value: profileKey, path: ["defaults", type] },
                },
            }));
            state.setDefaultsDeletions((previous) => ({
                ...previous,
                [config.configPath]: previous[config.configPath]?.filter((key) => key !== type) ?? [],
            }));
        },
    };
}
