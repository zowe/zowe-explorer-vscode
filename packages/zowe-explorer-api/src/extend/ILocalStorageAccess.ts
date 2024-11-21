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

export interface ILocalStorageAccess {
    /**
     * @returns The list of readable keys from the access facility
     */
    getReadableKeys(): string[];

    /**
     * @returns The list of writable keys from the access facility
     */
    getWritableKeys(): string[];

    /**
     * Retrieve the value from local storage for the given key.
     * @param key A readable key
     * @returns The value if it exists in local storage, or `undefined` otherwise
     * @throws If the extender does not have appropriate read permissions for the given key
     */
    getValue<T>(key: string): T;

    /**
     * Set a value in local storage for the given key.
     * @param key A writable key
     * @param value The new value for the given key to set in local storage
     * @throws If the extender does not have appropriate write permissions for the given key
     */
    setValue<T>(key: string, value: T): Thenable<void>;
}
