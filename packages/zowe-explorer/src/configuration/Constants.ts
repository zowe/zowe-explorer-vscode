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
    public static SETTINGS_TEMP_FOLDER_LOCATION: string;
    public static ZOWETEMPFOLDER: string;
    public static ZOWE_TMP_FOLDER: string;
    public static USS_DIR: string;
    public static DS_DIR: string;
    public static CONFIG_PATH: string;
    public static COMMAND_COUNT = 121;
    public static MAX_SEARCH_HISTORY = 5;
    public static MAX_FILE_HISTORY = 10;
    public static MS_PER_SEC = 1000;
    public static STATUS_BAR_TIMEOUT_MS = 5000;
    public static CONTEXT_PREFIX = "_";
    public static FAV_SUFFIX = Constants.CONTEXT_PREFIX + "fav";
    public static HOME_SUFFIX = Constants.CONTEXT_PREFIX + "home";
    public static FAV_PROFILE_CONTEXT = "profile_fav";
    public static RC_SUFFIX = Constants.CONTEXT_PREFIX + "rc=";
    public static VALIDATE_SUFFIX = Constants.CONTEXT_PREFIX + "validate";
    public static NO_VALIDATE_SUFFIX = Constants.CONTEXT_PREFIX + "noValidate";
    public static INFORMATION_CONTEXT = "information";
    public static FAVORITE_CONTEXT = "favorite";
    public static DS_FAV_CONTEXT = "ds_fav";
    public static PDS_FAV_CONTEXT = "pds_fav";
    public static DS_SESSION_FAV_CONTEXT = "session_fav";
    public static DS_SESSION_CONTEXT = "session";
    public static DS_PDS_CONTEXT = "pds";
    public static DS_DS_CONTEXT = "ds";
    public static DS_DS_BINARY_CONTEXT = "dsBinary";
    public static DS_MEMBER_CONTEXT = "member";
    public static DS_MEMBER_BINARY_CONTEXT = "memberBinary";
    public static DS_MIGRATED_FILE_CONTEXT = "migr";
    public static DS_FILE_ERROR_CONTEXT = "fileError";
    public static USS_SESSION_CONTEXT = "ussSession";
    public static USS_DIR_CONTEXT = "directory";
    public static USS_FAV_DIR_CONTEXT = "directory_fav";
    public static USS_TEXT_FILE_CONTEXT = "textFile";
    public static USS_FAV_TEXT_FILE_CONTEXT = "textFile_fav";
    public static USS_BINARY_FILE_CONTEXT = "binaryFile";
    public static JOBS_SESSION_CONTEXT = "server";
    public static JOBS_JOB_CONTEXT = "job";
    public static JOBS_SPOOL_CONTEXT = "spool";
    public static POLL_CONTEXT = Constants.CONTEXT_PREFIX + "polling";
    public static VSAM_CONTEXT = "vsam";
    public static INACTIVE_CONTEXT = Constants.CONTEXT_PREFIX + "Inactive";
    public static ACTIVE_CONTEXT = Constants.CONTEXT_PREFIX + "Active";
    public static UNVERIFIED_CONTEXT = Constants.CONTEXT_PREFIX + "Unverified";
    public static ICON_STATE_OPEN = "open";
    public static ICON_STATE_CLOSED = "closed";
    public static FILTER_SEARCH = "isFilterSearch";
    public static VSCODE_APPNAME: string[] = ["Visual Studio Code", "VSCodium"];
    public static ROOTPATH = path.join(__dirname, "..", "..");
    public static SETTINGS_TEMP_FOLDER_PATH = "zowe.files.temporaryDownloadsFolder.path";
    public static SETTINGS_TEMP_FOLDER_CLEANUP = "zowe.files.temporaryDownloadsFolder.cleanup";
    public static SETTINGS_TEMP_FOLDER_HIDE = "zowe.files.temporaryDownloadsFolder.hide";
    public static SETTINGS_LOGS_FOLDER_PATH = "zowe.files.logsFolder.path";
    public static SETTINGS_DS_DEFAULT_BINARY = "zowe.ds.default.binary";
    public static SETTINGS_DS_DEFAULT_C = "zowe.ds.default.c";
    public static SETTINGS_DS_DEFAULT_CLASSIC = "zowe.ds.default.classic";
    public static SETTINGS_DS_DEFAULT_PDS = "zowe.ds.default.pds";
    public static SETTINGS_DS_DEFAULT_EXTENDED = "zowe.ds.default.extended";
    public static SETTINGS_DS_DEFAULT_PS = "zowe.ds.default.ps";
    public static readonly SETTINGS_DS_TEMPLATES = "zowe.ds.templates";
    public static SETTINGS_COMMANDS_ALWAYS_EDIT = "zowe.commands.alwaysEdit";
    public static SETTINGS_AUTOMATIC_PROFILE_VALIDATION = "zowe.automaticProfileValidation";
    public static SETTINGS_SECURE_CREDENTIALS_ENABLED = "zowe.security.secureCredentialsEnabled";
    public static SETTINGS_CHECK_FOR_CUSTOM_CREDENTIAL_MANAGERS = "zowe.security.checkForCustomCredentialManagers";
    public static LOGGER_SETTINGS = "zowe.logger";
    public static EXTENDER_CONFIG: imperative.ICommandProfileTypeConfiguration[] = [];
    public static ZOWE_CLI_SCM = "@zowe/cli";
    public static MAX_DATASET_LENGTH = 44;
    public static MAX_MEMBER_LENGTH = 8;
    public static DS_NAME_REGEX_CHECK = /^[a-zA-Z#@$][a-zA-Z0-9#@$-]{0,7}(\.[a-zA-Z#@$][a-zA-Z0-9#@$-]{0,7})*$/;
    public static MEMBER_NAME_REGEX_CHECK = /^[a-zA-Z#@$][a-zA-Z0-9#@$]{0,7}$/;
    public static ACTIVATED = false;
    public static SAVED_PROFILE_CONTENTS = new Uint8Array();
    public static JOBS_MAX_PREFIX = 8;
    public static PROFILES_CACHE: Profiles;
    public static WORKSPACE_UTIL_TAB_SWITCH_DELAY = 200;
    public static WORKSPACE_UTIL_MAX_EMPTY_WINDOWS_IN_THE_ROW = 3;
    public static WORKSPACE_UTIL_FILE_SAVE_INTERVAL = 200;
    public static WORKSPACE_UTIL_FILE_SAVE_MAX_ITERATION_COUNT = 25;
    public static configurationDictionary: { [k: string]: string } = {
        "Zowe-Default-Datasets-Binary": Constants.SETTINGS_DS_DEFAULT_BINARY,
        "Zowe-Default-Datasets-C": Constants.SETTINGS_DS_DEFAULT_C,
        "Zowe-Default-Datasets-Classic": Constants.SETTINGS_DS_DEFAULT_CLASSIC,
        "Zowe-Default-Datasets-PDS": Constants.SETTINGS_DS_DEFAULT_PDS,
        "Zowe-Default-Datasets-Extended": Constants.SETTINGS_DS_DEFAULT_EXTENDED,
        "Zowe-Default-Datasets-PS": Constants.SETTINGS_DS_DEFAULT_PS,
        "Zowe-Temp-Folder-Location": Constants.SETTINGS_TEMP_FOLDER_PATH,
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
