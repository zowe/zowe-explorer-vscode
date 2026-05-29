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

// Use `defineConfig` (rather than `defineProject`) so that the project's
// `test.coverage` block is type-checked. `defineProject` is intentionally
// strict about not allowing workspace-level options on a project config, but
// at runtime vitest honors per-project coverage settings.
export default defineConfig({
    test: {
        name: "zowe-explorer",
        globals: true,
        environment: "node",
        setupFiles: ["vitest.setup.ts"],
        include: ["__tests__/__unit__/**/*.(spec|test).ts"],
        exclude: ["**/node_modules/**", "**/__tests__/__integration__/**", "**/__tests__/__e2e__/**", "**/out/**"],
        testTimeout: 10000,
        hookTimeout: 10000,
        // Mirror Jest's defaults so legacy tests retain the same lifecycle
        // semantics (only `vi.spyOn`/manual cleanups restore mocks).
        clearMocks: false,
        restoreMocks: false,
        mockReset: false,
        server: {
            deps: {
                inline: [/zowex-for-zowe-explorer/],
            },
        },
        coverage: {
            reportsDirectory: "results/unit/coverage",
            // Restrict coverage to first-party TypeScript sources. Otherwise the
            // v8 provider also reports on every JS file loaded during the run
            // (node_modules, webpack runtime stubs, webview bundles, etc.),
            // which on Windows triggers EINVAL inside the istanbul HTML
            // reporter when it tries to mirror absolute paths containing a
            // drive letter (e.g. `coverage/root/E:/...`).
            include: ["src/**"],
            // Apply `exclude` again after source-map remapping so synthetic
            // sources injected by upstream bundles (e.g.
            // `webpack:///external...`, `webpack/bootstrap`) are filtered out
            // of the final report.
            excludeAfterRemap: true,
            exclude: [
                ...coverageConfigDefaults.exclude,
                "**/*.js",
                "**/lib/**",
                "**/__mocks__/**",
                "**/__tests__/**",
                "**/scripts/**",
                "**/resources/**",
                "**/results/**",
                "**/webviews/**",
                "**/web/**",
                "vitest.config.ts",
                "vitest.setup.ts",
            ],
        },
    },
    resolve: {
        alias: {
            vscode: fileURLToPath(new URL("./__tests__/__mocks__/vscode.ts", import.meta.url)),
            "@zowe/zowe-explorer-api": fileURLToPath(new URL("../zowe-explorer-api/src/index.ts", import.meta.url)),
            "zowex-for-zowe-explorer": fileURLToPath(new URL("../zowex-for-zowe-explorer/src/index.ts", import.meta.url)),
        },
    },
    esbuild: {
        target: "es2022",
    },
});
