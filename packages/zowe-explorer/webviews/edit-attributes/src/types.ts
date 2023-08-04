type Permissions = Record<string, boolean>;

export type FileAttributes = Partial<{
    name: string;
    owner: string;
    directory: boolean;
    gid: number;
    group: string;
    perms: Permissions[];
}>;