import { LoadMoreCodeLens } from "../../../../src/vscode/ui/PaginationCodeLens";

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

describe("LoadMoreCodeLens", () => {
    it("should provide a CodeLens on the last line of the document with correct command info", () => {
        const mockDocument = {
            lineCount: 5,
        } as any;

        const provider = new LoadMoreCodeLens("zowe.jobs.loadMoreRecords");
        const result = provider.provideCodeLenses(mockDocument, {} as any);

        expect(result).toHaveLength(1);
        const codeLens = result?.[0];
        expect(codeLens?.range?.start.line).toBe(4);
        expect(codeLens?.range?.end.line).toBe(4);
        expect(codeLens?.command?.title).toBe("$(chevron-down) Load more...");
        expect(codeLens?.command?.command).toBe("zowe.jobs.loadMoreRecords");
        expect(codeLens?.command?.arguments?.[0]).toBe(mockDocument);
    });
});
