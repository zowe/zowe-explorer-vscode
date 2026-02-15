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

import { Constants } from "../../../../src/configuration/Constants";
import { DatasetUtils } from "../../../../src/trees/dataset/DatasetUtils";

describe("Dataset utils unit tests - function getExtension", () => {
    it("returns the proper file extension", () => {
        const pairs = [
            { name: "TEST.DS.C", extension: ".c" },
            { name: "TEST.PDS.C(MEMBER)", extension: ".c" },
            { name: "TEST.DS.JCL", extension: ".jcl" },
            { name: "TEST.DS.CBL", extension: ".cbl" },
            { name: "TEST.PDS.CPY(M1)", extension: ".cpy" },
            { name: "TEST.DS.INCLUDE", extension: ".inc" },
            { name: "TEST.DS.PLX", extension: ".pli" },
            { name: "TEST.DS.SHELL", extension: ".sh" },
            { name: "TEST.DS.EXEC", extension: ".rexx" },
            { name: "TEST.DS.XML", extension: ".xml" },
            { name: "TEST.DS.ASM", extension: ".asm" },
            { name: "TEST.DS.ASSEMBLY", extension: ".asm" },
            { name: "TEST.DS.LOG", extension: ".log" },
            { name: "TEST.DS.SPFLOGS", extension: ".log" },
        ];
        for (const pair of pairs) {
            expect(DatasetUtils.getExtension(pair.name)).toBe(pair.extension);
        }
    });

    it("returns null if no language was detected", () => {
        expect(DatasetUtils.getExtension("TEST.DS.X")).toBe(null);
    });
});

describe("Dataset utils unit tests - function validateDatasetName", () => {
    it("returns true for valid dataset names (single and multiple segments)", () => {
        expect(DatasetUtils.validateDataSetName("A1234567")).toBe(true);
        expect(DatasetUtils.validateDataSetName("A.B")).toBe(true);
        expect(DatasetUtils.validateDataSetName("A#@$.B1234$-")).toBe(true);
        expect(DatasetUtils.validateDataSetName("A.B.C.D.E.F.G")).toBe(true);
    });

    it("returns false for invalid dataset names (segment too long, invalid chars, empty segment)", () => {
        expect(DatasetUtils.validateDataSetName("A12345678")).toBe(false);
        expect(DatasetUtils.validateDataSetName("A..B")).toBe(false);
        expect(DatasetUtils.validateDataSetName("A.B*")).toBe(false);
        expect(DatasetUtils.validateDataSetName("1A.B")).toBe(false);
        expect(DatasetUtils.validateDataSetName("A.B-")).toBe(true);
        expect(DatasetUtils.validateDataSetName("A.B--")).toBe(true);
        expect(DatasetUtils.validateDataSetName("A.B-1")).toBe(true);
    });

    it("returns false for dataset names exceeding max length", () => {
        const dsName = "A".repeat(Constants.MAX_DATASET_LENGTH + 1);
        expect(DatasetUtils.validateDataSetName(dsName)).toBe(false);
    });
});

describe("Dataset utils unit tests - function validateMemberName", () => {
    it("returns true for valid member names", () => {
        expect(DatasetUtils.validateMemberName("A")).toBe(true);
        expect(DatasetUtils.validateMemberName("A1234567")).toBe(true);
        expect(DatasetUtils.validateMemberName("#MEMBER$")).toBe(true);
        expect(DatasetUtils.validateMemberName("@1234567")).toBe(true);
        expect(DatasetUtils.validateMemberName("$A1B2C3D")).toBe(true);
    });

    it("returns false for member names longer than max length", () => {
        expect(DatasetUtils.validateMemberName("A12345678")).toBe(false);
    });

    it("returns false for member names with invalid characters or invalid start", () => {
        expect(DatasetUtils.validateMemberName("1MEMBER")).toBe(false);
        expect(DatasetUtils.validateMemberName("MEM BER")).toBe(false);
        expect(DatasetUtils.validateMemberName("MEM-BER")).toBe(false);
        expect(DatasetUtils.validateMemberName("MEM.BER")).toBe(false);
        expect(DatasetUtils.validateMemberName("MEM*BER")).toBe(false);
        expect(DatasetUtils.validateMemberName("")).toBe(false);
    });
});

