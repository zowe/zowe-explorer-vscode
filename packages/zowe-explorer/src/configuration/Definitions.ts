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

import * as vscode from "vscode";
import * as zosJobs from "@zowe/zos-jobs-for-zowe-sdk";
import { Types, IZoweTreeNode, imperative, ZosEncoding, IZoweTree } from "@zowe/zowe-explorer-api";
import type { DatasetTree } from "../trees/dataset/DatasetTree";
import type { JobTree } from "../trees/job/JobTree";
import type { USSTree } from "../trees/uss/USSTree";
import type { MvsCommandHandler } from "../commands/MvsCommandHandler";
import type { TsoCommandHandler } from "../commands/TsoCommandHandler";
import type { UnixCommandHandler } from "../commands/UnixCommandHandler";

export namespace Definitions {
    export type LocalFileInfo = {
        name: string;
        path: string;
    };
    export type TreeProvider = USSTree | DatasetTree | JobTree;
    export type History = {
        search: string[];
        sessions: string[];
        fileHistory: string[];
        dsTemplates?: Types.DataSetAllocTemplate[];
        favorites: string[];
        encodingHistory: string[];
    };
    export type DataSetSearchOptions = {
        caseSensitive?: boolean;
        regex?: boolean;
    };
    export type FavoriteData = {
        profileName: string;
        label: string;
        contextValue?: string;
    };
    export type ProviderFunctions = {
        ds: () => Promise<Types.IZoweDatasetTreeType>;
        uss: () => Promise<Types.IZoweUSSTreeType>;
        job: () => Promise<Types.IZoweJobTreeType>;
    };
    export type ZowePersistentFilter = {
        persistence: boolean;
        favorites: string[];
        history: string[];
        sessions: string[];
        searchHistory: string[];
        fileHistory: string[];
        encodingHistory: string[];
        templates: Types.DataSetAllocTemplate[];
        searchedKeywords: string[];
    };
    export type ReplaceDSType = "ps" | "po" | "mem";
    export type ShouldReplace = "replace" | "cancel" | "notFound";
    export interface SaveRequest {
        uploadRequest: (document: SaveRequest["savedFile"], provider: SaveRequest["fileProvider"]) => Promise<void>;
        savedFile: vscode.TextDocument;
        fileProvider: IZoweTree<IZoweTreeNode>;
    }
    export interface IZoweTreeOpts {
        label: string;
        collapsibleState: vscode.TreeItemCollapsibleState;
        parentNode?: IZoweTreeNode;
        session?: imperative.Session;
        profile?: imperative.IProfileLoaded;
        contextOverride?: string;
    }
    export interface IZoweDatasetTreeOpts extends IZoweTreeOpts {
        encoding?: ZosEncoding;
        etag?: string;
    }
    export interface IZoweUssTreeOpts extends IZoweTreeOpts {
        parentPath?: string;
        encoding?: ZosEncoding;
        etag?: string;
    }
    export interface IZoweProviders {
        ds: Types.IZoweDatasetTreeType;
        uss: Types.IZoweUSSTreeType;
        job: Types.IZoweJobTreeType;
    }
    export interface IZoweCommandProviders {
        mvs: MvsCommandHandler;
        tso: TsoCommandHandler;
        uss: UnixCommandHandler;
    }
    export interface IZoweJobTreeOpts extends IZoweTreeOpts {
        job?: zosJobs.IJob;
    }
    export interface IJobSearchCriteria {
        Owner: string | undefined;
        Prefix: string | undefined;
        JobId: string | undefined;
        Status: string | undefined;
    }
    export interface IJobStatusOption {
        key: string;
        label: string;
        value: string;
        picked: boolean;
    }
    export interface IJobPickerOption {
        key: string;
        label: string;
        value: string;
        show: boolean;
        placeHolder: string;
        validateInput?: vscode.InputBoxOptions["validateInput"];
    }
    export enum Trees {
        USS,
        MVS,
        JES,
    }
    export enum CreateDataSetTypeWithKeysEnum {
        DATA_SET_BINARY,
        DATA_SET_C,
        DATA_SET_CLASSIC,
        DATA_SET_PARTITIONED,
        DATA_SET_SEQUENTIAL,
        DATA_SET_BLANK,
    }
    export enum JobPickerTypes {
        QuerySearch = "QuerySearch",
        IdSearch = "IdSearch",
        History = "History",
    }
    export enum JobSubmitDialogOpts {
        Disabled,
        YourJobs,
        OtherUserJobs,
        AllJobs,
    }
    export enum V1MigrationStatus {
        None,
        JustMigrated,
    }
    export enum LocalStorageKey {
        CLI_LOGGER_SETTING_PRESENTED = "zowe.cliLoggerSetting.presented",
        ENCODING_HISTORY = "zowe.encodingHistory",
        SETTINGS_LOCAL_STORAGE_MIGRATED = "zowe.settings.localStorageMigrated",
        SETTINGS_OLD_SETTINGS_MIGRATED = "zowe.settings.oldSettingsMigrated",
        V1_MIGRATION_STATUS = "zowe.v1MigrationStatus",
        DS_SEARCH_OPTIONS = "zowe.dsSearchOptions",
    }
}
