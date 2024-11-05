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

type LocalStorageACL = {
    [key in Definitions.LocalStorageKey | PersistenceSchemaEnum]?: StorageAccessLevel;
};

export class ZoweLocalStorage {
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
    private static storage: vscode.Memento;

    protected static expectReadable(key: keyof LocalStorageACL): void {
        if ((ZoweLocalStorage.accessControl[key] & StorageAccessLevel.Read) > 0) {
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

    protected static expectWritable(key: keyof LocalStorageACL): void {
        if ((ZoweLocalStorage.accessControl[key] & StorageAccessLevel.Write) > 0) {
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

    public static initializeZoweLocalStorage(state: vscode.Memento): void {
        ZoweLocalStorage.storage = state;
    }

    public static getValue<T>(key: keyof LocalStorageACL): T {
        ZoweLogger.trace("ZoweLocalStorage.getValue called.");
        const defaultValue = meta.contributes.configuration.properties[key]?.default;
        return ZoweLocalStorage.storage.get<T>(key, defaultValue);
    }

    public static setValue<T>(key: keyof LocalStorageACL, value: T): Thenable<void> {
        ZoweLogger.trace("ZoweLocalStorage.setValue called.");
        return ZoweLocalStorage.storage.update(key, value);
    }
}

export class LocalStorageAccess extends ZoweLocalStorage {
    private static _instance: LocalStorageAccess;

    public static get instance(): LocalStorageAccess {
        if (LocalStorageAccess._instance == null) {
            LocalStorageAccess._instance = new LocalStorageAccess();
        }

        return LocalStorageAccess._instance;
    }

    public getValue<T>(key: keyof LocalStorageACL): T | null {
        LocalStorageAccess.expectReadable(key);
        return ZoweLocalStorage.getValue(key);
    }

    public setValue<T>(key: keyof LocalStorageACL, value: T): Thenable<void> {
        LocalStorageAccess.expectWritable(key);
        return ZoweLocalStorage.setValue(key, value);
    }
}
