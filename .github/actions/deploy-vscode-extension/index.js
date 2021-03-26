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

const execSync = require("child_process").execSync;
const publishProject = require("../common").publishProject;

// Check if the given versions is already published
const checkVersion = (packageJson, version) => {
    try {
        const metadata = JSON.parse(
            execSync(`vsce show ${packageJson.publisher}.${packageJson.name} --json`).toString()
        );
        return metadata != null && metadata.versions[0].version == version;
    } catch (err) {
        // Do nothing if the extension was not found and just continue to publish the extension
        console.log(`Project: ${packageJson.publisher}.${packageJson.name} not found!`);
    }
    return false;
};

// VSCE specific steps for publishing an extension
// VSCE token contains two values: "<VSCode Marketplace token> <Open VSX token>"
// ex: "s0m3-V3ry-L0ng-T0k3n an0th3r-L0ng-T0k3n"
const publishSpecificProject = (versionName, token, packagePath) => {
    console.log(`Publishing: ${versionName}`);
    console.log(execSync(`vsce publish --yarn -p ${token.split(" ")[0]}`, { cwd: packagePath }).toString());
    console.log(execSync(`ovsx publish ${versionName}.vsix -p ${token.split(" ")[1]}`, { cwd: "dist" }).toString());
};

// Call common function to deploy the extension
publishProject(checkVersion, publishSpecificProject);
