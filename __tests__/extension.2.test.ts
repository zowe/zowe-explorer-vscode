jest.mock("fs");
jest.mock("vscode");
jest.mock("../src/DatasetTree");
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as extension from "../src/extension";
import { DatasetTree } from "../src/DatasetTree";
import { activate, deactivate } from "../src/extension"; 

(fs as any).mkdirSync = jest.fn();

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
});
