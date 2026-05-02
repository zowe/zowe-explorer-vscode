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

/**
 * Root Vitest configuration for the Zowe Explorer monorepo.
 * Each package is registered as a Vitest project so a single
 * `vitest run` at the repo root executes all unit tests.
 *
 * For configuration details, visit:
 * https://vitest.dev/config/
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        projects: [
            "packages/zowe-explorer-api/vitest.config.ts",
            "packages/zowe-explorer/vitest.config.ts",
            "packages/zowe-explorer-ftp-extension/vitest.config.ts",
            "packages/eslint-plugin-zowe-explorer/vitest.config.ts",
        ],
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov", "html", "json", "cobertura"],
        },
    },
});
