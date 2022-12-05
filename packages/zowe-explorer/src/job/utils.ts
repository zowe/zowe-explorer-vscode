/*
 * This program and the accompanying materials are made available under the terms of the *
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at *
 * https://www.eclipse.org/legal/epl-v20.html                                      *
 *                                                                                 *
 * SPDX-License-Identifier: EPL-2.0                                                *
 *                                                                                 *
 * Copyright Contributors to the Zowe Project.                                     *
 *                                                                                 *
 */

import { FilterDescriptor } from "../utils/ProfilesUtils";

import * as nls from "vscode-nls";
// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

export class JobIdFilterDescriptor extends FilterDescriptor {
    constructor() {
        super("\uFF0B " + localize("zosJobsProvider.option.prompt.createId", "Job Id search"));
    }
}

export class OwnerFilterDescriptor extends FilterDescriptor {
    constructor() {
        super("\uFF0B " + localize("zosJobsProvider.option.prompt.createOwner", "Owner/Prefix Job Search"));
    }
}
