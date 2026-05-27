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

import { coverageConfigDefaults, defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

// `defineConfig` (not `defineProject`) so the per-package `coverage` block
// type-checks; see `packages/zowe-explorer/vitest.config.ts` for rationale.
export default defineConfig({
    test: {
        name: "zowex-for-zowe-explorer",
        globals: true,
        environment: "node",
        include: ["tests/**/*.(spec|test).ts"],
        exclude: ["**/node_modules/**", "**/out/**"],
        testTimeout: 10000,
        hookTimeout: 10000,
        clearMocks: true,
        restoreMocks: true,
        setupFiles: ["vitest.setup.ts"],
        coverage: {
            include: ["src/**"],
            excludeAfterRemap: true,
            exclude: [...coverageConfigDefaults.exclude, "**/*.js", "**/lib/**", "**/benchmarks/**", "vitest.config.ts"],
        },
    },
    resolve: {
        alias: {
            // Force all imports of 'vscode' to resolve to your mock file
            vscode: fileURLToPath(new URL("./__mocks__/vscode.ts", import.meta.url)),
            "@zowe/zowe-explorer-api": fileURLToPath(new URL("../zowe-explorer-api/src/index.ts", import.meta.url)),
        },
    },
    esbuild: {
        target: "es2022",
    },
});
