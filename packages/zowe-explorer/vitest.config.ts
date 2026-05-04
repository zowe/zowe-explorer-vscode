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

import { defineProject } from "vitest/config";
import { fileURLToPath } from "url";

export default defineProject({
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
                inline: [/@zowe\//]
            }
        }
    },
    resolve: {
        alias: {
            vscode: fileURLToPath(new URL('./__tests__/__mocks__/vscode.ts', import.meta.url)),
            "@zowe/zowe-explorer-api": fileURLToPath(new URL('../zowe-explorer-api/src/index.ts', import.meta.url)),
            "@zowe/zowex-for-zowe-explorer": fileURLToPath(new URL('../zowex-for-zowe-explorer/src/index.ts', import.meta.url))
        }
    },
    esbuild: {
        target: "es2022",
    },
});
