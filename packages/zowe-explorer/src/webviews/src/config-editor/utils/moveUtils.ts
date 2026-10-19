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

import { IConfigLayer } from "../types";

export function updateDefaultsAfterRename(
    layerActive: () => IConfigLayer,
    originalKey: string,
    newKey: string,
    updateTeamConfig?: (defaults: Record<string, string>) => void
): void {
    try {
        const currentLayer = layerActive();
        const defaults = currentLayer.properties.defaults;

        if (!defaults) {
            return;
        }

        let hasChanges = false;
        const updatedDefaults = { ...defaults };

        // Check each default entry
        Object.entries(updatedDefaults).forEach(([profileType, profileName]) => {
            if (typeof profileName === "string") {
                // Check if this profile was a default
                if (profileName === originalKey) {
                    // Update the default to reference the new profile
                    updatedDefaults[profileType] = newKey;
                    hasChanges = true;
                }

                // Check if any child profiles of the renamed profile were defaults
                // This handles cases like: tso.zosmf is default, tso is renamed to tso1, so tso1.zosmf should remain default
                if (profileName.startsWith(originalKey + ".")) {
                    const childPath = profileName.substring(originalKey.length + 1);
                    const newChildDefault = newKey + "." + childPath;
                    updatedDefaults[profileType] = newChildDefault;
                    hasChanges = true;
                }
            }
        });

        if (hasChanges) {
            currentLayer.properties.defaults = updatedDefaults;

            if (updateTeamConfig) {
                updateTeamConfig(updatedDefaults);
            }
        }
    } catch (error) {
        console.warn(`Failed to update defaults after profile rename: ${error}`);
    }
}
