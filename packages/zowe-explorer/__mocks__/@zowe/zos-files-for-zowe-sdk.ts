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

import * as imperative from "@zowe/imperative";
const { IListOptions } = jest.requireActual("@zowe/zos-files-for-zowe-sdk");

export const CreateDefaults = {
    DATA_SET: {
        PARTITIONED: {
            alcunit: "CYL",
            dsorg: "PO",
            primary: 1,
            dirblk: 5,
            recfm: "FB",
            blksize: 6160,
            lrecl: 80,
        },
        SEQUENTIAL: {
            alcunit: "CYL",
            dsorg: "PS",
            primary: 1,
            recfm: "FB",
            blksize: 6160,
            lrecl: 80,
        },
        CLASSIC: {
            alcunit: "CYL",
            dsorg: "PO",
            primary: 1,
            recfm: "FB",
            blksize: 6160,
            lrecl: 80,
            dirblk: 25,
        },
        C: {
            dsorg: "PO",
            alcunit: "CYL",
            primary: 1,
            recfm: "VB",
            blksize: 32760,
            lrecl: 260,
            dirblk: 25,
        },
        BINARY: {
            dsorg: "PO",
            alcunit: "CYL",
            primary: 10,
            recfm: "U",
            blksize: 27998,
            lrecl: 27998,
            dirblk: 25,
        },
    },
    VSAM: {
        dsorg: "INDEXED",
        alcunit: "KB",
        primary: 840,
    },
};

export declare const enum CreateDataSetTypeEnum {
    DATA_SET_BINARY = 0,
    DATA_SET_C = 1,
    DATA_SET_CLASSIC = 2,
    DATA_SET_PARTITIONED = 3,
    DATA_SET_SEQUENTIAL = 4,
    DATA_SET_BLANK = 5,
}

export namespace List {
    export function dataSetsMatchingPattern(session: imperative.Session, hlq: string[], options: IListOptions): Promise<IZosFilesResponse> {
        return dataSet(session, hlq[0], options);
    }

    export function dataSet(session: imperative.Session, hlq: string, options: IListOptions): Promise<IZosFilesResponse> {
        if (hlq.toUpperCase() === "THROW ERROR") {
            throw Error("Throwing an error to check error handling for unit tests!");
        }

        return new Promise((resolve) => {
            const response = {
                success: true,
                apiResponse: {
                    items: [
                        new Items("BRTVS99", "PS", null),
                        new Items("BRTVS99.CA10", null, null, "YES"),
                        new Items("BRTVS99.CA11.SPFTEMP0.CNTL", "PO", null),
                        new Items("BRTVS99.DDIR", "PO", null),
                        new Items("BRTVS99.VS1", "VS", null),
                        new Items("BRTVS99.VS1.INDEX", "VS", null),
                        new Items("BRTVS99.VS1.DATA", "VS", null),
                    ],
                },
            };
            resolve(response);
        });
    }

    export function allMembers(session: imperative.Session, hlq: string, options: IListOptions): Promise<IZosFilesResponse> {
        if (hlq === "Throw Error") {
            throw Error("Throwing an error to check error handling for unit tests!");
        }

        return new Promise((resolve) => {
            if (hlq === "Response Fail") {
                resolve({ success: false });
                return;
            }
            const response = {
                success: true,
                apiResponse: {
                    items: [new Items(null, "PS", "BRTVS99"), new Items(null, "PS", "BRTVS99.DDIR")],
                },
            };
            resolve(response);
        });
    }

    export class Items {
        constructor(public dsname: string, public dsorg: string, public member: string, public migr?: string) {}
    }

    export function fileList(session: imperative.Session, hlq: string, options: IListOptions): Promise<IZosFilesResponse> {
        if (hlq.toUpperCase() === "THROW ERROR") {
            throw Error("Throwing an error to check error handling for unit tests!");
        }

        return new Promise((resolve) => {
            const response = {
                success: true,
                apiResponse: {
                    items: [
                        {
                            name: "aDir",
                            mode: "drw-r--r--",
                            size: 20,
                            uid: 0,
                            user: "WSADMIN",
                            gid: 1,
                            group: "OMVSGRP",
                            mtime: "2015-11-24T02:12:04",
                        },
                        {
                            name: "myFile.txt",
                            mode: "-rw-r--r--",
                            size: 20,
                            uid: 0,
                            user: "WSADMIN",
                            gid: 1,
                            group: "OMVSGRP",
                            mtime: "2015-11-24T02:12:04",
                        },
                    ],
                    returnedRows: 2,
                    totalRows: 2,
                    JSONversion: 1,
                },
            };
            resolve(response);
        });
    }
}

export class IZosFilesResponse {
    /**
     * indicates if the command ran successfully.
     * @type {boolean}
     */
    public success: boolean;
    /**
     * The command response text.
     * @type{string}
     */
    public commandResponse?: string;
    /**
     * The api response object.
     * @type{*}
     */
    public apiResponse?: any;
}