describe("Dataset utils unit tests - function extractDataSetAndMember", () => {
    it("extracts data set and member when member is present", () => {
        const input = "MY.DATA.SET(MEMBER1)";
        const result = DatasetUtils.extractDataSetAndMember(input);
        expect(result.dataSetName).toBe("MY.DATA.SET");
        expect(result.memberName).toBe("MEMBER1");
    });

    it("extracts data set and member with special characters", () => {
        const input = "A#B$C@D(MEM#1)";
        const result = DatasetUtils.extractDataSetAndMember(input);
        expect(result.dataSetName).toBe("A#B$C@D");
        expect(result.memberName).toBe("MEM#1");
    });

    it("returns input as dataSetName and empty memberName if no member", () => {
        const input = "MY.DATA.SET";
        const result = DatasetUtils.extractDataSetAndMember(input);
        expect(result.dataSetName).toBe("MY.DATA.SET");
        expect(result.memberName).toBe("");
    });

    it("handles empty string", () => {
        const input = "";
        const result = DatasetUtils.extractDataSetAndMember(input);
        expect(result.dataSetName).toBe("");
        expect(result.memberName).toBe("");
    });

    it("handles malformed input with multiple parentheses", () => {
        const input = "MY.DATA.SET(MEMBER1)EXTRA";
        const result = DatasetUtils.extractDataSetAndMember(input);
        expect(result.dataSetName).toBe("MY.DATA.SET(MEMBER1)EXTRA");
        expect(result.memberName).toBe("");
    });

    it("handles input with only parentheses", () => {
        const input = "(MEMBER1)";
        const result = DatasetUtils.extractDataSetAndMember(input);
        expect(result.dataSetName).toBe("(MEMBER1)");
        expect(result.memberName).toBe("");
    });
});

describe("Dataset utils unit tests - function getExtensionMap", () => {
    function createMockNode(label: string, children: Array<{ label: string }>) {
        return {
            label,
            getChildren: jest.fn().mockResolvedValue(children),
        } as any;
    }

    it("should return extension map based on member names", async () => {
        const mockNode = createMockNode("TEST.PDS", [{ label: "MEMBER1" }, { label: "COBOL" }, { label: "XML" }]);

        const result = await DatasetUtils.getExtensionMap(mockNode, false);

        expect(result).toEqual({
            member1: "txt",
            cobol: "cbl",
            xml: "xml",
        });
    });

    it("should preserve case when uppercaseNames is true", async () => {
        const mockNode = createMockNode("TEST.PDS", [{ label: "MEMBER1" }, { label: "COBOL" }, { label: ".f@K3" }]);

        const result = await DatasetUtils.getExtensionMap(mockNode, true);

        expect(result).toEqual({
            MEMBER1: "txt",
            COBOL: "cbl",
            ".f@K3": "txt",
        });
    });

    it("should use parent PDS extension as fallback for members without recognised extensions", async () => {
        const mockNode = createMockNode("TEST.JCL", [{ label: "MEMBER1" }, { label: "MEMBER2" }]);

        const result = await DatasetUtils.getExtensionMap(mockNode, false);

        expect(result).toEqual({
            member1: "jcl",
            member2: "jcl",
        });
    });

    it("should use default .txt extension when no extension can be determined", async () => {
        const mockNode = createMockNode("TEST.UNKNOWN", [{ label: "MEMBER1" }, { label: "MEMBER2" }]);

        const result = await DatasetUtils.getExtensionMap(mockNode, false);

        expect(result).toEqual({
            member1: "txt",
            member2: "txt",
        });
    });

    it("should apply override extension to all members when provided", async () => {
        const mockNode = createMockNode("TEST.PDS", [{ label: "MEMBER1" }, { label: "COBOL" }, { label: "XML" }]);

        const result = await DatasetUtils.getExtensionMap(mockNode, false, "csv");

        expect(result).toEqual({
            member1: "csv",
            cobol: "csv",
            xml: "csv",
        });
    });

    it("should strip prefix dot from override extension", async () => {
        const mockNode = createMockNode("TEST.PDS", [{ label: "MEMBER1" }, { label: "MEMBER2" }]);

        const result = await DatasetUtils.getExtensionMap(mockNode, false, ".json");

        expect(result).toEqual({
            member1: "json",
            member2: "json",
        });
    });

    it("should apply override extension even to members that would normally match DS_EXTENSION_MAP", async () => {
        const mockNode = createMockNode("TEST.JCL", [{ label: "MEMBER1" }, { label: "COBOL" }, { label: "MEMBER3" }]);

        const result = await DatasetUtils.getExtensionMap(mockNode, false, "txt");

        expect(result).toEqual({
            member1: "txt",
            cobol: "txt",
            member3: "txt",
        });
    });

    it("should handle empty children array", async () => {
        const mockNode = createMockNode("TEST.PDS", []);

        const result = await DatasetUtils.getExtensionMap(mockNode, false);

        expect(result).toEqual({});
    });

    it("should normalise extensions by removing dots from extension map matches", async () => {
        const mockNode = createMockNode("TEST.JCL", [{ label: "MEMBER" }, { label: "JCL" }]);

        const result = await DatasetUtils.getExtensionMap(mockNode, false);

        expect(result["jcl"]).toBe("jcl");
        expect(result["member"]).toBe("jcl");
    });

    it("should apply override extension with uppercaseNames", async () => {
        const mockNode = createMockNode("TEST.PDS", [{ label: "MEMBER1" }, { label: "MEMBER2" }, { label: ".f@K3" }]);

        const result = await DatasetUtils.getExtensionMap(mockNode, true, "xml");

        expect(result).toEqual({
            MEMBER1: "xml",
            MEMBER2: "xml",
            ".f@K3": "xml",
        });
    });
});
