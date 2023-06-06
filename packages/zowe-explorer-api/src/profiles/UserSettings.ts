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

import { ICreateDataSetOptions } from "@zowe/cli";

/**
 * @type DataSetAllocTemplate
 * Used during creation of data sets in Zowe Explorer to access and manipulate a list of saved templates
 * presented to or saved by the user
 */
export type DataSetAllocTemplate = {
    [key: string]: ICreateDataSetOptions;
};

/**
 * The types of persistence schemas wich are available in settings.json
 */
export enum PersistenceSchemaEnum {
    Dataset = "zowe.ds.history",
    USS = "zowe.uss.history",
    Job = "zowe.jobs.history",
}
