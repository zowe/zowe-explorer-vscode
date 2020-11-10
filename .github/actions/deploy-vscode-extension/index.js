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

const core = require("@actions/core");

const path = require("path"); // normalize, join
const readFileSync = require("fs").readFileSync;
const execSync = require("child_process").execSync;

try {
  const packagePath = path.normalize(core.getInput("package"));
  const topPackageJson = JSON.parse(readFileSync("package.json"));
  const packageJson = JSON.parse(readFileSync(path.join(packagePath, "package.json")));

  // Gather the extension information
  let extensionMetadata = null;
  try {
    extensionMetadata = JSON.parse(execSync(`vsce show ${packageJson.publisher}.${packageJson.name} --json`).toString());
  } catch (err) {
    // Do nothing if the package was not found and just continue to publish the extension
    console.log(`Package ${packageJson.publisher}.${packageJson.name} not found!`);
  }

  // Check if there is a new version to publish (looking at the top level package.json for version)
  if (extensionMetadata != null && extensionMetadata.versions[0].version == topPackageJson.version) {
    console.log(`No new version to publish at this time. Current version: ${topPackageJson.version}`);
  } else {
    console.log(`Incrementing version: ${packageJson.version} -> ${topPackageJson.version}`);
    console.log(execSync(`npm version ${topPackageJson.version}`, {cwd: packagePath}).toString());

    console.log(execSync(`git status`, {cwd: packagePath}).toString());
    console.log(execSync(`git add package.json`, {cwd: packagePath}).toString());

    console.log(`Publishing version ${topPackageJson.version}`);
    console.log(execSync(`vsce publish --yarn -p ${core.getInput("token")}`, {cwd: packagePath}).toString());

    const versionName = `${packageJson.name}-${topPackageJson.version}`;
    console.log(`Generate: ${versionName}`);
    console.log(execSync(`yarn package`, {cwd: packagePath}).toString());
    core.setOutput("archive", versionName);

    let changelog = execSync("awk -v ver=" + topPackageJson.version + " '/## / {if (p) { exit }; if (\$2 ~ ver) { p=1; next} } p && NF' CHANGELOG.md | sed -z \"s/'/'\\\\\\''/g\" | sed -z 's/\"/\\\"/g' | sed -z 's/\\n/\\\\n/g'", {cwd: packagePath}).toString();
    if (changelog != "") {
      changelog = `#### ${core.getInput('name')}\n${changelog}`;
      console.log("changelog", changelog);
      core.setOutput("changelog", changelog);
    } else {
      // No changelog for this version
      console.log("No changelog available for version:", topPackageJson.version);

      // TODO: Decide whether to use `Recent Changes` method (similar to CLIs)
    }
  }
} catch (err) {
  core.setFailed(err.message);
}
