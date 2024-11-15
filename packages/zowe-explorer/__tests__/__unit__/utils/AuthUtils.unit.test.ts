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

import { imperative } from "@zowe/zowe-explorer-api";
import { AuthUtils } from "../../../src/utils/AuthUtils";

describe("AuthUtils", () => {
    describe("promptForAuthError", () => {
        it("should prompt for authentication", async () => {
            const errorDetails = new imperative.ImperativeError({
                errorCode: 401 as unknown as string,
                msg: "All configured authentication methods failed",
            });
            const profile = { type: "zosmf" } as any;
            const promptForAuthenticationMock = jest
                .spyOn(AuthUtils, "promptForAuthentication")
                .mockImplementation(async () => Promise.resolve(true));
            AuthUtils.promptForAuthError(errorDetails, profile);
            expect(promptForAuthenticationMock).toHaveBeenCalledWith(errorDetails, profile);
        });
    });
});
