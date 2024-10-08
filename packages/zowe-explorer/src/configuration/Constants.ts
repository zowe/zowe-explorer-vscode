/* eslint-disable no-magic-numbers */
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

import * as path from "path";
import * as vscode from "vscode";
import { imperative, PersistenceSchemaEnum } from "@zowe/zowe-explorer-api";
import type { Profiles } from "./Profiles";

export class Constants {
    public static readonly COMMAND_COUNT = 99;
    public static readonly MAX_SEARCH_HISTORY = 5;
    public static readonly MAX_FILE_HISTORY = 10;
    public static readonly MS_PER_SEC = 1000;
    public static readonly STATUS_BAR_TIMEOUT_MS = 5000;
    public static readonly CONTEXT_PREFIX = "_";
    public static readonly FAV_SUFFIX = Constants.CONTEXT_PREFIX + "fav";
    public static readonly HOME_SUFFIX = Constants.CONTEXT_PREFIX + "home";
    public static readonly FAV_PROFILE_CONTEXT = "profile_fav";
    public static readonly RC_SUFFIX = Constants.CONTEXT_PREFIX + "rc=";
    public static readonly VALIDATE_SUFFIX = Constants.CONTEXT_PREFIX + "validate";
    public static readonly NO_VALIDATE_SUFFIX = Constants.CONTEXT_PREFIX + "noValidate";
    public static readonly INFORMATION_CONTEXT = "information";
    public static readonly FAVORITE_CONTEXT = "favorite";
    public static readonly DS_FAV_CONTEXT = "ds_fav";
    public static readonly PDS_FAV_CONTEXT = "pds_fav";
    public static readonly DS_SESSION_FAV_CONTEXT = "session_fav";
    public static readonly DS_SESSION_CONTEXT = "session";
    public static readonly DS_PDS_CONTEXT = "pds";
    public static readonly DS_DS_CONTEXT = "ds";
    public static readonly DS_DS_BINARY_CONTEXT = "dsBinary";
    public static readonly DS_MEMBER_CONTEXT = "member";
    public static readonly DS_MEMBER_BINARY_CONTEXT = "memberBinary";
    public static readonly DS_MIGRATED_FILE_CONTEXT = "migr";
    public static readonly DS_FILE_ERROR_CONTEXT = "fileError";
    public static readonly DS_FILE_ERROR_MEMBER_CONTEXT = "fileError_member";
    public static readonly USS_SESSION_CONTEXT = "ussSession";
    public static readonly USS_DIR_CONTEXT = "directory";
    public static readonly USS_FAV_DIR_CONTEXT = "directory_fav";
    public static readonly USS_TEXT_FILE_CONTEXT = "textFile";
    public static readonly USS_FAV_TEXT_FILE_CONTEXT = "textFile_fav";
    public static readonly USS_BINARY_FILE_CONTEXT = "binaryFile";
    public static readonly JOBS_SESSION_CONTEXT = "server";
    public static readonly JOBS_JOB_CONTEXT = "job";
    public static readonly JOBS_SPOOL_CONTEXT = "spool";
    public static readonly POLL_CONTEXT = Constants.CONTEXT_PREFIX + "polling";
    public static readonly VSAM_CONTEXT = "vsam";
    public static readonly INACTIVE_CONTEXT = Constants.CONTEXT_PREFIX + "Inactive";
    public static readonly ACTIVE_CONTEXT = Constants.CONTEXT_PREFIX + "Active";
    public static readonly UNVERIFIED_CONTEXT = Constants.CONTEXT_PREFIX + "Unverified";
    public static readonly ICON_STATE_OPEN = "open";
    public static readonly ICON_STATE_CLOSED = "closed";
    public static readonly FILTER_SEARCH = "isFilterSearch";
    public static readonly VSCODE_APPNAME: string[] = ["Visual Studio Code", "VSCodium"];
    public static ROOTPATH = path.join(__dirname, "..", "..");
    public static readonly SETTINGS_LOGS_FOLDER_PATH = "zowe.files.logsFolder.path";
    public static readonly SETTINGS_DS_DEFAULT_BINARY = "zowe.ds.default.binary";
    public static readonly SETTINGS_DS_DEFAULT_C = "zowe.ds.default.c";
    public static readonly SETTINGS_DS_DEFAULT_CLASSIC = "zowe.ds.default.classic";
    public static readonly SETTINGS_DS_DEFAULT_PDS = "zowe.ds.default.pds";
    public static readonly SETTINGS_DS_DEFAULT_EXTENDED = "zowe.ds.default.extended";
    public static readonly SETTINGS_DS_DEFAULT_PS = "zowe.ds.default.ps";
    public static readonly SETTINGS_DS_TEMPLATES = "zowe.ds.templates";
    public static readonly SETTINGS_COMMANDS_ALWAYS_EDIT = "zowe.commands.alwaysEdit";
    public static readonly SETTINGS_AUTOMATIC_PROFILE_VALIDATION = "zowe.automaticProfileValidation";
    public static readonly SETTINGS_SECURE_CREDENTIALS_ENABLED = "zowe.security.secureCredentialsEnabled";
    public static readonly SETTINGS_CHECK_FOR_CUSTOM_CREDENTIAL_MANAGERS = "zowe.security.checkForCustomCredentialManagers";
    public static readonly LOGGER_SETTINGS = "zowe.logger";
    public static EXTENDER_CONFIG: imperative.ICommandProfileTypeConfiguration[] = [];
    public static readonly ZOWE_CLI_SCM = "@zowe/cli";
    public static readonly MAX_DATASET_LENGTH = 44;
    public static readonly MAX_MEMBER_LENGTH = 8;
    public static DS_NAME_REGEX_CHECK = /^[a-zA-Z#@$][a-zA-Z0-9#@$-]{0,7}(\.[a-zA-Z#@$][a-zA-Z0-9#@$-]{0,7})*$/;
    public static MEMBER_NAME_REGEX_CHECK = /^[a-zA-Z#@$][a-zA-Z0-9#@$]{0,7}$/;
    public static ACTIVATED = false;
    public static SAVED_PROFILE_CONTENTS = new Map<string, Buffer>();
    public static IGNORE_VAULT_CHANGE = false;
    public static readonly JOBS_MAX_PREFIX = 8;
    public static PROFILES_CACHE: Profiles;
    public static readonly WORKSPACE_UTIL_TAB_SWITCH_DELAY = 200;
    public static readonly WORKSPACE_UTIL_MAX_EMPTY_WINDOWS_IN_THE_ROW = 3;
    public static readonly WORKSPACE_UTIL_FILE_SAVE_INTERVAL = 200;
    public static readonly WORKSPACE_UTIL_FILE_SAVE_MAX_ITERATION_COUNT = 25;
    public static configurationDictionary: { [k: string]: string } = {
        "Zowe-Default-Datasets-Binary": Constants.SETTINGS_DS_DEFAULT_BINARY,
        "Zowe-Default-Datasets-C": Constants.SETTINGS_DS_DEFAULT_C,
        "Zowe-Default-Datasets-Classic": Constants.SETTINGS_DS_DEFAULT_CLASSIC,
        "Zowe-Default-Datasets-PDS": Constants.SETTINGS_DS_DEFAULT_PDS,
        "Zowe-Default-Datasets-Extended": Constants.SETTINGS_DS_DEFAULT_EXTENDED,
        "Zowe-Default-Datasets-PS": Constants.SETTINGS_DS_DEFAULT_PS,
        "Zowe Commands: History": PersistenceSchemaEnum.Commands,
        "Zowe Commands: Always edit": Constants.SETTINGS_COMMANDS_ALWAYS_EDIT,
        "Zowe-Automatic-Validation": Constants.SETTINGS_AUTOMATIC_PROFILE_VALIDATION,
        "Zowe-DS-Persistent": PersistenceSchemaEnum.Dataset,
        "Zowe-USS-Persistent": PersistenceSchemaEnum.USS,
        "Zowe-Jobs-Persistent": PersistenceSchemaEnum.Job,
    };
    public static DATA_SET_PROPERTIES = [
        {
            key: `alcunit`,
            label: `Allocation Unit`,
            value: null,
            placeHolder: vscode.l10n.t(`Enter an allocation unit`),
        },
        {
            key: `avgblk`,
            label: `Average Block Length`,
            value: null,
            type: `number`,
            placeHolder: vscode.l10n.t(`Enter the average block length (if allocation unit = BLK)`),
        },
        {
            key: `blksize`,
            label: `Block Size`,
            value: null,
            type: `number`,
            placeHolder: vscode.l10n.t(`Enter a block size`),
        },
        {
            key: `dataclass`,
            label: `Data Class`,
            value: null,
            placeHolder: vscode.l10n.t(`Enter an SMS data class`),
        },
        {
            key: `unit`,
            label: `Device Type`,
            value: null,
            placeHolder: vscode.l10n.t(`Enter a device type (unit)`),
        },
        {
            key: `dirblk`,
            label: `Directory Blocks`,
            value: null,
            type: `number`,
            placeHolder: vscode.l10n.t(`Enter the number of directory blocks`),
        },
        {
            key: `dsntype`,
            label: `Data Set Type (DSNTYPE)`,
            value: null,
            placeHolder: vscode.l10n.t(`Specify the data set type (DSNTYPE)`),
        },
        {
            key: `mgntclass`,
            label: `Management Class`,
            value: null,
            placeHolder: vscode.l10n.t(`Enter the SMS management class`),
        },
        {
            key: `dsName`,
            label: `Data Set Name`,
            value: null,
            placeHolder: vscode.l10n.t(`Enter a data set name`),
        },
        {
            key: `dsorg`,
            label: `Data Set Organization (DSORG)`,
            value: null,
            placeHolder: vscode.l10n.t(`Select a data set organization (DSORG)`),
        },
        {
            key: `primary`,
            label: `Primary Space`,
            value: null,
            type: `number`,
            placeHolder: vscode.l10n.t(`Enter the primary space allocation`),
        },
        {
            key: `recfm`,
            label: `Record Format`,
            value: null,
            placeHolder: vscode.l10n.t(`Enter the data set's record format`),
        },
        {
            key: `lrecl`,
            label: `Record Length`,
            value: null,
            type: `number`,
            placeHolder: vscode.l10n.t(`Enter the logical record length`),
        },
        {
            key: `secondary`,
            label: `Secondary Space`,
            value: null,
            type: `number`,
            placeHolder: vscode.l10n.t(`Enter the secondary space allocation`),
        },
        {
            key: `size`,
            label: `Size`,
            value: null,
            placeHolder: vscode.l10n.t(`Enter the size of the data set`),
        },
        {
            key: `storclass`,
            label: `Storage Class`,
            value: null,
            placeHolder: vscode.l10n.t(`Enter the SMS storage class`),
        },
        {
            key: `volser`,
            label: `Volume Serial`,
            value: null,
            placeHolder: vscode.l10n.t(`Enter the volume serial on which the data set should be placed`),
        },
    ];
    public static JOB_STATUS = [
        {
            key: `All`,
            label: `*`,
            value: null,
            picked: true,
        },
        {
            key: `Active`,
            label: `Active`,
            value: `Active`,
            picked: false,
        },
        {
            key: `Input`,
            label: `Input`,
            value: null,
            picked: false,
        },
        {
            key: `Output`,
            label: `Output`,
            value: null,
            picked: false,
        },
    ];
    public static JOB_STATUS_UNSUPPORTED = [
        {
            key: `All`,
            label: `*`,
            value: null,
            picked: true,
        },
    ];
    public static SEPARATORS = {
        BLANK: { kind: vscode.QuickPickItemKind.Separator, label: "" },
        RECENT: { kind: vscode.QuickPickItemKind.Separator, label: vscode.l10n.t("Recent") },
        RECENT_FILTERS: { kind: vscode.QuickPickItemKind.Separator, label: vscode.l10n.t(`Recent Filters`) },
        OPTIONS: { kind: vscode.QuickPickItemKind.Separator, label: vscode.l10n.t(`Options`) },
    };
    public static JOB_SUBMIT_DIALOG_OPTS = [
        vscode.l10n.t("Disabled"),
        vscode.l10n.t("Your jobs"),
        vscode.l10n.t("Other user jobs"),
        vscode.l10n.t("All jobs"),
    ];
    public static SORT_DIRS: string[] = [vscode.l10n.t("Ascending"), vscode.l10n.t("Descending")];
    public static HISTORY_VIEW_TABS = {
        DS: "ds-panel-tab",
        USS: "uss-panel-tab",
        JOBS: "jobs-panel-tab",
    };
}
