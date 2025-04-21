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

import { PaginationCodeLens } from "../../../../src/vscode/ui/PaginationCodeLens";

jest.mock("vscode", () => {
    return {
        Range: class {
            public constructor(public startLine: number, public _startChar: number, public endLine: number, public _endChar: number) {
                this.start = { line: startLine };
                this.end = { line: endLine };
            }
            public start: { line: number };
            public end: { line: number };
        },
        CodeLens: class {
            public constructor(public range: any, public command: any) {}
        },
        l10n: {
            t: (str: string) => str,
        },
    };
});

describe("PaginationCodeLens", () => {
    it("should provide a CodeLens on the last line of the document with correct command info", () => {
        const mockDocument = {
            lineCount: 5,
        } as any;

        const provider = new PaginationCodeLens("zowe.jobs.loadMoreRecords", () => true);
        const result = provider.provideCodeLenses(mockDocument, {} as any);

        expect(result).toHaveLength(1);
        const codeLens = result?.[0];
        expect(codeLens?.range?.start.line).toBe(4);
        expect(codeLens?.range?.end.line).toBe(4);
        expect(codeLens?.command?.title).toBe("$(chevron-down) Load more...");
        expect(codeLens?.command?.command).toBe("zowe.jobs.loadMoreRecords");
        expect(codeLens?.command?.arguments?.[0]).toBe(mockDocument);
    });

    it("should not provide CodeLens if shouldShowCodeLens returns false", () => {
        const mockDocument = {
            lineCount: 10,
        } as any;

        const provider = new PaginationCodeLens("zowe.jobs.loadMoreRecords", () => false);
        const result = provider.provideCodeLenses(mockDocument, {} as any);

        expect(result).toHaveLength(0);
    });

    it("should provide CodeLens if shouldShowCodeLens returns true", () => {
        const mockDocument = {
            lineCount: 7,
        } as any;

        const provider = new PaginationCodeLens("zowe.jobs.loadMoreRecords", () => true);
        const result = provider.provideCodeLenses(mockDocument, {} as any);

        expect(result).toHaveLength(1);
    });
});
