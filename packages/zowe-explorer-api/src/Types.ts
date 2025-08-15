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

import { FileDecoration, Uri } from "vscode";
import { ICreateDataSetOptions } from "@zowe/zos-files-for-zowe-sdk";
import type { IApiExplorerExtender, IRegisterClient } from "./extend";
import type { IZoweDatasetTreeNode, IZoweJobTreeNode, IZoweTreeNode, IZoweUSSTreeNode, IZoweTree } from "./tree";

export namespace Types {
    export type IZoweNodeType = IZoweDatasetTreeNode | IZoweUSSTreeNode | IZoweJobTreeNode;
    export type IZoweDatasetTreeType = IZoweTree<IZoweDatasetTreeNode>;
    export type IZoweUSSTreeType = IZoweTree<IZoweUSSTreeNode>;
    export type IZoweJobTreeType = IZoweTree<IZoweJobTreeNode>;

    export type ZoweNodeInteraction = {
        node?: IZoweTreeNode;
        date?: Date;
    };

    export type IApiRegisterClient = IRegisterClient & {
        /**
         * Lookup of an API for the generic extender API.
         * @returns the registered API instance
         */
        getExplorerExtenderApi(): IApiExplorerExtender;
    };

    export type WebviewUris = {
        build: Uri;
        script: Uri;
        css?: Uri;
        codicons?: Uri;
    };

    export type FileAttributes = {
        gid: number;
        group: string;
        owner: string;
        uid: number;
        perms: string;
        tag?: string;
    };

    export type PollRequest = {
        msInterval: number;
        dispose?: boolean;
        decoration?: FileDecoration;

        reject?<T = never>(reason?: any): Promise<T>;
        resolve?: (uniqueId: string, data: any) => any;
        request: () => unknown | Promise<unknown>;

        // Indexable for storing custom items
        [key: string]: any;
    };

    export type DatasetStats = {
        user: string;
        //built from "c4date" variable from the z/OSMF API response
        createdDate: Date;
        // built from "m4date", "mtime" and "msec" variables from z/OSMF API response
        modifiedDate: Date;
        // Indexable for storing custom items
        [key: string]: any;
    };

    export type KeytarModule = {
        deletePassword: (service: string, account: string) => Promise<boolean>;
        findPassword: (service: string, account: string) => Promise<string | null>;
        findCredentials: (name: string) => Promise<{ account: string; password: string }[]>;
        getPassword: (service: string, account: string) => Promise<string | null>;
        setPassword: (service: string, account: string, password: string) => Promise<void>;
    };

    /**
     * @type DataSetAllocTemplate
     * Used during creation of data sets in Zowe Explorer to access and manipulate a list of saved templates
     * presented to or saved by the user
     */
    export type DataSetAllocTemplate = {
        [key: string]: ICreateDataSetOptions;
    };

    export type Appender = {
        type: string;
        layout: {
            type: string;
            pattern: string;
        };
        filename: string;
    };

    export type Log4JsCfg = {
        log4jsConfig: {
            appenders: { [key: string]: Appender };
        };
    };

    export type AddSessionOpts = {
        sessionName?: string;
        profileType?: string;
        addToAllTrees?: boolean;
    };
}
