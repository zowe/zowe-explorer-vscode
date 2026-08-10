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

import { afterAll } from "vitest";

vi.mock("vscode", () => import("./__mocks__/vscode.ts"));

afterAll(() => {
    // Reset cached modules between test files so module-level singletons
    // (e.g. ImperativeConfig.instance, Censor.mConfig) don't leak.
    vi.resetModules();
});
