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

/**
 * Interface representing the data structure for data set information
 */
export interface IDataSetInfo {
    name: string;
    dsorg?: string;
    createdDate?: Date;
    modifiedDate?: Date;
    lrecl?: string | number;
    migr?: string;
    recfm?: string;
    volumes?: string;
    user?: string;
    uri?: string;
    isMember?: boolean;
    isDirectory?: boolean;
    parentId?: string;
    // Member-specific properties
    vers?: number;
    mod?: number;
    cnorc?: number;
    inorc?: number;
    mnorc?: number;
    sclm?: string;
}

/**
 * Interface for different data sources that can provide data set information
 */
export interface IDataSetSource {
    /**
     * Fetches dataset information based on the source's specific implementation
     */
    fetchDataSets(): IDataSetInfo[] | PromiseLike<IDataSetInfo[]>;

    /**
     * Gets the title for the table view
     */
    getTitle(): string;

    /**
     * Supports hierarchical tree structure (PDS)
     */
    supportsHierarchy(): boolean | PromiseLike<boolean>;

    /**
     * Loads children for a specific parent (PDS)
     */
    loadChildren?(parentId: string): Promise<IDataSetInfo[]>;
}

export type DataSetTableType = "dataSets" | "members" | null;

export enum DataSetTableEventType {
    Created = 1,
    Modified,
    Disposed,
}

export interface IDataSetTableEvent {
    source: IDataSetSource;
    tableType: DataSetTableType;
    eventType: DataSetTableEventType;
}
