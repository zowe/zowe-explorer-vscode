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

import type { EditorRuntime } from "./types";
import { profileKeyToPath } from "../utils/configUtils";
import { getOriginalProfileKeyWithNested } from "../utils/profileUtils";
import {
    buildClipboardChanges,
    clearCutProfileDefaults,
    collectClipboardProfiles,
    getUniqueProfileKey,
    removeCutProfileChanges,
} from "../utils/profileClipboard";
import { createProfileUtils } from "./profileUtils";
import { createUtilityHelpers } from "./utilityHelpers";
import { createProfileActions } from "./profileActions";
import { getProfileType, getRenamedProfileKeyWithNested } from "../utils/profileUtils";

export function createClipboardActions(state: EditorRuntime) {
    const {
        profileClipboard,
        setProfileClipboard,
        pendingChanges,
        setPendingChanges,
        setDeletions,
        setPendingDefaults,
        selectedTab,
        configurations,
        renames,
    } = state;
    const config = selectedTab === null ? undefined : configurations[selectedTab];
    const profileKeys = config
        ? createProfileUtils(state)
              .getAvailableProfilesForConfig(config.configPath)
              .map((key) => getRenamedProfileKeyWithNested(key, config.configPath, renames))
        : [];
    const pendingProfiles = config ? createUtilityHelpers(state).extractPendingProfiles(config.configPath) : {};
    const { handleProfileSelection: onProfileSelect, handleRenameProfile: onProfileRename } = createProfileActions(state);

    const collectProfiles = (profileKey: string, sourceTab = selectedTab) => {
        const sourceState = { ...state, selectedTab: sourceTab };
        const sourcePath = sourceTab === null ? undefined : configurations[sourceTab]?.configPath;
        if (!sourcePath) return {};
        return collectClipboardProfiles({
            profileKey,
            profileKeys: createProfileUtils(sourceState).getAvailableProfilesForConfig(sourcePath),
            pendingProfiles: createUtilityHelpers(sourceState).extractPendingProfiles(sourcePath),
            getProfileType: (key) => getProfileType({ ...sourceState, profileKey: key }),
            selectedTab: sourceTab,
            configurations,
            pendingChanges,
            renames,
            deletions: state.deletions,
        });
    };
    const uniqueKey = (proposedKey: string) =>
        getUniqueProfileKey(proposedKey, [...profileKeys, ...Object.keys(pendingProfiles), ...Object.values(renames[config!.configPath] || {})]);
    const addProfiles = (profiles: NonNullable<typeof profileClipboard>["profiles"], sourceKey: string, destinationKey: string) => {
        const changes = buildClipboardChanges(profiles, sourceKey, destinationKey);
        setPendingChanges((prev) => ({ ...prev, [config!.configPath]: { ...prev[config!.configPath], ...changes } }));
        onProfileSelect(destinationKey);
    };

    const copyProfile = (profileKey: string, isCut: boolean) => {
        if (!config) return;
        setProfileClipboard({
            type: isCut ? "cut" : "copy",
            sourceKey: profileKey,
            originalKey: getOriginalProfileKeyWithNested(profileKey, config.configPath, renames),
            configPath: config.configPath,
            profiles: collectProfiles(profileKey),
        });
    };

    const duplicateProfile = (profileKey: string) => {
        if (!config) return;
        const destinationKey = uniqueKey(profileKey + "_copy");
        addProfiles(collectProfiles(profileKey), profileKey, destinationKey);
    };

    const pasteProfile = (targetProfileKey: string | null) => {
        if (!profileClipboard || !config) return;
        const sourceTab = configurations.findIndex((entry) => entry.configPath === profileClipboard.configPath);
        const sourceKey =
            profileClipboard.type === "cut"
                ? getRenamedProfileKeyWithNested(profileClipboard.originalKey ?? profileClipboard.sourceKey, profileClipboard.configPath, renames)
                : profileClipboard.sourceKey;
        const profiles = profileClipboard.type === "cut" ? (sourceTab < 0 ? {} : collectProfiles(sourceKey, sourceTab)) : profileClipboard.profiles;
        if (!profiles[sourceKey]) return;
        const leafName = sourceKey.split(".").pop() || sourceKey;
        const destinationKey = uniqueKey(targetProfileKey ? `${targetProfileKey}.${leafName}` : leafName);
        if (profileClipboard.type === "cut" && profileClipboard.configPath === config.configPath) {
            if (destinationKey === sourceKey || targetProfileKey === sourceKey || targetProfileKey?.startsWith(sourceKey + ".")) return;
            if (onProfileRename(getOriginalProfileKeyWithNested(sourceKey, config.configPath, renames), destinationKey, true)) {
                setProfileClipboard(null);
            }
            return;
        }

        addProfiles(profiles, sourceKey, destinationKey);
        if (profileClipboard.type === "cut") {
            const sourcePath = profileKeyToPath(sourceKey).join(".");
            const clipboard = { ...profileClipboard, sourceKey };
            setDeletions((prev) => ({ ...prev, [profileClipboard.configPath]: [...(prev[profileClipboard.configPath] || []), sourcePath] }));
            setPendingChanges((prev) => removeCutProfileChanges(prev, clipboard));
            const savedDefaults = configurations.find((entry) => entry.configPath === profileClipboard.configPath)?.properties?.defaults || {};
            setPendingDefaults((prev) => clearCutProfileDefaults(prev, savedDefaults, clipboard));
            setProfileClipboard(null);
        }
    };

    return { profileClipboard, copyProfile, duplicateProfile, pasteProfile };
}
