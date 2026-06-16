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

import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        exclude: ["**/*.js"],
        globals: true,
        projects: [
            "packages/zowe-explorer-api/vitest.config.ts",
            "packages/zowe-explorer/vitest.config.ts",
            "packages/zowe-explorer-ftp-extension/vitest.config.ts",
            "packages/eslint-plugin-zowe-explorer/vitest.config.ts",
        ],
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov", "html", "json", "cobertura"],
            // Only measure first-party TypeScript sources from each package.
            // Without this, the v8 provider also reports on every JS file that
            // happens to be loaded during the run (node_modules, webpack
            // runtime stubs, etc.), which both pollutes the report and on
            // Windows triggers EINVAL inside the istanbul HTML reporter when
            // it tries to mirror absolute paths containing a drive letter
            // (e.g. `coverage/root/E:/...`).
            include: ["packages/*/src/**"],
            // Apply `exclude` again after source-map remapping so that synthetic
            // sources injected by upstream bundles (e.g. `webpack:///external...`,
            // `webpack/bootstrap`) are filtered out of the final report.
            excludeAfterRemap: true,
            exclude: [
                ...coverageConfigDefaults.exclude,
                "**/*.js",
                "**/lib/**",
                "**/__mocks__/**",
                "**/__tests__/**",
                "**/vitest.config.ts",
                "**/vitest.setup.ts",
                "**/scripts/**",
                "**/resources/**",
                "**/results/**",
                "**/webviews/**",
                "**/web/**",
                // Zero coverage files - zowe-explorer-api
                "**/src/Types.ts",
                "**/src/dataset/IDataSetCount.ts",
                "**/src/extend/IApiExplorerExtender.ts",
                "**/src/extend/ILocalStorageAccess.ts",
                "**/src/extend/IRegisterClient.ts",
                "**/src/extend/MainframeInteraction.ts",
                "**/src/globals/GuiOptions.ts",
                "**/src/tree/IZoweExplorerTreeApi.ts",
                "**/src/tree/IZoweTree.ts",
                "**/src/tree/IZoweTreeNode.ts",
                "**/src/vscode/doc/BaseProfileAuth.ts",
                "**/src/vscode/doc/PromptCredentials.ts",
                // Zero coverage files - zowex package
                "**/benchmarks/setup.ts",
                "**/src/ExternalSshHelper.ts",
                "**/src/Utilities.ts",
                "**/src/index.ts",
                "**/src/api/SshCommandApi.ts",
                "**/src/api/SshCommonApi.ts",
                "**/src/api/SshJesApi.ts",
                "**/src/api/SshMvsApi.ts",
                "**/src/api/SshUssApi.ts",
                "**/src/api/index.ts",
            ],
        },
    },
});
