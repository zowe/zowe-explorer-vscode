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

import { EventEmitter, ExtensionContext, WebviewView } from "vscode";
import { TableBuilder, TableViewProvider } from "../../../../src/vscode/ui";

describe("TableViewProvider", () => {
    const fakeExtContext = {
        extensionPath: "/a/b/c/zowe-explorer",
        extension: {
            id: "Zowe.vscode-extension-for-zowe",
        },
    } as ExtensionContext;

    describe("getInstance", () => {
        it("returns a singleton instance for the TableViewProvider", () => {
            expect(TableViewProvider.getInstance()).toBeInstanceOf(TableViewProvider);
        });
    });

    describe("setTableView", () => {
        it("sets the table to the given table view", () => {
            // case 1: table did not previously exist
            const builder = new TableBuilder(fakeExtContext);

            const tableOne = builder
                .isView()
                .addColumns([
                    { field: "apple", headerName: "Apple" },
                    { field: "orange", headerName: "Orange" },
                    { field: "apple", headerName: "Banana" },
                ])
                .addRows([
                    { apple: 0, banana: 1, orange: 2 },
                    { apple: 3, banana: 4, orange: 5 },
                    { apple: 6, banana: 7, orange: 8 },
                    { apple: 9, banana: 10, orange: 11 },
                ])
                .build();
            TableViewProvider.getInstance().setTableView(tableOne);
            expect((TableViewProvider.getInstance() as any).tableView).toBe(tableOne);

            const disposeSpy = jest.spyOn(tableOne, "dispose");

            // case 2: table previously existed, dispose called on old table
            const tableTwo = builder.options({ pagination: false }).build();
            TableViewProvider.getInstance().setTableView(tableTwo);
            expect((TableViewProvider.getInstance() as any).tableView).toBe(tableTwo);
            expect(disposeSpy).toHaveBeenCalled();
        });
    });

    describe("getTableView", () => {
        beforeEach(() => {
            TableViewProvider.getInstance().setTableView(null);
        });

        it("returns null if no table view has been provided", () => {
            expect(TableViewProvider.getInstance().getTableView()).toBe(null);
        });

        it("returns a valid table view if one has been provided", () => {
            expect(TableViewProvider.getInstance().getTableView()).toBe(null);
            const table = new TableBuilder(fakeExtContext)
                .isView()
                .addColumns([
                    { field: "a", headerName: "A" },
                    { field: "b", headerName: "B" },
                    { field: "c", headerName: "C" },
                ])
                .addRows([
                    { a: 0, b: 1, c: 2 },
                    { a: 3, b: 4, c: 5 },
                ])
                .build();
            TableViewProvider.getInstance().setTableView(table);
            expect(TableViewProvider.getInstance().getTableView()).toBe(table);
        });
    });

    describe("resolveWebviewView", () => {
        it("correctly resolves the view and calls resolveForView on the table", async () => {
            const table = new TableBuilder(fakeExtContext).isView().build();
            TableViewProvider.getInstance().setTableView(table);
            const resolveForViewSpy = jest.spyOn(table, "resolveForView");
            const fakeView = {
                onDidDispose: jest.fn(),
                viewType: "zowe.panel",
                title: "SomeWebviewView",
                webview: { asWebviewUri: jest.fn(), onDidReceiveMessage: jest.fn(), options: {} },
            } as unknown as WebviewView;
            const fakeEventEmitter = new EventEmitter<any>();
            await TableViewProvider.getInstance().resolveWebviewView(
                fakeView,
                { state: undefined },
                { isCancellationRequested: false, onCancellationRequested: fakeEventEmitter.event }
            );
            expect(resolveForViewSpy).toHaveBeenCalled();
        });
    });
});
