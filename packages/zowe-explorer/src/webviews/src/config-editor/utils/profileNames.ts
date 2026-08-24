/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 * Shared profile-name character rules. Kept in one place so the create-profile wizard and the
 * rename modal cannot drift apart (they previously disagreed on whether "-" was allowed).
 *
 * A dot is structurally significant — profile keys are dot-delimited to express nesting — so it
 * is never valid inside a single name segment, only as a separator in a full path.
 */

/** Characters permitted in one profile name segment. */
const SEGMENT_CHARS = /^[a-zA-Z0-9_-]+$/;

/** Property names that must never appear as a profile segment (mirrors Imperative's UNSAFE_PROP_NAMES). */
export const RESERVED_PROFILE_SEGMENTS = ["__proto__", "constructor", "prototype"];

/** Strips every character that is not allowed in a single profile name segment. */
export function sanitizeProfileNameSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]/g, "");
}

/** Strips every character not allowed in a dot-delimited profile path. */
export function sanitizeProfileNamePath(value: string): string {
    return value.replace(/[^a-zA-Z0-9._-]/g, "");
}

/** Whether `name` is a usable single profile name segment. */
export function isValidProfileNameSegment(name: string): boolean {
    return SEGMENT_CHARS.test(name) && !RESERVED_PROFILE_SEGMENTS.includes(name);
}

/** Whether `path` is a usable dot-delimited profile path (every segment non-empty and valid). */
export function isValidProfileNamePath(path: string): boolean {
    const parts = path.split(".");
    if (parts.some((part) => part.trim() === "")) {
        return false;
    }
    return parts.every((part) => isValidProfileNameSegment(part.trim()));
}
