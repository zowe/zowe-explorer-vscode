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
    const metadata = JSON.parse(execSync(`vsce show ${packageJson.publisher}.${packageJson.name} --json`).toString());
    return metadata != null && metadata.versions[0].version == version;
  } catch (err) {
    // Do nothing if the extension was not found and just continue to publish the extension
    console.log(`Project: ${packageJson.publisher}.${packageJson.name} not found!`);
  }
  return false;
};

// VSCE specific steps for publishing an extension
const publishSpecificProject = (version, token, packagePath) => {
  console.log(`Publishing version ${version}`);
  console.log(execSync(`vsce publish --yarn -p ${token}`, {cwd: packagePath}).toString());
}

// Call common function to deploy the extension
publishProject(checkVersion, publishSpecificProject);
