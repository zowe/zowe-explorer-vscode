jest.mock("../src/DatasetTree");

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as extension from "../src/extension";
import { DatasetTree } from "../src/DatasetTree";

describe("tests moved over", () => {
  fdescribe("activate should", () => {
    const extensionMock = jest.fn<vscode.ExtensionContext>(() => ({
      subscriptions: []
    }));
    const mock = new extensionMock();

    beforeEach(() => {
      (DatasetTree as any).addSession = jest.fn();
      (fs as any).existsSync = jest.fn().mockResolvedValueOnce(false);
      (extension as any).initializeFavorites = jest.fn();
    });

    afterEach(() => {

    });

    it("should execute correctly", async () => {
      console.log("start testing");
      await extension.activate(mock);


    });
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
