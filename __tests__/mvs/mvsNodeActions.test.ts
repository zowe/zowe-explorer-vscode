import * as vscode from "vscode";
// import { ZoweUSSNode } from "../../src/ZoweUSSNode";
// import * as brtimperative from "@brightside/imperative";
import * as mvsNodeActions from "../../src/mvs/mvsNodeActions";
import { ZoweNode } from "../../src/ZoweNode";
// jest.mock("../src/DatasetTree");

const mockRefresh = jest.fn();
const DatasetTree = jest.fn().mockImplementation(() => {
    return {
        mSessionNodes: [],
        mFavorites: [],
        refresh: mockRefresh
    };
});

const testTree = DatasetTree();
// testTree.mSessionNodes = [];
// testTree.mSessionNodes.push(sessNode);

describe("mvsNodeActions", async () => {
    it("should call upload dialog and upload file", async () => {
        const node = new ZoweNode("node", vscode.TreeItemCollapsibleState.Collapsed, null, null);
        spyOn(vscode.window, "showOpenDialog").and.returnValue(Promise.resolve());
        spyOn(testTree, "refresh");
        mvsNodeActions.uploadDialog(node, testTree);
        expect(testTree.refresh).toHaveBeenCalled();
    });
});

