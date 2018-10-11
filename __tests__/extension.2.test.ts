jest.mock("../src/DatasetTree");

import * as vscode from "vscode";
import * as path from "path";
import * as extension from "../src/extension";
import { DatasetTree } from "../src/DatasetTree";

describe("tests moved over", () => {
  it("Testing that activate correctly executes", () => {
    pending("Ly");
  });

  it("Testing that saveFile is executed successfully", () => {
    pending("Chris");
  });

  describe("saveFile", () => {
    it("should properly save given parameters", () => {
      const testDoc: vscode.TextDocument = {
        fileName: path.join(extension.BRIGHTTEMPFOLDER, "testFile(mem)[sestest]"),
        uri: null,
        isUntitled: null,
        languageId: null,
        version: null,
        isDirty: null,
        isClosed: null,
        save: null,
        eol: null,
        lineCount: null,
        lineAt: null,
        offsetAt: null,
        positionAt: null,
        getText: null,
        getWordRangeAtPosition: null,
        validateRange: null,
        validatePosition: null
      };
    });

    const testResponse = {
        success: true,
        commandResponse: "",
        apiResponse: {
            items: []
        }
    };

    const testTree = new DatasetTree();
    // const testTree2 = new DatasetTree();

    // console.log(testTree.getTreeItem(null));
    // expect(testTree.getTreeItem).toHaveBeenCalledTimes(4);


    // expect(DatasetTree).toHaveBeenCalledTimes(1);

    // console.log(testTree);

  });
});
