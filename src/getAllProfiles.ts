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

import { Imperative, CliProfileManager, ImperativeConfig } from "@brightside/imperative";
import * as path from "path";

/**
 * Load all profiles of type zosmf and write it out to stdout
 * We will then parse the output from the extension to load the profiles
 */
(async () => {
    const mainZoweDir = path.join(require.resolve("@brightside/core"), "..", "..", "..", "..");
    // we have to mock a few things to get the Imperative.init to work properly
    (process.mainModule as any).filename = require.resolve("@brightside/core");
    ((process.mainModule as any).paths as any).unshift(mainZoweDir);
    // we need to call Imperative.init so that any installed credential manager plugins are loaded
    await Imperative.init({ configurationModule: require.resolve("@brightside/core/lib/imperative.js") });
    const zosmfProfiles = (await new CliProfileManager({
        profileRootDirectory: path.join(ImperativeConfig.instance.cliHome, "profiles"),
        type: "zosmf"
    }).loadAll()).filter((profile) => {
        // only return zosmf profiles 
        return profile.type === "zosmf";
    });;

    process.stdout.write(JSON.stringify(zosmfProfiles, null, 2));
})();