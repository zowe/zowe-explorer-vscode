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

import { afterAll, beforeAll } from "vitest";

vi.mock("crypto", async () => {
    const actual = await vi.importActual<typeof import("crypto")>("crypto");
    return {
        ...actual,
        randomUUID: vi.fn(() => "test-uuid-1234-5678-9abc"),
    };
});

beforeAll(async () => {
    try {
        const imperative = await import("@zowe/imperative");
        const Censor = (imperative as any).Censor;
        if (Censor && !Censor.__zeTestPatched) {
            const originalCensorRawData = Censor.censorRawData?.bind(Censor);
            const originalCensorObject = Censor.censorObject?.bind(Censor);
            Censor.censorRawData = function (data: unknown, category = ""): unknown {
                const config = this.mConfig ?? (imperative as any).ImperativeConfig?.instance?.config;
                if (config?.exists && (config.mProperties == null || config.mProperties.profiles == null)) {
                    return data;
                }
                return originalCensorRawData ? originalCensorRawData(data, category) : data;
            };
            Censor.censorObject = function (data: unknown): unknown {
                const config = this.mConfig ?? (imperative as any).ImperativeConfig?.instance?.config;
                if (config?.exists && (config.mProperties == null || config.mProperties.profiles == null)) {
                    return data;
                }
                return originalCensorObject ? originalCensorObject(data) : data;
            };
            Censor.__zeTestPatched = true;
        }
    } catch {
        // Imperative is not always available in every test context — ignore.
    }
});

afterAll(() => {
    vi.resetModules();
});
