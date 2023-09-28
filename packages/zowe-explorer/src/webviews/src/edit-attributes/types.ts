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

export type PermissionSet = {
    read: boolean;
    write: boolean;
    execute: boolean;
};

export type FilePermissions = Record<"user" | "group" | "all", PermissionSet>;

export const PERMISSION_GROUPS: (keyof FilePermissions)[] = ["user", "group", "all"];
export const PERMISSION_TYPES: (keyof PermissionSet)[] = ["read", "write", "execute"];

export type FileAttributes = {
    name: string;
    owner: string;
    directory: boolean;
    group: string;
    perms: FilePermissions;
    tag?: string;
};
