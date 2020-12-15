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

// NPM command for getting package metadata
const getProjectMetadataCmd = (packageJson) => {
  return `npm view ${packageJson.name} --json`
};

// NPM package specific publishing steps
const publishSpecificProject = (version, token, packagePath) => {
  console.log(execSync(`echo registry=https://registry.npmjs.org/ > .npmrc`, {cwd: packagePath}).toString());
  console.log(execSync(`echo //registry.npmjs.org/:_authToken=${token} >> .npmrc`, {cwd: packagePath}).toString());

  console.log(`Publishing version ${version}`);
  console.log(execSync(`npm publish --access public`, {cwd: packagePath}).toString());
}

// Call common function to deploy the NPM package
publishProject(getProjectMetadataCmd, publishSpecificProject);
