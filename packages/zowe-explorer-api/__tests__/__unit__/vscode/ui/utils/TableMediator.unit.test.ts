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

import { TableBuilder, TableMediator } from "../../../../../src/";
import * as vscode from "vscode";

// TableMediator unit tests

// Global mocks for building a table view and using it within test cases.
function createGlobalMocks() {
    const mockPanel = {
        onDidDispose: (_fn) => {},
        webview: { asWebviewUri: (uri) => uri.toString(), onDidReceiveMessage: (_fn) => {} },
    };
    // Mock `vscode.window.createWebviewPanel` to return a usable panel object
    const createWebviewPanelMock = jest.spyOn(vscode.window, "createWebviewPanel").mockReturnValueOnce(mockPanel as any);

    const extensionContext = {
        extensionPath: "/a/b/c/zowe-explorer",
        extension: { id: "Zowe.vscode-extension-for-zowe" },
    };

    // Example table for use with the mediator
    const table = new TableBuilder(extensionContext as any).title("SomeTable").build();

    return {
        createWebviewPanelMock,
        extensionContext,
        mockPanel,
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

    it("returns false if the table instance does not exist in the map", () => {
        const globalMocks = createGlobalMocks();
        globalMocks.createWebviewPanelMock.mockReturnValueOnce(globalMocks.mockPanel as any);
        const table2 = new TableBuilder(globalMocks.extensionContext as any).build();
        TableMediator.getInstance().addTable(globalMocks.table);
        expect(TableMediator.getInstance().removeTable(table2)).toBe(false);
    });
});
