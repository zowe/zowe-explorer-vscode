# Zowe Remote SSH for Zowe Explorer

The Zowe Remote SSH extension for Zowe Explorer offers several features, enabling developers to interact with mainframe resources over SSH directly from their IDE.

## Features

- **Dataset Operations**: Create, read, write, and delete datasets
- **USS File Access**: Create, read, write, and delete files and directories in Unix System Services
- **Job Management**: Submit, view, cancel, hold, and release jobs on z/OS

## Minimum Requirements

- VS Code 1.73.0 (or newer)
- Zowe Explorer v3.1.0 (or newer)

## Installation

Access the latest version of the VS Code extension from the GitHub Releases page.

Install the extension from the VSIX file in VS Code:

1. Open the Extensions view (Ctrl+Shift+X, or Command+Shift+X on macOS)
2. Click the `...` button and select `Install from VSIX...`
3. Locate the VSIX file on your machine and select it
4. Click `Install`

The extension is installed and ready to use.

## Usage

To deploy an instance of the Zowe Remote SSH server, run the `Zowe-SSH: Connect to Host...` command from the command palette. Select an SSH profile from the list of profiles to start the deployment and connection process. Once complete, the SSH profile is added to the Zowe Explorer tree views.

In the event that the server is unresponsive, you can restart the server with the `Zowe-SSH: Restart Zowe Server on Host...` command.

To remove the server instance entirely, run the `Zowe-SSH: Uninstall Zowe Server on Host...` command.

To access logs for the VS Code extension or to troubleshoot an error, run the `Zowe-SSH: Show Log` command.

## Building from source

1. From the root of this repository, run `npm install` to install all the dependencies
2. Change to the `packages/vsce` folder and run `npm run build` to build the extension
3. `npm run package` packages the extension

The VSIX file is created and saved in the `dist` folder.

After installation, you may be prompted to reload VS Code.
