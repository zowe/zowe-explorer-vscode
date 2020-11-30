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

// Globals
export let ZOWETEMPFOLDER;
export let ZOWE_TMP_FOLDER;
export let USS_DIR;
export let DS_DIR;
export let ISTHEIA: boolean = false; // set during activate
export let LOG: Logger;
export const COMMAND_COUNT = 84;
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
export const VSCODE_APPNAME: string[] = ["Visual Studio Code", "VSCodium"];
export const ROOTPATH = path.join(__dirname, "..", "..");
export const DATA_SET_PROPERTIES = [
    {
        key: `volser`,
        label: `Volume Serial`,
        value: null,
        placeHolder: `Enter the volume serial on which the data set should be placed`,
    },
    {
        key: `unit`,
        label: `Device Type`,
        value: null,
        placeHolder: `Enter a device type (unit)`,
    },
    {
        key: `dsorg`,
        label: `Node Type`,
        value: null,
        placeHolder: `Select a node type`,
    },
    {
        key: `alcunit`,
        label: `Allocation Unit`,
        value: null,
        placeHolder: `Enter an allocation unit`,
    },
    {
        key: `primary`,
        label: `Primary Space`,
        value: null,
        placeHolder: `Enter the primary space allocation`,
    },
    {
        key: `secondary`,
        label: `Secondary Space`,
        value: null,
        placeHolder: `Enter the secondary space allocation`,
    },
    {
        key: `dirblk`,
        label: `Directory Blocks`,
        value: null,
        placeHolder: `Enter the number of directory blocks`,
    },
    {
        key: `avgblk`,
        label: `Directory Blocks`,
        value: null,
        placeHolder: `Enter the average block length (if allocation unit = BLK)`,
    },
    {
        key: `recfm`,
        label: `Record Format`,
        value: null,
        placeHolder: `Enter the data set's record format`,
    },
    {
        key: `blksize`,
        label: `Block Size`,
        value: null,
        placeHolder: `Enter a block size`,
    },
    {
        key: `lrecl`,
        label: `Record Length`,
        value: null,
        placeHolder: `Enter the logical record length`,
    },
    {
        key: `storclass`,
        label: `Storage Class`,
        value: null,
        placeHolder: `Enter the SMS storage class`,
    },
    {
        key: `mgntclass`,
        label: `Management Class`,
        value: null,
        placeHolder: `Enter the SMS management class`,
    },
    {
        key: `dataclass`,
        label: `Data Class`,
        value: null,
        placeHolder: `Enter an SMS data class`,
    },
    {
        key: `dsntype`,
        label: `DSN Type`,
        value: null,
        placeHolder: `Specify the DSN type`,
    },
    {
        key: `showAttributes`,
        label: `Show Attributes`,
        value: null,
        placeHolder: `Show the full allocation attributes?`,
    },
    {
        key: `size`,
        label: `Size`,
        value: null,
        placeHolder: `Enter the size of the data set`,
    },
    {
        key: `nodeLabel`,
        label: `Node Label`,
        value: null,
        placeHolder: `Enter a node label`,
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
