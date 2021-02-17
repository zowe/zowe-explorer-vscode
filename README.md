# Getting Started with Zowe Explorer

[![version](https://vsmarketplacebadge.apphb.com/version-short/Zowe.vscode-extension-for-zowe.png)](https://vsmarketplacebadge.apphb.com/version-short/Zowe.vscode-extension-for-zowe.png)
[![downloads](https://vsmarketplacebadge.apphb.com/downloads-short/Zowe.vscode-extension-for-zowe.png)](https://vsmarketplacebadge.apphb.com/downloads-short/Zowe.vscode-extension-for-zowe.png)

Welcome to Zowe Explorer! This project is powered by Zowe, [Open Mainframe Project](https://www.openmainframeproject.org/).

Join our [Slack channel](https://slack.openmainframeproject.org/) to connect with the Zowe community.

## Requirements

- Install [Node.js](https://nodejs.org/en/download/) v8.0 or later.
- Configure TSO/E address space services, z/OS data set, file REST interface and z/OS jobs REST interface. For more information, see [z/OS Requirements](https://docs.zowe.org/stable/user-guide/systemrequirements-zosmf.html#z-os-requirements).
- Install [Yarn](https://yarnpkg.com/getting-started/install).

## Directory Structure

Zowe Explorer repository includes several folders with files that let you  build and configure various aspects of the extension, but most importantly we want to draw your attention to the `packages` folder. This folder has the following structure:

- `├──`[`packages`](./packages) — includes source code of Zowe Explorer, extensibility API, and other Zowe Explorer extensions<br>
    - `├──`[`eslint-plugin-zowe-explorer`](./packages/eslint-plugin-zowe-explorer) — includes necessary files to configure ESlint plug-in for Zowe Explorer
    - `├──`[`zowe-explorer-api`](./packages/zowe-explorer-api) — includes files to set up and use Extensibility API for Explorer. The API has two modules: Profiles API and Tree API.
    - `├──`[`zowe-explorer-ftp-extension`](./packages/zowe-explorer-ftp-extension) — includes files to set up and use the FTP extension for Zowe Explorer. 
    - `├──`[`zowe-explorer`](./packages/zowe-explorer) — core Zowe Explorer source files, ReadMe, Changelog, and more.

## Build Locally

Ensure that you have met the [software requirements](#requirements) before you can build and test your Zowe Explorer.

Clone the repository and run `yarn workspace vscode-extension-for-zowe package` to build a VSIX file and start working with the extension.

1. Clone the repository by issuing the following command:

   ```shell
   git clone --origin=upstream --branch=main --single-branch https://github.com/zowe/vscode-extension-for-zowe.git
   ```

2. From your local copy of the repository, issue the following commands:

   ```shell
   yarn install
   yarn workspace vscode-extension-for-zowe package
   ```

After you create a VSIX file, install the extension to VS Code.

1. Navigate to the Extensions menu in VS Code and click the `...` button in the top-left corner of the pane.
2. Select Install from VSIX and select the .vsix file that was created by your `yarn workspace vscode-extension-for-zowe package` command.
3. Restart Visual Studio Code.

You can now use the extension.

For more information on how to run tests for the extension, see [Developer's ReadMe](https://github.com/zowe/vscode-extension-for-zowe/blob/master/docs/Developer's%20ReadMe.md).

## Available Documentation

The current repository of the VS Code extension Zowe Explorer includes several ReadMes that highlight different aspects of using the extension.

Use the following list with the description and links to find the topics of your interest:

[Core Zowe Explorer ReadMe](https://github.com/zowe/vscode-extension-for-zowe/tree/master/packages/zowe-explorer) — contains information about how to install, configure, and use Zowe Explorer. This ReadMe helps you to familiarize yourself with the basic features of the extension.

[Zowe Explorer ESlint Plug-in ReadMe](https://github.com/zowe/vscode-extension-for-zowe/tree/master/packages/eslint-plugin-zowe-explorer) — contains information about how to install ESlint and configure ESlint rules. ESlint helps you to find and fix problems in your JavaScript code.

[Zowe Explorer Extensibility API ReadMe](https://github.com/zowe/vscode-extension-for-zowe/tree/master/packages/zowe-explorer-api) — contains information about how to extend the capabilities of Zowe Explorer, using the extensibility API.

[Zowe Explorer FTP Extension ReadMe](https://github.com/zowe/vscode-extension-for-zowe/tree/master/packages/zowe-explorer-ftp-extension) — contains information about how to install and use the Zowe Explorer extension for FTP. The extension adds the FTP protocol to Zowe Explorer, enabling you to use z/OS FTP Plug-in for Zowe CLI profiles to connect and interact with z/OS USS.

**Note**: Zowe Explorer FTP extension is an example that shows how the extensibility API is used to add new capabilities to Zowe Explorer.

[Zowe Explorer Developer's ReadMe](https://github.com/zowe/vscode-extension-for-zowe/blob/master/docs/Developer's%20ReadMe.md) — contains information on how to install, build, and test Zowe Explorer.

[Zowe Explorer in Theia ReadMe](https://github.com/zowe/vscode-extension-for-zowe/blob/master/docs/README-Theia.md) — contains information on how to develop for the Web-based IDE Eclipse Theia.

## How to Contribute

We encourage you to contribute to Zowe Explorer. See the [Contributor Guidance](https://github.com/zowe/vscode-extension-for-zowe/wiki/Best-Practices:-Contributor-Guidance) to proceed.

You can start by checking the current [open issues](https://github.com/zowe/vscode-extension-for-zowe/issues).

{TODO Do we want to create some sort of labels that will indicate that 'external' help is needed/wanted? Like "help needed" or something like that.}

## License

{TODO I don't know exactly how to formulate this section exactly. See the following 2 versions. Something tells me, it's the second version but I'd rather check with someone who knows for sure}

1. © Open Mainframe Project, a Linux Foundation Project. All Rights Reserved. The Linux Foundation has registered trademarks and uses trademarks. For a list of trademarks of The Linux Foundation, please see our Trademark Usage page. Please refer to Marketing and Branding Guidelines for name usage guidelines. Linux is a registered trademark of Linus Torvalds. Privacy Policy and Terms of Use.

2. Copyright © 2018-present Linux Foundation. This source code is licensed under the Eclipse Public License found in the LICENSE file.

## External Links

Check out more about using Zowe Explorer and Zowe on [Medium](https://medium.com/zowe) and [Awesome Zowe](https://github.com/tucker01/awesome-zowe).
