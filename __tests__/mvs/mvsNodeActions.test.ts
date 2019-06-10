import * as vscode from "vscode";
import * as mvsNodeActions from "../../src/mvs/mvsNodeActions";
import { ZoweNode } from "../../src/ZoweNode";

const mockRefresh = jest.fn();
const showOpenDialog = jest.fn();
const openTextDocument = jest.fn();

Object.defineProperty(vscode.window, "showOpenDialog", {value: showOpenDialog});
Object.defineProperty(vscode.workspace, "openTextDocument", {value: openTextDocument});
const DatasetTree = jest.fn().mockImplementation(() => {
    return {
        mSessionNodes: [],
        mFavorites: [],
        refresh: mockRefresh
    };
});

const testTree = DatasetTree();

describe("mvsNodeActions", async () => {
    it("should call upload dialog and upload file", async () => {
        const node = new ZoweNode("node", vscode.TreeItemCollapsibleState.Collapsed, null, null);
        const fileUri = {fsPath: "/tmp/foo"};
        showOpenDialog.mockReturnValue([fileUri]);
        openTextDocument.mockReturnValue({});
        await mvsNodeActions.uploadDialog(node, testTree);
        expect(showOpenDialog).toBeCalled();
        expect(openTextDocument).toBeCalled();
        expect(testTree.refresh).toBeCalled();
    });
});

