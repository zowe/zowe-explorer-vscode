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

import type { CSSProperties } from "react";

// Color map for profile types
const profileTypeColorMap = new Map<string, string>();

export const PROFILE_TYPE_COLORS: string[] = [
    "#810D49",
    "#00735C",
    "#AB0D61",
    "#009175",
    "#D80D7B",
    "#00CBA7",
    "#FF78AD",
    "#00EBC1",
    "#00489E",
    "#8E06CD",
    "#0079FA",
    "#ED0DFD",
    "#00C2F9",
    "#86081C",
    "#B20725",
    "#DE0D2E",
    "#FF4235",
    "#FF8735",
    "#00F407",
    "#FFB935",
    "#AFFF2A",
];

export const coreTypeColors: { [key: string]: string } = {
    zosmf: "#DE0D2E",
    tso: "#00F407",
    ssh: "#FF8735",
    base: "#0079FA",
};

export const coreColors = new Set(Object.values(coreTypeColors));

// Get available colors (non-core colors) as a sorted array for deterministic selection
const getAvailableColors = (): string[] => {
    return PROFILE_TYPE_COLORS.filter((color) => !coreColors.has(color)).sort();
};

// Simple hash function to convert string to number deterministically
const hashString = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
};

export const getColorForProfileType = (profileType: string): string => {
    // Check if it's a core type first
    if (coreTypeColors[profileType]) {
        return coreTypeColors[profileType];
    }

    if (!profileTypeColorMap.has(profileType)) {
        // Get available colors (non-core colors)
        const availableColors = getAvailableColors();
        // Use hash of profile type to deterministically select a color
        const hash = hashString(profileType);
        const colorIndex = hash % availableColors.length;
        const color = availableColors[colorIndex];

        profileTypeColorMap.set(profileType, color);
    }
    return profileTypeColorMap.get(profileType)!;
};

// Determine light-theme text color based on background luminance (WCAG relative luminance).
const getTextColor = (hex: string): string => {
    const cleanHex = hex.replace("#", "");
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);

    // Convert to 0-1 range and apply gamma correction
    const rsRGB = r / 255;
    const gsRGB = g / 255;
    const bsRGB = b / 255;

    const rLinear = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
    const gLinear = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
    const bLinear = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

    // Calculate relative luminance
    const luminance = 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;

    return luminance <= 0.22 ? "white" : "black";
};

// For dark theme, lighten or darken the text color based on the original color's brightness.
const adjustColorForDarkTheme = (color: string): string => {
    const hex = color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    if (luminance > 0.7) {
        // Darken bright colors by 30%
        return `rgb(${Math.round(r * 0.7)}, ${Math.round(g * 0.7)}, ${Math.round(b * 0.7)})`;
    } else if (luminance < 0.3) {
        // Lighten dark colors by adding 40%
        return `rgb(${Math.min(255, Math.round(r + (255 - r) * 0.4))}, ${Math.min(255, Math.round(g + (255 - g) * 0.4))}, ${Math.min(
            255,
            Math.round(b + (255 - b) * 0.4)
        )})`;
    }
    // Medium colors are fine as-is
    return color;
};

/**
 * The inline style for a profile-type badge/pill, matching the current VS Code theme.
 * Shared by the tree and flat profile lists so the badge looks identical in both.
 */
export function getProfileTypeBadgeStyle(profileType: string, isLightTheme: boolean): CSSProperties {
    const bgColor = getColorForProfileType(profileType);

    if (isLightTheme) {
        return {
            fontSize: "11px",
            color: getTextColor(bgColor),
            backgroundColor: bgColor,
            border: `1px solid ${bgColor}`,
            padding: "2px 6px",
            borderRadius: "10px",
            fontWeight: "600",
            whiteSpace: "nowrap",
            flexShrink: 0,
            cursor: "pointer",
            transition: "opacity 0.2s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: "1",
        };
    }

    const textColor = adjustColorForDarkTheme(bgColor);

    return {
        fontSize: "12px",
        color: textColor,
        backgroundColor: `${bgColor}22`,
        border: `1px solid ${bgColor}66`,
        padding: "0 7px",
        borderRadius: "2em",
        fontWeight: "500",
        whiteSpace: "nowrap",
        flexShrink: 0,
        cursor: "pointer",
        transition: "background-color 0.2s ease, border-color 0.2s ease",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: "20px",
        height: "22px",
    };
}
