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

export enum DatasetSortOpts {
    Name,
    LastModified,
    UserId,
}

export enum SortDirection {
    Ascending,
    Descending,
}

export enum DatasetFilterOpts {
    LastModified,
    UserId,
}

export type DatasetFilter = {
    method: DatasetFilterOpts;
    value: string;
};

export type NodeSort = {
    method: DatasetSortOpts | JobSortOpts;
    direction: SortDirection;
};

export enum JobSortOpts {
    Id,
    DateSubmitted,
    Name,
    ReturnCode,
}
