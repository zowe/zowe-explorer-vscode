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

import { permStringToOctal } from "../../../src/utils/files";

describe("utils/file.ts", () => {
    describe("permStringToOctal", () => {
        it("converts drwxrwxrwx to 777", () => {
            expect(permStringToOctal("drwxrwxrwx")).toBe(777);
        });

        it("converts d--------- to 0", () => {
            expect(permStringToOctal("d---------")).toBe(0);
        });

        it("converts drwxr-xr-x to 755", () => {
            expect(permStringToOctal("drwxr-xr-x")).toBe(755);
        });

        it("converts -rwxrwxrwx to 777", () => {
            expect(permStringToOctal("-rwxrwxrwx")).toBe(777);
        });
    });
});
