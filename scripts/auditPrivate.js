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

// This script points npm at a private registry to run `npm audit`.
// npm audit requires a package-lock.json, but this repo uses Yarn, so one is
// generated on the fly (via `npm install --package-lock-only`) and removed afterwards.
const childProcess = require("child_process");
const fs = require("fs");

const privateUrl = process.argv[2] ||
    childProcess.execSync("npm config get registry", {
        env: { ...process.env, npm_config_registry: "" }
    }).toString().trim();

const lockfilePath = "package-lock.json";
const lockfileExisted = fs.existsSync(lockfilePath);

const npmEnv = {
    ...process.env,
    npm_config_registry: privateUrl,
    npm_config_always_auth: "true"
};

try {
    childProcess.execSync("npm install --package-lock-only --ignore-scripts", {
        env: npmEnv,
        stdio: "inherit"
    });
    childProcess.execSync("npm audit", {
        env: npmEnv,
        stdio: "inherit"
    });
} finally {
    if (!lockfileExisted) fs.rmSync(lockfilePath, { force: true });
}
