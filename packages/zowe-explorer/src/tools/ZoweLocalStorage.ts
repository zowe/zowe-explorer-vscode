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
import * as meta from "../../package.json";
import { ZoweLogger } from "./ZoweLogger";
import { PersistenceSchemaEnum } from "@zowe/zowe-explorer-api";
import { Definitions } from "../configuration/Definitions";

enum StorageAccessLevel {
    None = 0,
    Read = 1 << 0,
    Write = 1 << 1,
}

type LocalStorageKey = Definitions.LocalStorageKey | PersistenceSchemaEnum;

type LocalStorageACL = {
    [key in LocalStorageKey]?: StorageAccessLevel;
};

export class ZoweLocalStorage {
    private static globalState: vscode.Memento;
    private static workspaceState?: vscode.Memento;

    public static initializeZoweLocalStorage(globalState: vscode.Memento, workspaceState?: vscode.Memento): void {
        ZoweLocalStorage.globalState = globalState;
        ZoweLocalStorage.workspaceState = workspaceState;
    }

    public static getValue<T>(key: keyof LocalStorageACL): T {
        ZoweLogger.trace("ZoweLocalStorage.getValue called");
        const defaultValue = meta.contributes.configuration.properties[key]?.default;
        return ZoweLocalStorage.workspaceState.get<T>(key, defaultValue) ?? ZoweLocalStorage.globalState.get<T>(key, defaultValue);
    }

    public static setValue<T>(key: keyof LocalStorageACL, value: T, setInWorkspace?: boolean): Thenable<void> {
        ZoweLogger.trace("ZoweLocalStorage.setValue called.");
        return setInWorkspace && ZoweLocalStorage.workspaceState
            ? ZoweLocalStorage.workspaceState.update(key, value)
            : ZoweLocalStorage.globalState.update(key, value);
    }
}

export class LocalStorageAccess extends ZoweLocalStorage {
    private static _instance: LocalStorageAccess;
    private static accessControl: LocalStorageACL = {
        [Definitions.LocalStorageKey.CLI_LOGGER_SETTING_PRESENTED]: StorageAccessLevel.Read,
        [Definitions.LocalStorageKey.SETTINGS_LOCAL_STORAGE_MIGRATED]: StorageAccessLevel.Read,
        [Definitions.LocalStorageKey.SETTINGS_OLD_SETTINGS_MIGRATED]: StorageAccessLevel.Read,
        [Definitions.LocalStorageKey.ENCODING_HISTORY]: StorageAccessLevel.Read | StorageAccessLevel.Write,
        [PersistenceSchemaEnum.Dataset]: StorageAccessLevel.Read | StorageAccessLevel.Write,
        [PersistenceSchemaEnum.USS]: StorageAccessLevel.Read | StorageAccessLevel.Write,
        [PersistenceSchemaEnum.Job]: StorageAccessLevel.Read | StorageAccessLevel.Write,
        [PersistenceSchemaEnum.Commands]: StorageAccessLevel.Read | StorageAccessLevel.Write,
        [Definitions.LocalStorageKey.V1_MIGRATION_STATUS]: StorageAccessLevel.None,
    };

    private static expectReadable(key: keyof LocalStorageACL): void {
        if ((LocalStorageAccess.accessControl[key] & StorageAccessLevel.Read) > 0) {
            return;
        }

        throw new Error(
            vscode.l10n.t({
                message: "Insufficient read permissions for {0} in local storage.",
                args: [key],
                comment: "Local storage key",
            })
        );
    }

    private static expectWritable(key: keyof LocalStorageACL): void {
        if ((LocalStorageAccess.accessControl[key] & StorageAccessLevel.Write) > 0) {
            return;
        }

        throw new Error(
            vscode.l10n.t({
                message: "Insufficient write permissions for {0} in local storage.",
                args: [key],
                comment: "Local storage key",
            })
        );
    }

    public static get instance(): LocalStorageAccess {
        if (LocalStorageAccess._instance == null) {
            LocalStorageAccess._instance = new LocalStorageAccess();
        }

        return LocalStorageAccess._instance;
    }

    public static getReadableKeys(): LocalStorageKey[] {
        return Object.keys(LocalStorageAccess.accessControl).filter(
            (k) => LocalStorageAccess.accessControl[k] & StorageAccessLevel.Read
        ) as LocalStorageKey[];
    }

    public static getWritableKeys(): LocalStorageKey[] {
        return Object.keys(LocalStorageAccess.accessControl).filter(
            (k) => LocalStorageAccess.accessControl[k] & StorageAccessLevel.Write
        ) as LocalStorageKey[];
    }

    public static getValue<T>(key: keyof LocalStorageACL): T | null {
        ZoweLogger.trace(`LocalStorageAccess.getValue called with key ${key}.`);
        LocalStorageAccess.expectReadable(key);
        return ZoweLocalStorage.getValue(key);
    }

    public static setValue<T>(key: keyof LocalStorageACL, value: T): Thenable<void> {
        ZoweLogger.trace(`LocalStorageAccess.setValue called with key ${key}.`);
        LocalStorageAccess.expectWritable(key);
        return ZoweLocalStorage.setValue(key, value);
    }
}
