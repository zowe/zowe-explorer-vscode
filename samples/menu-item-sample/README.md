# Menu Item Sample

Demonstrates adding a new command to the context menu shown when a tree item is right-clicked in Zowe Explorer.

The `contributes` section of "package.json" defines a menu item named "Show Node Context" for all tree views that have an ID starting with `zowe.`.

In "extension.ts" a command is registered which runs when the menu item is clicked and displays the associated [`TreeItem.contextValue`](https://code.visualstudio.com/api/references/vscode-api#TreeItem).

## Running the sample

- Open this sample in VS Code
- `yarn`
- `yarn run compile`
- `F5` to start debugging
