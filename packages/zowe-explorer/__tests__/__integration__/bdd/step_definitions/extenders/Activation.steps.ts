import { Given, When, Then } from "@cucumber/cucumber";
import { join } from "path";
import type * as vscode from "vscode";

// extension.js template for activation test:
/*
import * as vscode from "vscode";

export const MyTestProfile = {
  type: "{{profileType}}",
  schema: {
    type: "object",
    title: "{{profileType}} Profile",
    description: "The most {{profileType}} profile you will ever see",
    properties: {
      letter: {
        type: "string",
        optionDefinition: {
          name: "letter",
          aliases: [],
          description: "A letter of the alphabet",
          type: "string",
          required: false,
          group: "",
        },
      },
    },
    required: [],
  },
  createProfileExamples: [],
};

export async function activate(context) {
  const zoweExplorerApi = vscode.extensions.getExtension("Zowe.vscode-extension-for-zowe")?.exports?.getExplorerExtenderApi();
  await zoweExplorerApi.initForZowe(MyTestProfile.type, [MyTestProfile]);
  zoweExplorerApi.getProfilesCache().registerCustomProfilesType(MyTestProfile.type);
  await zoweExplorerApi.reloadProfiles(MyTestProfile.type);
  vscode.window.showInformationMessage(
    JSON.stringify(
      zoweExplorerApi
        .getProfilesCache()
        .getProfiles(MyTestProfile.type)
        .map((prof) => prof.name)
    )
  );
}
*/

// package.json template for activation test:
/*
{
  "name": "{{profileType}}-profile-sample",
  "displayName": "{{profileType}}-profile-sample",
  "description": "{{profileType}} profile sample for Zowe Explorer",
  "version": "1.0.0",
  "publisher": "Zowe",
  "repository": "https://github.com/zowe/zowe-explorer-vscode/samples/profile-type-template-sample#{{profileType}}",
  "engines": {
    "vscode": "^1.74.0"
  },
  "categories": [
    "Other"
  ],
  "activationEvents": [
    "onStartupFinished"
  ],
  "main": "./extension.js",
  "contributes": {
    "commands": [
      {
        "command": "{{profileType}}-profile-sample.helloWorld",
        "title": "Hello World from {{profileType}}"
      }
    ]
  },
  "extensionDependencies": [
    "Zowe.vscode-extension-for-zowe"
  ],
  "scripts": {
    "vscode:prepublish": "pnpm compile",
    "compile": "echo 'No compilation needed for {{profileType}}-profile-sample'"
  },
  "dependencies": {},
  "devDependencies": {}
}

*/

Given("a user who is using Zowe Explorer in VS Code", function () {
    this.extensionsDir = join(__dirname, "..", "..", "..", "..", "__common__", ".wdio-vscode-service", "data", "extensions");
});

When("the user installs multiple Zowe Explorer extenders", function () {});

When("the user reloads VS Code after installing the extensions", async function () {
    await browser.executeWorkbench(async (vsc: typeof vscode) => {
        await vsc.commands.executeCommand("workbench.action.restartExtensionHost");
    });
});

Then("the profile types from these extensions are successfully registered at activation", async function () {
    // TODO: Verify that dialogs contain the profile types
});
