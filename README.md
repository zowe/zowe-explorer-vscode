# Zowe Explorer

[![version](https://img.shields.io/visual-studio-marketplace/v/Zowe.vscode-extension-for-zowe.svg)](https://img.shields.io/visual-studio-marketplace/v/Zowe.vscode-extension-for-zowe.svg)
[![downloads](https://img.shields.io/visual-studio-marketplace/d/Zowe.vscode-extension-for-zowe.svg)](https://img.shields.io/visual-studio-marketplace/d/Zowe.vscode-extension-for-zowe.svg)
[![codecov](https://codecov.io/gh/zowe/vscode-extension-for-zowe/branch/main/graph/badge.svg)](https://codecov.io/gh/zowe/vscode-extension-for-zowe)
[![slack](https://img.shields.io/badge/chat-on%20Slack-blue)](https://slack.openmainframeproject.org/)

Welcome to Zowe Explorer! Zowe Explorer brings mainframe capabilities to modern IDEs, such as VS Code. [Zowe](https://www.zowe.org/) is a project hosted by the [Open Mainframe Project](https://www.openmainframeproject.org/), a [Linux Foundation](https://www.linuxfoundation.org/) project.

Join our [Slack channel](https://slack.openmainframeproject.org/) to connect with the Zowe community.

## Requirements

Client-side prerequisites for development:

- Install [Node.js](https://nodejs.org/en/download/) v14.0 or later.
- Install [Yarn](https://classic.yarnpkg.com) Classic.

Host-side prerequisites for connection:

- Configure TSO/E address space services, z/OS data set, file REST interface and z/OS jobs REST interface. For more information, see [z/OS Requirements](https://docs.zowe.org/stable/user-guide/systemrequirements-zosmf.html#z-os-requirements).

## Directory Structure

Zowe Explorer repository includes several folders with files that let you build and configure various aspects of the extension. The bulk of the Zowe Explorer source code is in the `packages` directory. The `packages` folder has the following structure:

- `├──`[`packages`](./packages) — includes source code of Zowe Explorer, various Zowe Explorer-related extensions, and the extensibility API<br>
  - `├──`[`eslint-plugin-zowe-explorer`](./packages/eslint-plugin-zowe-explorer) — includes necessary files to configure ESLint plug-in for Zowe Explorer
  - `├──`[`zowe-explorer-api`](./packages/zowe-explorer-api) — includes files to set up and use Extensibility API for Explorer. The API has two modules: Profiles API and Tree API.
  - `├──`[`zowe-explorer-ftp-extension`](./packages/zowe-explorer-ftp-extension) — includes files to set up and use the FTP extension for Zowe Explorer.
  - `├──`[`zowe-explorer`](./packages/zowe-explorer) — core Zowe Explorer source files, ReadMe, Changelog, and more.

## Build Locally

Ensure that you meet the [software requirements](#requirements) before you build and test your Zowe Explorer.

Clone the repository, build a VSIX file, and start working with the extension.

1. Clone the repository by issuing the following command in your local command-line interface:

   ```shell
   git clone https://github.com/zowe/vscode-extension-for-zowe.git
   ```

2. Change directories into the newly-cloned repository:

   ```shell
   cd vscode-extension-for-zowe
   ```

3. From your local copy of the repository, issue the following commands:

   ```shell
   yarn install && yarn run package
   ```

You can find the VSIX file in the `dist` folder.

Now install the extension to VS Code.

1. Navigate to the Extensions menu in VS Code and click the `...` button in the top-left corner of the pane.
2. Select Install from VSIX and select the .vsix file that was created by the commands you issued earlier.
3. Restart Visual Studio Code.

You can now use the extension.

For more information on how to run tests for the extension, see [Developer Setup](https://github.com/zowe/vscode-extension-for-zowe/wiki/Developer-Setup).

## Available Documentation

The current repository of the VS Code extension Zowe Explorer includes several ReadMes that highlight different aspects of using the extension.

Use the following list with the description and links to find the topics of your interest:

[Core Zowe Explorer ReadMe](https://github.com/zowe/vscode-extension-for-zowe/blob/main/packages/zowe-explorer/README.md) — contains information about how to install, configure, and use Zowe Explorer. This ReadMe helps you to familiarize yourself with the basic features of the extension.

[Zowe Explorer ESlint Plug-in ReadMe](https://github.com/zowe/vscode-extension-for-zowe/blob/main/packages/eslint-plugin-zowe-explorer/README.md) — contains information about how to install ESLint and configure ESLint rules. ESLint helps you to find and fix problems in your JavaScript code.

[Zowe Explorer Extensibility API ReadMe](https://github.com/zowe/vscode-extension-for-zowe/blob/main/packages/zowe-explorer-api/README.md) — contains information about how to extend the capabilities of Zowe Explorer, using the extensibility API.

[Zowe Explorer FTP Extension ReadMe](https://github.com/zowe/vscode-extension-for-zowe/blob/main/packages/zowe-explorer-ftp-extension/README.md) — contains information about how to install and use the Zowe Explorer extension for FTP. The extension adds the FTP protocol to Zowe Explorer, enabling you to use z/OS FTP Plug-in for Zowe CLI profiles to connect and interact with z/OS USS and MVS.

**Note**: Zowe Explorer FTP extension is an example that shows how the extensibility API is used to add new capabilities to Zowe Explorer.

[Zowe Explorer Developer Setup](https://github.com/zowe/vscode-extension-for-zowe/wiki/Developer-Setup) — contains information on how to install, build, and test Zowe Explorer.

[Zowe Explorer Developing for Theia](https://github.com/zowe/vscode-extension-for-zowe/wiki/Developing-for-Theia) — contains information on how to develop for the Web-based IDE Eclipse Theia.

## How to Contribute

We encourage you to contribute to Zowe Explorer!

Check the current [open issues](https://github.com/zowe/vscode-extension-for-zowe/issues) to choose where you can contribute. You can look for the `help wanted`-labeled issues to find issues that require additional input. If you are new to the project, you might want to check the issues with the `good first issue` label.

To report a bug or request a specific feature, please open a GitHub issue using the [appropriate template](https://github.com/zowe/vscode-extension-for-zowe/issues/new/choose). Feature requests will be added to our backlog after it receives 10 upvotes from the community.

Also, you can check our [Zenhub Communities boards](https://github.com/zowe/vscode-extension-for-zowe#workspaces/zowe-cli-explorers-5d77ca38fb288f0001ceae92/board?repos=150100207) for a more convenient view of issues and access to other boards of Zowe-related projects.

For more information on how to contribute, see [Contributor Guidance](https://github.com/zowe/vscode-extension-for-zowe/wiki/Contributor-Guidance).

## External Links

Check out more about using Zowe Explorer and Zowe on [Medium](https://medium.com/zowe) and [Awesome Zowe](https://github.com/tucker01/awesome-zowe).
