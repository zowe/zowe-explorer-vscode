/*
 * This program and the accompanying materials are made available under the terms of the *
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at *
 * https://www.eclipse.org/legal/epl-v20.html                                      *
 *                                                                                 *
 * SPDX-License-Identifier: EPL-2.0                                                *
 *                                                                                 *
 * Copyright Contributors to the Zowe Project.                                     *
 *                                                                                 *
 */

import * as path from "path";
import { Logger } from "@zowe/imperative";
import * as vscode from "vscode";
import * as loggerConfig from "../log4jsconfig.json";

// Set up localization
import * as nls from "vscode-nls";
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

// Globals
export let ZOWETEMPFOLDER;
export let ZOWE_TMP_FOLDER;
export let USS_DIR;
export let DS_DIR;
export let ISTHEIA: boolean = false; // set during activate
export let LOG: Logger;
export const COMMAND_COUNT = 94;
export const CONTEXT_PREFIX = "_";
export const FAV_SUFFIX = CONTEXT_PREFIX + "fav";
export const FAV_PROFILE_CONTEXT = "profile_fav";
export const RC_SUFFIX = CONTEXT_PREFIX + "rc=";
export const VALIDATE_SUFFIX = CONTEXT_PREFIX + "validate=";
export const INFORMATION_CONTEXT = "information";
export const FAVORITE_CONTEXT = "favorite";
export const DS_FAV_CONTEXT = "ds_fav";
export const PDS_FAV_CONTEXT = "pds_fav";
export const DS_SESSION_FAV_CONTEXT = "session_fav";
export const DS_SESSION_CONTEXT = "session";
export const DS_PDS_CONTEXT = "pds";
export const DS_DS_CONTEXT = "ds";
export const DS_MEMBER_CONTEXT = "member";
export const DS_TEXT_FILE_CONTEXT = "textFile";
export const DS_FAV_TEXT_FILE_CONTEXT = "textFile_fav";
export const DS_BINARY_FILE_CONTEXT = "binaryFile";
export const DS_MIGRATED_FILE_CONTEXT = "migr";
export const USS_SESSION_CONTEXT = "ussSession";
export const USS_DIR_CONTEXT = "directory";
export const USS_FAV_DIR_CONTEXT = "directory_fav";
export const JOBS_SESSION_CONTEXT = "server";
export const JOBS_JOB_CONTEXT = "job";
export const JOBS_SPOOL_CONTEXT = "spool";
export const VSAM_CONTEXT = "vsam";
export const INACTIVE_CONTEXT = CONTEXT_PREFIX + "Inactive";
export const ACTIVE_CONTEXT = CONTEXT_PREFIX + "Active";
export const UNVERIFIED_CONTEXT = CONTEXT_PREFIX + "Unverified";
export const ICON_STATE_OPEN = "open";
export const ICON_STATE_CLOSED = "closed";
export const FILTER_SEARCH = "isFilterSearch";
export const VSCODE_APPNAME: string[] = ["Visual Studio Code", "VSCodium"];
export const ROOTPATH = path.join(__dirname, "..", "..");
export enum CreateDataSetTypeWithKeysEnum {
    DATA_SET_BINARY = 0,
    DATA_SET_C = 1,
    DATA_SET_CLASSIC = 2,
    DATA_SET_PARTITIONED = 3,
    DATA_SET_SEQUENTIAL = 4,
}
export const DATA_SET_PROPERTIES = [
    {
        key: `alcunit`,
        label: `Allocation Unit`,
        value: null,
        placeHolder: localize("createFile.attribute.alcunit", `Enter an allocation unit`),
    },
    {
        key: `avgblk`,
        label: `Average Block Length`,
        value: null,
        placeHolder: localize(
            "createFile.attribute.avgblk",
            `Enter the average block length (if allocation unit = BLK)`
        ),
    },
    {
        key: `blksize`,
        label: `Block Size`,
        value: null,
        placeHolder: localize("createFile.attribute.blksize", `Enter a block size`),
    },
    {
        key: `dataclass`,
        label: `Data Class`,
        value: null,
        placeHolder: localize("createFile.attribute.dataclass", `Enter an SMS data class`),
    },
    {
        key: `unit`,
        label: `Device Type`,
        value: null,
        placeHolder: localize("createFile.attribute.unit", `Enter a device type (unit)`),
    },
    {
        key: `dirblk`,
        label: `Directory Blocks`,
        value: null,
        placeHolder: localize("createFile.attribute.dirblk", `Enter the number of directory blocks`),
    },
    {
        key: `dsntype`,
        label: `Data Set Type (DSNTYPE)`,
        value: null,
        placeHolder: localize("createFile.attribute.dsntype", `Specify the data set type (DSNTYPE)`),
    },
    {
        key: `mgntclass`,
        label: `Management Class`,
        value: null,
        placeHolder: localize("createFile.attribute.mgntclass", `Enter the SMS management class`),
    },
    {
        key: `dsName`,
        label: `Data Set Name`,
        value: null,
        placeHolder: localize("createFile.attribute.dsName", `Enter a data set name`),
    },
    {
        key: `dsorg`,
        label: `Data Set Organization (DSORG)`,
        value: null,
        placeHolder: localize("createFile.attribute.dsorg", `Select a data set organization (DSORG)`),
    },
    {
        key: `primary`,
        label: `Primary Space`,
        value: null,
        placeHolder: localize("createFile.attribute.primary", `Enter the primary space allocation`),
    },
    {
        key: `recfm`,
        label: `Record Format`,
        value: null,
        placeHolder: localize("createFile.attribute.recfm", `Enter the data set's record format`),
    },
    {
        key: `lrecl`,
        label: `Record Length`,
        value: null,
        placeHolder: localize("createFile.attribute.lrecl", `Enter the logical record length`),
    },
    {
        key: `secondary`,
        label: `Secondary Space`,
        value: null,
        placeHolder: localize("createFile.attribute.secondary", `Enter the secondary space allocation`),
    },
    {
        key: `size`,
        label: `Size`,
        value: null,
        placeHolder: localize("createFile.attribute.size", `Enter the size of the data set`),
    },
    {
        key: `storclass`,
        label: `Storage Class`,
        value: null,
        placeHolder: localize("createFile.attribute.storclass", `Enter the SMS storage class`),
    },
    {
        key: `volser`,
        label: `Volume Serial`,
        value: null,
        placeHolder: localize(
            "createFile.attribute.volser",
            `Enter the volume serial on which the data set should be placed`
        ),
    },
];

