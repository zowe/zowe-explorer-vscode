import { TableBuilder, TableMediator } from "../../../../../src/";
import * as vscode from "vscode";

// TableMediator unit tests

// Global mocks for building a table view and using it within test cases.
function createGlobalMocks() {
    // Mock `vscode.window.createWebviewPanel` to return a usable panel object
    const createWebviewPanelMock = jest.spyOn(vscode.window, "createWebviewPanel").mockReturnValueOnce({
        onDidDispose: (_fn) => {},
        webview: { asWebviewUri: (uri) => uri.toString(), onDidReceiveMessage: (_fn) => {} },
    } as any);

    // Example table for use with the mediator
    const table = new TableBuilder({
        extensionPath: "/a/b/c/zowe-explorer",
        extension: { id: "Zowe.vscode-extension-for-zowe" },
    } as any)
        .title("SomeTable")
        .build();

    return {
        createWebviewPanelMock,
        table,
    };
}

describe("TableMediator::getInstance", () => {
    it("returns an instance of TableMediator", () => {
        expect(TableMediator.getInstance()).toBeInstanceOf(TableMediator);
    });
});

describe("TableMediator::addTable", () => {
    it("adds the given table object to its internal map", () => {
        const globalMocks = createGlobalMocks();
        TableMediator.getInstance().addTable(globalMocks.table);
        expect((TableMediator.getInstance() as any).tables.get(globalMocks.table.getId())).toBe(globalMocks.table);
        (TableMediator.getInstance() as any).tables = new Map();
    });
});

describe("TableMediator::getTable", () => {
    it("retrieves the table by ID using its internal map", () => {
        const globalMocks = createGlobalMocks();
        const tableId = globalMocks.table.getId();
        TableMediator.getInstance().addTable(globalMocks.table);
        expect(TableMediator.getInstance().getTable(tableId)).toBe(globalMocks.table);
        (TableMediator.getInstance() as any).tables = new Map();
    });
});

describe("TableMediator::removeTable", () => {
    it("removes a table view from its internal map", () => {
        const globalMocks = createGlobalMocks();
        const tableId = globalMocks.table.getId();
        TableMediator.getInstance().addTable(globalMocks.table);
        expect(TableMediator.getInstance().removeTable(globalMocks.table)).toBe(true);
        expect((TableMediator.getInstance() as any).tables.get(globalMocks.table.getId())).toBe(undefined);
        expect(TableMediator.getInstance().getTable(tableId)).toBe(undefined);
    });
});
