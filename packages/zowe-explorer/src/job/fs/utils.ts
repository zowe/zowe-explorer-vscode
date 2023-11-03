import { FsEntry } from "@zowe/zowe-explorer-api";
import { JobEntry, SpoolEntry } from "./types";

// TODO: find a better way of checking the entry
// Might just want to add an enum that specifies the type of entry in the Jobs provider

export function isJobEntry(entry: FsEntry): entry is JobEntry {
    return entry != null && entry["job"] !== undefined;
}

export function isSpoolEntry(entry: FsEntry): entry is SpoolEntry {
    return entry != null && entry["wasAccessed"] !== undefined;
}