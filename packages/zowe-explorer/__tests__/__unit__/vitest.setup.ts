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

import { expect } from "vitest";

vi.mock("vscode", () => import("../__mocks__/vscode.ts"));
vi.mock("fs", () => import("../__mocks__/fs.ts"));
vi.mock("fs-extra", () => import("../__mocks__/fs-extra.ts"));
vi.mock("isbinaryfile", () => import("../__mocks__/isbinaryfile.ts"));

// Provide a Jest-compatible `fail` global so that legacy test code that expects
// `fail(reason)` continues to work under Vitest (which does not ship one).
(globalThis as any).fail = (reason: unknown): never => {
    expect.fail(reason instanceof Error ? reason.message : String(reason));
};

process.on("unhandledRejection", (reason) => {
    (globalThis as any).fail(reason);
});
