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

import { DatasetUtils } from "../../../../src/trees/dataset/DatasetUtils";

describe("Dataset utils unit tests - function getExtension", () => {
    it("returns the proper file extension", () => {
        const pairs = [
            { name: "TEST.DS.C", extension: ".c" },
            { name: "TEST.PDS.C(MEMBER)", extension: ".c" },
            { name: "TEST.DS.JCL", extension: ".jcl" },
            { name: "TEST.DS.CBL", extension: ".cobol" },
            { name: "TEST.PDS.CPY(M1)", extension: ".cpy" },
            { name: "TEST.DS.INCLUDE", extension: ".inc" },
            { name: "TEST.DS.PLX", extension: ".pli" },
            { name: "TEST.DS.SHELL", extension: ".sh" },
            { name: "TEST.DS.EXEC", extension: ".rexx" },
            { name: "TEST.DS.XML", extension: ".xml" },
            { name: "TEST.DS.ASM", extension: ".asm" },
            { name: "TEST.DS.LOG", extension: ".log" },
        ];
        for (const pair of pairs) {
            expect(DatasetUtils.getExtension(pair.name)).toBe(pair.extension);
        }
    });
    it("returns null if no language was detected", () => {
        expect(DatasetUtils.getExtension("TEST.DS")).toBe(null);
    });
});
