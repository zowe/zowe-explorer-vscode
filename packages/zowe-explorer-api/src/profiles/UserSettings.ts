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
 * The types of persistence schemas wich are available in settings.json
 */
export enum PersistenceSchemaEnum {
    Dataset = "zowe.ds.history",
    USS = "zowe.uss.history",
    Job = "zowe.jobs.history",
    MvsCommands = "zowe.commands.mvs.history",
    TsoCommands = "zowe.commands.tso.history",
    UssCommands = "zowe.commands.uss.history",
}
