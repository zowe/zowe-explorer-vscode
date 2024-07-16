import { Table, TableBuilder } from "../../../../../src";

// TableBuilder unit tests

function createGlobalMocks() {
    return {
        context: {
            extensionPath: "/a/b/c/zowe-explorer",
            extension: {
                id: "Zowe.vscode-extension-for-zowe",
            },
        },
    };
}

describe("TableBuilder::constructor", () => {
    it("stores the extension context within the builder", () => {
        const globalMocks = createGlobalMocks();
        const builder = new TableBuilder(globalMocks.context as any);
        expect((builder as any).context).toBe(globalMocks.context);
    });
});

describe("TableBuilder::options", () => {
    it("adds the given options to the table data, returning the same instance", () => {
        const globalMocks = createGlobalMocks();
        let builder = new TableBuilder(globalMocks.context as any);
        expect((builder as any).data).not.toHaveProperty("pagination");
        builder = builder.options({
            pagination: false,
        });
        expect((builder as any).data).toHaveProperty("pagination");
    });
});

describe("TableBuilder::title", () => {
    it("sets the given title on the table data, returning the same instance", () => {
        const globalMocks = createGlobalMocks();
        let builder = new TableBuilder(globalMocks.context as any);
        expect((builder as any).data.title).toBe("");
        const title = "An incredulously long title for a table such that nobody should have to bear witness to such a tragedy";
        builder = builder.title(title);
        expect((builder as any).data.title).toBe(title);
    });
});

describe("TableBuilder::rows", () => {
    it("sets the given rows for the table, returning the same instance", () => {
        const globalMocks = createGlobalMocks();
        let builder = new TableBuilder(globalMocks.context as any);
        expect((builder as any).data.rows).toStrictEqual([]);
        const newRows = [
            { a: 1, b: 2, c: 3, d: false },
            { a: 3, b: 2, c: 1, d: true },
        ];
        builder = builder.rows(...newRows);
        expect((builder as any).data.rows).toStrictEqual(newRows);
    });
});

describe("TableBuilder::addRows", () => {
    it("adds the given rows to the table, returning the same instance", () => {
        const globalMocks = createGlobalMocks();
        let builder = new TableBuilder(globalMocks.context as any);
        expect((builder as any).data.rows).toStrictEqual([]);
        const newRows = [
            { a: 1, b: 2, c: 3, d: false },
            { a: 3, b: 2, c: 1, d: true },
        ];
        builder = builder.rows(...newRows);
        newRows.push({ a: 2, b: 1, c: 3, d: false });
        builder = builder.addRows([newRows[newRows.length - 1]]);
        expect((builder as any).data.rows).toStrictEqual(newRows);
    });
});

describe("TableBuilder::columns", () => {
    it("sets the given columns for the table, returning the same instance", () => {
        const globalMocks = createGlobalMocks();
        let builder = new TableBuilder(globalMocks.context as any);
        expect((builder as any).data.columns).toStrictEqual([]);
        const newCols: Table.ColumnOpts[] = [{ field: "cat" }, { field: "doge", filter: true }, { field: "parrot", sort: "asc" }];
        builder = builder.columns(...newCols);
        expect(JSON.parse(JSON.stringify((builder as any).data.columns))).toStrictEqual(JSON.parse(JSON.stringify(newCols)));
    });
});

describe("TableBuilder::addColumns", () => {
    it("adds the given columns to the table, returning the same instance", () => {
        const globalMocks = createGlobalMocks();
        let builder = new TableBuilder(globalMocks.context as any);
        expect((builder as any).data.columns).toStrictEqual([]);
        const newCols: Table.ColumnOpts[] = [{ field: "cat" }, { field: "doge", filter: true }, { field: "parrot", sort: "asc" }];
        builder = builder.columns(...newCols);
        newCols.push({ field: "parakeet", sort: "desc" });
        builder = builder.addColumns([newCols[newCols.length - 1]]);
        expect(JSON.parse(JSON.stringify((builder as any).data.columns))).toStrictEqual(JSON.parse(JSON.stringify(newCols)));
    });
});
