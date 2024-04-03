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

import { IJob } from "@zowe/zos-jobs-for-zowe-sdk";
import { Types, ZosEncoding, ZoweTreeNodeActions } from "..";
import { createStore, StoreApi } from "zustand/vanilla";
import { Uri } from "vscode";

export interface BaseState {
    /**
     * Any ongoing actions that must be awaited before continuing
     */
    ongoingActions?: Record<ZoweTreeNodeActions.Interactions | string, Promise<any>>;
}

export interface DatasetState extends BaseState {
    /**
     * Additional statistics about this data set
     */
    stats?: Partial<Types.DatasetStats>;
    /**
     * List of child nodes and user-selected encodings
     */
    encodingMap?: Record<string, ZosEncoding>;
    /**
     * Binary indicator. Default false (text)
     */
    binary?: boolean;
    /**
     * ETag for the data set
     */
    etag?: string;
}

export interface UssState extends BaseState {
    /**
     * The parent path of the USS file or directory
     */
    parentPath?: string;
    /**
     * The full path of the USS file or directory
     */
    fullPath?: string;
    /**
     * Retrieves an abridged for of the label
     */
    shortLabel?: string;
    /**
     * List of child nodes and user-selected encodings
     */
    encodingMap?: Record<string, ZosEncoding>;
    /**
     * Binary indicator. Default false (text)
     */
    binary?: boolean;
    /**
     * File attributes
     */
    attributes?: Types.FileAttributes;
    /**
     * Remote encoding of the data set
     *
     * * `null` = user selected z/OS default codepage
     * * `undefined` = user did not specify
     */
    encoding?: string;
    /**
     * ETag for the USS file
     */
    etag?: string;
}

export interface JobState extends BaseState {
    /**
     * Standard job response document
     * Represents the attributes and status of a z/OS batch job
     * @interface IJob
     */
    job?: IJob;
    /**
     * Search criteria for a Job search
     */
    searchId?: string;
    /**
     * Job Prefix i.e "MYJOB"
     * Attribute of Job query
     */
    prefix?: string;
    /**
     * Job Owner i.e "MYID"
     * Attribute of Job query
     */
    owner?: string;
    /**
     * Job Status i.e "ACTIVE"
     * Attribute of Job query
     */
    status?: string;
}

export class StateManagement<T extends BaseState> {
    public dataStore: Map<Uri, StoreApi<T>> = new Map();

    public setState(id: Uri, state: Partial<T>): void {
        if (this.dataStore.has(id)) {
            const { setState: update } = this.dataStore.get(id);
            update(state);
        } else {
            this.dataStore.set(
                id,
                createStore<T>((set, get) => {
                    set(state);
                    return get();
                })
            );
        }
    }

    public getState(id: Uri): T {
        if (!this.dataStore.has(id)) {
            return undefined;
        }

        return this.dataStore.get(id).getState();
    }
}
