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

import { FileManagement } from "../../../src/utils/FileManagement";

describe("utils/file.ts", () => {
    describe("permStringToOctal", () => {
        it("converts drwxrwxrwx to 777", () => {
            expect(FileManagement.permStringToOctal("drwxrwxrwx")).toBe(777);
        });

        it("converts d--------- to 0", () => {
            expect(FileManagement.permStringToOctal("d---------")).toBe(0);
        });

        it("converts drwxr-xr-x to 755", () => {
            expect(FileManagement.permStringToOctal("drwxr-xr-x")).toBe(755);
        });

        it("converts -rwxrwxrwx to 777", () => {
            expect(FileManagement.permStringToOctal("-rwxrwxrwx")).toBe(777);
        });
    });
});
