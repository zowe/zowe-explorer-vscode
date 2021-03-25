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
        const metadata = JSON.parse(execSync(`npm view ${packageJson.name} --json`).toString());
        return metadata != null && metadata.versions.includes(version);
    } catch (err) {
        // Do nothing if the package was not found and just continue to publish the extension
        console.log(`Project: ${packageJson.name} not found!`);
    }
    return false;
};

// NPM package specific publishing steps
const publishSpecificProject = (versionName, token, packagePath) => {
    console.log(execSync(`echo registry=https://registry.npmjs.org/ > .npmrc`, { cwd: packagePath }).toString());
    console.log(execSync(`echo //registry.npmjs.org/:_authToken=${token} >> .npmrc`, { cwd: packagePath }).toString());

    console.log(`Publishing: ${versionName}`);
    console.log(execSync(`npm publish --access public`, { cwd: packagePath }).toString());
};

// Call common function to deploy the NPM package
publishProject(checkVersion, publishSpecificProject);
