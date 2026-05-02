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

export default defineProject({
    test: {
        name: "eslint-plugin-zowe-explorer",
        globals: true,
        environment: "node",
        include: ["tests/**/*.js"],
        clearMocks: false,
        restoreMocks: false,
    },
});
