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

describe("profiles/AuthHandler compatibility shim", () => {
    afterEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it("does not load the moved implementation until the facade is used", () => {
        let loadCount = 0;

        jest.isolateModules(() => {
            jest.doMock("../../../src/vscode/session/AuthHandler", () => {
                loadCount += 1;

                return {
                    __esModule: true,
                    AuthHandler: class AuthHandler {
                        public static authPromptLocks = new Map();

                        public static wasAuthCancelled(): boolean {
                            return true;
                        }
                    },
                    AuthCancelledError: class AuthCancelledError extends Error {},
                };
            });

            const { AuthHandler } = require("../../../src/profiles/AuthHandler");

            expect(loadCount).toBe(0);
            expect(AuthHandler.wasAuthCancelled("test-profile")).toBe(true);
            expect(loadCount).toBe(1);
        });
    });
});
