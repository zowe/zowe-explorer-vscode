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

import { isAuthOrderProperty, isValidAuthOrder, toggleAuthMethod } from "../../../../src/webviews/src/config-editor/utils/authOrder";

describe("authOrder", () => {
    it.each(["", "   ", "basic", "token, basic, bearer, cert-pem"])("accepts valid authentication order %s", (value) => {
        expect(isValidAuthOrder(value)).toBe(true);
    });
    it.each(["basic, basic", "token,", "unknown", "Basic", "basic,,token"])("rejects invalid authentication order %s", (value) => {
        expect(isValidAuthOrder(value)).toBe(false);
    });
    it("appends and removes methods while preserving the user's order", () => {
        expect(toggleAuthMethod(" token , basic ", "bearer")).toBe("token, basic, bearer");
        expect(toggleAuthMethod("token, basic, bearer", "basic")).toBe("token, bearer");
        expect(toggleAuthMethod("token", "token")).toBe("");
    });
    it("recognizes authOrder case insensitively", () => {
        expect(isAuthOrderProperty("AUTHORDER")).toBe(true);
        expect(isAuthOrderProperty("host")).toBe(false);
    });
});
