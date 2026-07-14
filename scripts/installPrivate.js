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

// This script redirects registry URLs to a private registry for Yarn install
const childProcess = require("child_process");
const fs = require("fs");

const privateUrl = process.argv[2] ||
    childProcess.execSync("npm config get registry").toString().trim();
const publicUrls = [
    "https://registry.npmjs.org/",
    "https://registry.yarnpkg.com/"
];

function replaceRegistryHost(badHosts, goodHost, lockfilePath = "yarn.lock") {
    if (!fs.existsSync(lockfilePath)) return;
    const oldLockfile = fs.readFileSync(lockfilePath, "utf-8");
    const newLockfile = badHosts.reduce(
        (lockfile, badHost) => lockfile.replaceAll(badHost, goodHost),
        oldLockfile
    );
    fs.writeFileSync(lockfilePath, newLockfile);
}

replaceRegistryHost(publicUrls, privateUrl);

try {
    childProcess.execSync("yarn install", {
        env: { ...process.env, YARN_REGISTRY: privateUrl },
        stdio: "inherit"
    });
} finally {
    replaceRegistryHost([privateUrl], publicUrls[0]);
}
