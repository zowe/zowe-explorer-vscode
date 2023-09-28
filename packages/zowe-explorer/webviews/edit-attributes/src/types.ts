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
