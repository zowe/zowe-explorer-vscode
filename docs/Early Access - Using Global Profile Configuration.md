# Using global profile configuration with Zowe Explorer

## Feature overview

The Zowe Explorer vNext release enables you to adopt the Team Configuration File (recently developed by the [Zowe CLI Squad](https://github.com/zowe/zowe-cli/blob/next/docs/Early%20Access%20-%20Using%20Global%20Profile%20Configuration.md)) - designed to make profile management more centralized and much simpler.

## Prerequisites

- Install [Zowe CLI @next version](https://github.com/zowe/zowe-cli/blob/next/docs/Early%20Access%20-%20Using%20Global%20Profile%20Configuration.md#installing-next-version).
- [Initialize](https://github.com/zowe/zowe-cli/blob/next/docs/Early%20Access%20-%20Using%20Global%20Profile%20Configuration.md#initializing-global-configuration) the Global Configuration file. The resulting `zowe.config.json` and `zowe.schema.json` files will be placed in your Zowe home directory.
- [Customize](https://github.com/zowe/zowe-cli/blob/next/docs/Early%20Access%20-%20Using%20Global%20Profile%20Configuration.md#editing-configuration) the Global Configuration file.

## Getting Started

Read through the [Zowe Explorer ReadMe file](https://github.com/zowe/vscode-extension-for-zowe/blob/master/packages/zowe-explorer/README.md) to familiarize yourself with the capabilities of Zowe Explorer, and you are ready to use Zowe Explorer.

### Install the vNext Release version

1. Get the latest pre-release version from the Zowe Explorer [Github Releases page](https://github.com/zowe/vscode-extension-for-zowe/releases)
2. Within VS Code, use **File > Preferences > Extensions > Install from vsix**
3. Select the files you downloaded
4. Reload your VS Code window.

### Load a Profile

1. Navigate to the explorer tree.
2. Hover over **DATA SETS**, **USS**, or **JOBS**.
3. Click the **+** icon.
4. From the drop-down menu, select the profile that you want to use.

You can now use all the functionalities of the extension.

### Add, Update, and Delete a Profile

1. The add, update, and delete profile options will open the global `zowe.config.json` file for editing
2. Click **View > Command Palette > Developer: Reload Window** to reload your VS Code window for the changes to take effect.
