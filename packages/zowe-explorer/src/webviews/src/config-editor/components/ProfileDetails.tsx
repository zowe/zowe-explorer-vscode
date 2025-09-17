import { createStateVariables, useConsolidatedState } from "../App";
import {
  extractPendingProfiles,
  flattenProfiles,
  getOriginalProfileKeyWithNested,
  getProfileType,
  handleDeleteProfile,
  isProfileDefault,
} from "../utils";
import { handleSetAsDefault } from "../utils/defaultsUtils";
import { updateShowMergedProperties } from "../utils/storageUtils";

export const ProfileDetails = (vscodeApi: any) => {
  const { state, setState, ...refs } = useConsolidatedState();
  const {
    selectedProfileKey,
    configurations,
    selectedTab,
    pendingChanges,
    renames,
    showMergedProperties,
    renameCounts,
    mergedProperties,
    propertySortOrder,
    sortOrderVersion,
    setPendingDefaults,
    setRenameProfileModalOpen,
  } = createStateVariables(state, setState);

  const MAX_RENAMES_PER_PROFILE = 1;
  return (
    <div>
      <div className="profile-heading-container">
        <h2 title={selectedProfileKey || "Profile Details"}>{selectedProfileKey || "Profile Details"}</h2>
        {selectedProfileKey && (
          <div className="profile-actions">
            <button
              className="profile-action-button"
              onClick={() => {
                const configPath = configurations[selectedTab!]?.configPath;
                if (configPath) {
                  vscodeApi.postMessage({
                    command: "OPEN_CONFIG_FILE_WITH_PROFILE",
                    filePath: configPath,
                    profileKey: selectedProfileKey,
                  });
                }
              }}
              title="Open config file with profile highlighted"
            >
              <span className="codicon codicon-go-to-file"></span>
            </button>
            <button
              className="profile-action-button"
              onClick={() => {
                if (isProfileDefault(selectedProfileKey)) {
                  // If already default, deselect it by setting to empty
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
                  // Set as default
                  handleSetAsDefault(selectedProfileKey);
                }
              }}
              title={isProfileDefault(selectedProfileKey) ? "Click to remove default" : "Set as default"}
            >
              <span className={`codicon codicon-${isProfileDefault(selectedProfileKey) ? "star-full" : "star-empty"}`}></span>
            </button>
            <button
              className="profile-action-button"
              onClick={() => updateShowMergedProperties(!showMergedProperties, vscodeApi)}
              title={showMergedProperties ? "Hide merged properties" : "Show merged properties"}
            >
              <span className={`codicon codicon-${showMergedProperties ? "eye-closed" : "eye"}`}></span>
            </button>
            <button
              className="profile-action-button"
              onClick={() => setRenameProfileModalOpen(true)}
              title={(() => {
                if (selectedProfileKey) {
                  const configPath = configurations[selectedTab!]?.configPath;
                  if (configPath) {
                    // Get the original profile key to check rename limit
                    const originalProfileKey = getOriginalProfileKeyWithNested(selectedProfileKey, configPath, renames);
                    const currentRenameCount = renameCounts[configPath]?.[originalProfileKey] || 0;
                    if (currentRenameCount >= MAX_RENAMES_PER_PROFILE) {
                      return `Profile has already been renamed once. Save and refresh to reset.`;
                    }
                  }
                }
                return "Rename profile";
              })()}
              disabled={(() => {
                if (selectedProfileKey) {
                  const configPath = configurations[selectedTab!]?.configPath;
                  if (configPath) {
                    // Get the original profile key to check rename limit
                    const originalProfileKey = getOriginalProfileKeyWithNested(selectedProfileKey, configPath, renames);
                    const currentRenameCount = renameCounts[configPath]?.[originalProfileKey] || 0;
                    return currentRenameCount >= MAX_RENAMES_PER_PROFILE;
                  }
                }
                return false;
              })()}
              style={(() => {
                if (selectedProfileKey) {
                  const configPath = configurations[selectedTab!]?.configPath;
                  if (configPath) {
                    // Get the original profile key to check rename limit
                    const originalProfileKey = getOriginalProfileKeyWithNested(selectedProfileKey, configPath, renames);
                    const currentRenameCount = renameCounts[configPath]?.[originalProfileKey] || 0;
                    if (currentRenameCount >= MAX_RENAMES_PER_PROFILE) {
                      return { opacity: 0.5, cursor: "not-allowed" };
                    }
                  }
                }
                return {};
              })()}
            >
              <span className="codicon codicon-edit"></span>
            </button>
            <button className="profile-action-button" onClick={() => handleDeleteProfile(selectedProfileKey, vscodeApi)} title="Delete profile">
              <span className="codicon codicon-trash"></span>
            </button>
          </div>
        )}
      </div>
      {selectedProfileKey &&
        (() => {
          const currentConfig = configurations[selectedTab!];
          if (!currentConfig) {
            return null;
          }
          const flatProfiles = flattenProfiles(currentConfig.properties?.profiles || {});
          const configPath = currentConfig.configPath;

          // Use the helper function to extract pending profiles
          const pendingProfiles = extractPendingProfiles(configPath);

          // For profile data lookup, we need to find where the data is actually stored in the original configuration
          // The data is always stored at the original location before any renames
          // We need to reverse all renames to get to the original location
          let effectiveProfileKey = selectedProfileKey;

          // Apply reverse renames step by step
          if (renames[configPath] && Object.keys(renames[configPath]).length > 0) {
            const configRenames = renames[configPath];

            // Sort renames by length of newKey (longest first) to handle nested renames correctly
            const sortedRenames = Object.entries(configRenames).sort(([, a], [, b]) => b.length - a.length);

            let changed = true;

            // Keep applying reverse renames until no more changes
            while (changed) {
              changed = false;

              // Process renames from longest to shortest to handle nested cases
              for (const [originalKey, newKey] of sortedRenames) {
                // Check for exact match
                if (effectiveProfileKey === newKey) {
                  effectiveProfileKey = originalKey;
                  changed = true;
                  break;
                }

                // Check for partial matches (parent renames affecting children)
                if (effectiveProfileKey.startsWith(newKey + ".")) {
                  effectiveProfileKey = effectiveProfileKey.replace(newKey + ".", originalKey + ".");
                  changed = true;
                  break;
                }
              }
            }
          }

          let effectivePath: string[];

          // Construct the profile path using the effective profile key
          const effectiveProfilePathParts = effectiveProfileKey.split(".");
          if (effectiveProfilePathParts.length === 1) {
            // Top-level profile
            effectivePath = ["profiles", effectiveProfileKey];
          } else {
            // Nested profile - need to construct path like ["profiles", "project_base", "profiles", "tso"]
            effectivePath = ["profiles"];
            for (let i = 0; i < effectiveProfilePathParts.length; i++) {
              effectivePath.push(effectiveProfilePathParts[i]);
              if (i < effectiveProfilePathParts.length - 1) {
                effectivePath.push("profiles");
              }
            }
          }

          // Pass the effective profile object (without pending changes) to renderConfig
          // so that renderConfig can properly combine existing and pending changes
          // For newly created profiles, use the pending profile data as the base
          const effectiveProfile = flatProfiles[effectiveProfileKey] || pendingProfiles[effectiveProfileKey] || {};

          // Check if this profile has pending renames - if so, don't show merged properties
          // We need to check if the selected profile key is a renamed version of another profile
          // OR if any of its parent profiles have been renamed
          Object.values(renames[configPath] || {}).some((newKey) => {
            // Check if this profile is directly renamed
            if (newKey === selectedProfileKey) return true;

            // Check if any parent profile has been renamed
            const profileParts = selectedProfileKey.split(".");
            for (let i = 1; i <= profileParts.length; i++) {
              const parentKey = profileParts.slice(0, i).join(".");
              if (Object.values(renames[configPath] || {}).some((renamedKey) => renamedKey === parentKey)) {
                return true;
              }
            }
            return false;
          });
          // We can still show merged properties even with parent renames, as long as we request them
          // using the correct profile name (which getProfileNameForMergedProperties handles)
          const shouldShowMergedProperties = showMergedProperties;
          console.log("test");
          return (
            <div key={`${selectedProfileKey}-${propertySortOrder}-${sortOrderVersion}`}>
              {/* {renderConfig(effectiveProfile, effectivePath, shouldShowMergedProperties ? mergedProperties : null)} */ "help"}
            </div>
          );
        })()}
    </div>
  );
};
