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

import { window } from "vscode";
import { Table, TableBuilder, TableMediator } from "../../../../../src";

// TableBuilder unit tests

function createGlobalMocks() {
    const mockPanel = {
        onDidDispose: (_fn) => {},
        webview: { asWebviewUri: (uri) => uri.toString(), onDidReceiveMessage: (_fn) => {} },
    };
    // Mock `vscode.window.createWebviewPanel` to return a usable panel object
    const createWebviewPanelMock = jest.spyOn(window, "createWebviewPanel").mockReturnValueOnce(mockPanel as any);

    return {
        createWebviewPanelMock,
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

describe("TableBuilder::convertColumnOpts", () => {
    it("converts an array of ColumnOpts to an array of Column", () => {
        const globalMocks = createGlobalMocks();
        const builder = new TableBuilder(globalMocks.context as any);
        const newCols: Table.ColumnOpts[] = [
            { field: "cat", valueFormatter: (data: { value: Table.ContentTypes }) => `val: ${data.value.toString()}` },
            { field: "doge", filter: true, comparator: (valueA, valueB, nodeA, nodeB, isDescending) => -1, colSpan: (params) => 2 },
            { field: "parrot", sort: "asc", rowSpan: (params) => 2 },
        ];
        expect((builder as any).convertColumnOpts(newCols)).toStrictEqual(
            newCols.map((col) => ({
                ...col,
                comparator: col.comparator?.toString(),
                colSpan: col.colSpan?.toString(),
                rowSpan: col.rowSpan?.toString(),
                valueFormatter: col.valueFormatter?.toString(),
            }))
        );
    });
});

describe("TableBuilder::contextOptions", () => {
    it("adds the given context options and returns the same instance", () => {
        const globalMocks = createGlobalMocks();
        const builder = new TableBuilder(globalMocks.context as any);
        const ctxOpts = {
            all: [
                {
                    title: "Add to queue",
                    command: "add-to-queue",
                    callback: {
                        typ: "cell",
                        fn: (_cell: Table.CellData) => {},
                    },
                    condition: (_data) => true,
                },
            ],
        } as Record<number | "all", Table.ContextMenuOpts[]>;

        const addCtxOptSpy = jest.spyOn(builder, "addContextOption");
        const builderCtxOpts = builder.contextOptions(ctxOpts);
        expect(builderCtxOpts).toBeInstanceOf(TableBuilder);
        expect(addCtxOptSpy).toHaveBeenCalledTimes(1);
    });
});

describe("TableBuilder::addContextOption", () => {
    it("adds the given context option and returns the same instance", () => {
        const globalMocks = createGlobalMocks();
        const builder = new TableBuilder(globalMocks.context as any);
        const ctxOpt = {
            title: "Delete",
            command: "delete",
            callback: {
                typ: "row",
                fn: (_row: Table.RowData) => {},
            },
            condition: (_data) => true,
        } as Table.ContextMenuOpts;

        // case 0: adding context option to "all" rows
        const builderCtxOpts = builder.addContextOption("all", ctxOpt);
        expect(builderCtxOpts).toBeInstanceOf(TableBuilder);
        expect((builderCtxOpts as any).data.contextOpts).toStrictEqual({
            all: [{ ...ctxOpt, condition: ctxOpt.condition?.toString() }],
        });
        // case 1: adding context option to a specific row, no previous options existed
        const finalBuilder = builderCtxOpts.addContextOption(0, ctxOpt);
        expect((finalBuilder as any).data.contextOpts).toStrictEqual({
            0: [{ ...ctxOpt, condition: ctxOpt.condition?.toString() }],
            all: [{ ...ctxOpt, condition: ctxOpt.condition?.toString() }],
        });
    });
});

describe("TableBuilder::addRowAction", () => {
    it("adds the given row action to all rows and returns the same instance", () => {
        const globalMocks = createGlobalMocks();
        const builder = new TableBuilder(globalMocks.context as any);
        const rowAction = {
            title: "Move",
            command: "move",
            callback: {
                typ: "cell",
                fn: (_cell: Table.CellData) => {},
            },
            condition: (_data) => true,
        } as Table.ActionOpts;
        const builderAction = builder.addRowAction("all", rowAction);
        expect(builderAction).toBeInstanceOf(TableBuilder);
        expect((builderAction as any).data.actions).toStrictEqual({
            all: [{ ...rowAction, condition: rowAction.condition?.toString() }],
        });
        const finalBuilder = builderAction.addRowAction(0, rowAction);
        expect((finalBuilder as any).data.actions).toStrictEqual({
            0: [{ ...rowAction, condition: rowAction.condition?.toString() }],
            all: [{ ...rowAction, condition: rowAction.condition?.toString() }],
        });
    });
});

describe("TableBuilder::rowActions", () => {
    it("calls rowAction for each action and returns the same instance", () => {
        const globalMocks = createGlobalMocks();
        const builder = new TableBuilder(globalMocks.context as any);
        const rowActions = {
            0: [
                {
                    title: "Move",
                    command: "move",
                    callback: {
                        typ: "cell",
                        fn: (_cell: Table.CellData) => {},
                    },
                    condition: (_data) => true,
                },
            ] as Table.ActionOpts[],
            all: [
                {
                    title: "Recall",
                    command: "recall",
                    callback: {
                        typ: "cell",
                        fn: (_cell: Table.CellData) => {},
                    },
                    condition: (_data) => true,
                },
            ] as Table.ActionOpts[],
        };
        const rowActionSpy = jest.spyOn(builder, "addRowAction");
        const builderAction = builder.rowActions(rowActions);
        expect(rowActionSpy).toHaveBeenCalledTimes(2);
        expect(builderAction).toBeInstanceOf(TableBuilder);
    });
});

describe("TableBuilder::buildAndShare", () => {
    it("builds the table view and adds it to the table mediator", () => {
        const globalMocks = createGlobalMocks();
        const newRows = [
            { a: 1, b: 2, c: 3, d: false, e: 5 },
            { a: 3, b: 2, c: 1, d: true, e: 6 },
        ];
        const addTableSpy = jest.spyOn(TableMediator.prototype, "addTable");
        const builder = new TableBuilder(globalMocks.context as any)
            .addRows(newRows)
            .addColumns([{ field: "a" }, { field: "b" }, { field: "c" }, { field: "d" }, { field: "e" }]);
        const instance = builder.buildAndShare();
        expect(addTableSpy).toHaveBeenCalledWith(instance);
    });
});

describe("TableBuilder::reset", () => {
    it("resets all table data on the builder instance", () => {
        const globalMocks = createGlobalMocks();
        const newRows = [
            { a: 1, b: 2, c: 3, d: false },
            { a: 3, b: 2, c: 1, d: true },
        ];
        const builder = new TableBuilder(globalMocks.context as any)
            .rows(...newRows)
            .title("A table")
            .options({ pagination: false });
        builder.reset();
        expect((builder as any).data).toStrictEqual({
            actions: {
                all: [],
            },
            contextOpts: {
                all: [],
            },
            columns: [],
            rows: [],
            title: "",
        });
    });
});
