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

/**
 * Converts a hex color to RGB values
 * @param hex - Hex color string (e.g., "#FF0000" or "FF0000")
 * @returns RGB values as {r, g, b} or null if invalid
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    // Remove # if present
    const cleanHex = hex.replace("#", "");

    // Validate hex format
    if (!/^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
        return null;
    }

    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);

    return { r, g, b };
}

/**
 * Calculates the relative luminance of a color using the sRGB formula
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @returns Luminance value (0-1)
 */
function calculateLuminance(r: number, g: number, b: number): number {
    // Convert to 0-1 range
    const rsRGB = r / 255;
    const gsRGB = g / 255;
    const bsRGB = b / 255;

    // Apply gamma correction
    const rLinear = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
    const gLinear = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
    const bLinear = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

    // Calculate relative luminance
    return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Determines the appropriate text color (black or white) based on background color luminance
 * @param backgroundColor - Hex color string (e.g., "#FF0000")
 * @returns "black" or "white"
 */
export function getContrastTextColor(backgroundColor: string): "black" | "white" {
    const rgb = hexToRgb(backgroundColor);
    if (!rgb) {
        return "black";
    }
    const luminance = calculateLuminance(rgb.r, rgb.g, rgb.b);
    return luminance <= 0.16 ? "white" : "black";
}