/**
 * Defines all global variables
 * @param tempPath File path for temporary folder defined in preferences
 */
export function defineGlobals(tempPath: string | undefined) {
    // Set app name
    const appName = vscode.env.appName;
    if (appName && !this.VSCODE_APPNAME.includes(appName) && vscode.env.uiKind === vscode.UIKind.Web) {
        this.ISTHEIA = true;
    }

    // Set temp path & folder paths
    tempPath !== "" && tempPath !== undefined
        ? (ZOWETEMPFOLDER = path.join(tempPath, "temp"))
        : (ZOWETEMPFOLDER = path.join(__dirname, "..", "..", "resources", "temp"));

    ZOWE_TMP_FOLDER = path.join(ZOWETEMPFOLDER, "tmp");
    USS_DIR = path.join(ZOWETEMPFOLDER, "_U_");
    DS_DIR = path.join(ZOWETEMPFOLDER, "_D_");
}

/**
 * Initializes Imperative Logger
 * @param context The extension context
 */
export function initLogger(context: vscode.ExtensionContext) {
    for (const appenderName of Object.keys(loggerConfig.log4jsConfig.appenders)) {
        loggerConfig.log4jsConfig.appenders[appenderName].filename = path.join(
            context.extensionPath,
            loggerConfig.log4jsConfig.appenders[appenderName].filename
        );
    }
    Logger.initLogger(loggerConfig);
    this.LOG = Logger.getAppLogger();
}
