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

export const MIN_PROFILES_WIDTH = 200;
export const MIN_DETAILS_WIDTH = 300;
export const PROFILE_DIVIDER_WIDTH = 22;

/** Apply the caller's sizing policy while leaving the details panel to fill the remaining space. */
export function applyProfilePanelWidth(panel: HTMLElement, desiredWidth: number, maxProfilesWidth: number): void {
    const profiles = panel.querySelector<HTMLElement>(".profiles-section");
    const details = panel.querySelector<HTMLElement>(".profile-details-section");
    if (!profiles || !details) return;
    const width = Math.max(MIN_PROFILES_WIDTH, Math.min(maxProfilesWidth, desiredWidth));
    profiles.style.width = `${width}px`;
    profiles.style.flex = "0 0 auto";
    profiles.style.maxWidth = `${maxProfilesWidth}px`;
    details.style.width = "";
    details.style.flex = "1";
    details.style.maxWidth = "";
}
