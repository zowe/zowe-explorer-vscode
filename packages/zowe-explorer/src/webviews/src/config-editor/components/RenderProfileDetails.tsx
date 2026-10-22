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

import { findProfile, profileKeyToPath } from "../utils/configUtils";
import { useEffect, useRef } from "react";
import { VscodeToolbarButton } from "@vscode-elements/react-elements";
import { RenderConfig } from "./renderConfig";
import { ConfirmableDeleteButton } from "./ConfirmableDeleteButton";
import { getOriginalProfileKeyWithNested, getRenamedProfileKeyWithNested } from "../utils/profileRenames";
import { getPropertyDescriptions } from "../utils/propertyUtils";
import * as l10n from "@vscode/l10n";
import { useEditorFields, useEditorStore } from "../context/EditorStoreContext";
import { selectCanOpenProfileInFile } from "../store/selectors";
import { useUtilityHelpers } from "../hooks/useUtilityHelpers";

export const RenderProfileDetails = () => {
  const canOpenProfileInFile = useEditorStore(selectCanOpenProfileInFile);
  const {
    handleSetAsDefault,
    openRenameProfile,
    handleDeleteProfile,
    confirmDeleteProfile,
    pendingProfileDeletion,
    setPendingProfileDeletion,
    highlightProfileCard,
    setHighlightProfileCard,
  } = useEditorFields(
    "handleSetAsDefault",
    "openRenameProfile",
    "handleDeleteProfile",
    "confirmDeleteProfile",
    "pendingProfileDeletion",
    "setPendingProfileDeletion",
    "highlightProfileCard",
    "setHighlightProfileCard"
  );

  const onHighlightProfileCardConsumed = () => setHighlightProfileCard(false);
  const {
    selectedProfileKey,
    configurations,
    selectedTab,
    vscodeApi,
    configEditorSettings,
    sortOrderVersion,
    pendingChanges,
    renames,
    schemaValidations,
    mergedProperties,
    setPendingDefaults,
  } = useEditorFields(
    "selectedProfileKey",
    "configurations",
    "selectedTab",
    "vscodeApi",
    "configEditorSettings",
    "sortOrderVersion",
    "pendingChanges",
    "renames",
    "schemaValidations",
    "mergedProperties",
    "setPendingDefaults"
  );

  const { propertySortOrder } = configEditorSettings;

  const { isProfileDefault, getProfileType, extractPendingProfiles, isCurrentProfileUntyped } = useUtilityHelpers();

  // Ref for the card container — used to apply the blink animation.
  const cardRef = useRef<HTMLDivElement>(null);

  // Blink the entire profile card when highlightProfileCard becomes true.
  useEffect(() => {
    if (!highlightProfileCard || !cardRef.current) return;
    const card = cardRef.current;
    card.classList.add("profile-highlight-blink");
    card.addEventListener(
      "animationend",
      () => {
        card.classList.remove("profile-highlight-blink");
      },
      { once: true }
    );
    // Clear the flag as soon as the blink starts, not on animationend: an unrelated remount of
    // this tree (e.g. after a save) can tear down the card before the animation finishes, which
    // would otherwise leave highlightProfileCard stuck and replay the blink later.
    onHighlightProfileCardConsumed?.();
  }, [highlightProfileCard]);

  const profileDetailsHeader = l10n.t("Profile Details");
  return (
    <div ref={cardRef}>
      <div className="profile-heading-container">
        <h2
          title={selectedProfileKey || profileDetailsHeader}
          style={{
            margin: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "200px",
          }}
        >
          {selectedProfileKey || profileDetailsHeader}
        </h2>
        {selectedProfileKey && (
          <div className="profile-actions">
            <VscodeToolbarButton
              id="open-with-highlight"
              onClick={
                canOpenProfileInFile
                  ? () => {
                      const configPath = configurations[selectedTab!]?.configPath;
                      if (configPath) {
                        vscodeApi.postMessage({
                          command: "OPEN_CONFIG_FILE_WITH_PROFILE",
                          filePath: configPath,
                          profileKey: selectedProfileKey,
                        });
                      }
                    }
                  : undefined
              }
              aria-disabled={!canOpenProfileInFile}
              tabIndex={canOpenProfileInFile ? 0 : -1}
              title={
                canOpenProfileInFile
                  ? l10n.t("Open config file with profile highlighted")
                  : l10n.t("Save this profile before opening its location in the config file")
              }
            >
              <span className="codicon codicon-go-to-file"></span>
            </VscodeToolbarButton>
            <VscodeToolbarButton
              id="set-as-default"
              onClick={
                isCurrentProfileUntyped()
                  ? undefined
                  : () => {
                      if (isProfileDefault(selectedProfileKey)) {
                        const profileType = getProfileType(selectedProfileKey, selectedTab, configurations, pendingChanges, renames);
                        if (profileType) {
                          const configPath = configurations[selectedTab!]!.configPath;
                          setPendingDefaults((prev) => ({
                            ...prev,
                            [configPath]: {
                              ...prev[configPath],
                              [profileType]: { value: "", path: [profileType] },
                            },
                          }));
                        }
                      } else {
                        handleSetAsDefault(selectedProfileKey);
                      }
                    }
              }
              aria-disabled={isCurrentProfileUntyped()}
              tabIndex={isCurrentProfileUntyped() ? -1 : 0}
              title={
                isCurrentProfileUntyped()
                  ? l10n.t("Cannot set as default: Profile must have a valid type")
                  : isProfileDefault(selectedProfileKey)
                    ? l10n.t("Click to remove default")
                    : l10n.t("Set as default")
              }
            >
              <span className={`codicon codicon-${isProfileDefault(selectedProfileKey) ? "star-full" : "star-empty"}`}></span>
            </VscodeToolbarButton>

            <VscodeToolbarButton id="rename-profile" onClick={() => openRenameProfile()} title={l10n.t("Rename profile")}>
              <span className="codicon codicon-edit"></span>
            </VscodeToolbarButton>
            <ConfirmableDeleteButton
              isConfirming={pendingProfileDeletion === selectedProfileKey}
              confirmWrapperClassName="config-editor-flex-gap"
              deleteId="delete-profile"
              deleteTitle={l10n.t("Delete profile")}
              onRequestDelete={() => handleDeleteProfile(selectedProfileKey)}
              onConfirmDelete={() => confirmDeleteProfile(selectedProfileKey)}
              onCancel={() => setPendingProfileDeletion(null)}
            />
          </div>
        )}
      </div>
      {selectedProfileKey &&
        (() => {
          const currentConfig = configurations[selectedTab!];
          if (!currentConfig) {
            return null;
          }
          const currentConfigPath = currentConfig.configPath;
          const pendingProfiles = extractPendingProfiles(currentConfigPath);

          const effectiveProfileKey = getOriginalProfileKeyWithNested(selectedProfileKey, currentConfigPath, renames);

          const effectivePath = profileKeyToPath(selectedProfileKey);
          const savedProfile =
            getRenamedProfileKeyWithNested(effectiveProfileKey, currentConfigPath, renames) === selectedProfileKey
              ? findProfile(currentConfig.properties?.profiles, effectiveProfileKey)
              : undefined;

          const effectiveProfile = {
            ...(savedProfile || pendingProfiles[selectedProfileKey] || {}),
          };
          delete effectiveProfile.profiles;

          const propertyDescriptions =
            selectedTab !== null && currentConfig
              ? getPropertyDescriptions({ path: effectivePath, selectedTab, configurations, schemaValidations, pendingChanges, renames })
              : {};

          return (
            <div
              key={`${selectedProfileKey}-${propertySortOrder}-${sortOrderVersion}`}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: "1 1 auto",
                minHeight: 0,
                overflowY: "auto",
                overflowX: "hidden",
              }}
            >
              <RenderConfig
                obj={effectiveProfile}
                path={effectivePath}
                // `mergedProperties` covers local as well as inherited properties (its
                // entries carry a `jsonLoc` that tells the two apart), so it must reach
                // `RenderConfig` even in "hide" mode — that mode's row-hiding and disabled-input
                // behavior is already handled independently by `isPropertyFromMergedProps`
                // and `buildSortedEntries`. Nulling it here previously broke the "stored in
                // keyring" placeholder for local secure properties too, not just inherited ones.
                mergedProps={mergedProperties}
                propertyDescriptions={propertyDescriptions}
              />
            </div>
          );
        })()}
    </div>
  );
};
