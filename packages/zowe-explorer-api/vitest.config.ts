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

import { defineProject, mergeConfig } from "vitest/config";
import rootConfig from "../../vitest.config";

// Extract shared configuration without 'projects' property
// to prevent recursive project resolution errors when running tests within package folder
const { projects, ...sharedTestConfig } = rootConfig.test || {};
const sharedConfig = { ...rootConfig, test: sharedTestConfig };

export default mergeConfig(
    sharedConfig,
    defineProject({
        test: {
            name: "zowe-explorer-api",
            globals: true,
            environment: "node",
            setupFiles: ["vitest.setup.ts"],
            include: ["__tests__/**/*.(spec|test).ts"],
            // Use forked processes (matches Jest's default worker model) so each
            // test file gets its own Node process and module-level state cannot
            // leak between files.
            pool: "forks",
            testTimeout: 10000,
            hookTimeout: 10000,
            // Mirror Jest's defaults so legacy tests retain the same lifecycle
            // semantics (only `vi.spyOn`/manual cleanups restore mocks).
            clearMocks: false,
            restoreMocks: false,
            mockReset: false,
        },
        esbuild: {
            target: "es2022",
        },
    })
);
