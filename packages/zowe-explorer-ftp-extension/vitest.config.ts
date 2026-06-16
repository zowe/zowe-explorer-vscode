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
 * For a detailed explanation regarding each configuration property, visit:
 * https://vitest.dev/config/
 */

import { fileURLToPath } from "url";
import { coverageConfigDefaults, defineConfig } from "vitest/config";

// `defineConfig` (not `defineProject`) so the per-package `coverage` block
// type-checks; see `packages/zowe-explorer/vitest.config.ts` for rationale.
export default defineConfig({
    test: {
        name: "zowe-explorer-ftp-extension",
        globals: true,
        environment: "node",
        setupFiles: ["vitest.setup.ts"],
        include: ["__tests__/**/*.(spec|test).ts"],
        exclude: ["**/node_modules/**", "**/out/**"],
        testTimeout: 10000,
        hookTimeout: 10000,
        clearMocks: false,
        restoreMocks: false,
        mockReset: false,
        coverage: {
            reportsDirectory: "results/unit/coverage",
            include: ["src/**"],
            excludeAfterRemap: true,
            exclude: [
                ...coverageConfigDefaults.exclude,
                "**/*.js",
                "**/lib/**",
                "vitest.config.ts",
                "vitest.setup.ts",
                "__mocks__/@zowe/zowe-explorer-api.ts",
                "results/unit/coverage/lcov-report/**",
                "results/unit/jest-stare/js/**",
            ],
        },
    },
    resolve: {
        alias: {
            vscode: fileURLToPath(new URL("./__mocks__/vscode.ts", import.meta.url)),
            "@zowe/zowe-explorer-api": fileURLToPath(new URL("../zowe-explorer-api/src/index.ts", import.meta.url)),
        },
    },
    esbuild: {
        target: "es2022",
    },
});
