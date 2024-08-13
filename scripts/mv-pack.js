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

const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const Zip = require("adm-zip");
const packageName = process.argv[2];
const extension = process.argv[3];
const fullPackageName = `${packageName}-${process.env.npm_package_version}.${extension}`;
let targetPath = path.join("..", "..", "dist", fullPackageName);
if (targetPath.includes("-SNAPSHOT") && process.env.GITHUB_REF_PROTECTED !== "true") {
    const gitBranch = childProcess.execSync("git rev-parse --abbrev-ref HEAD").toString().trim().replace(/\//g, "_");
    const gitSha = process.env.CI && childProcess.execSync("git rev-parse --short HEAD").toString().trim();
    targetPath = targetPath.replace("-SNAPSHOT", gitSha ? `-${gitBranch}.${gitSha}` : `-${gitBranch}`);
}
fs.renameSync(fullPackageName, targetPath);
if (packageName === "vscode-extension-for-zowe") {
    console.log("[Zowe Explorer] injecting @vscode/codicons webview dependency into VSIX...");
    const codiconsPath = path.resolve("..", "..", "node_modules", "@vscode", "codicons", "dist");
    if (fs.existsSync(codiconsPath)) {
        const vsix = new Zip(targetPath);
        vsix.addLocalFolder(codiconsPath, "extension/src/webviews/node_modules/@vscode/codicons/dist");
        vsix.writeZip(targetPath);
    }
}
console.log(`Published package to ${targetPath}.`);
