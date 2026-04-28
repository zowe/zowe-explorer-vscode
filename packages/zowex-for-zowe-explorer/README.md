# Zowe Remote SSH for Zowe Explorer

The Zowe Remote SSH API for Zowe Explorer offers several features, enabling developers to interact with mainframe resources over SSH directly from their IDE.

## Features

- **Dataset Operations**: Create, read, write, and delete datasets
- **USS File Access**: Create, read, write, and delete files and directories in Unix System Services
- **Job Management**: Submit, view, cancel, hold, and release jobs on z/OS

## Minimum Requirements

- VS Code 1.73.0 (or newer)

## Usage

To deploy an instance of the Zowe Remote SSH server, run the `Zowe Explorer: Connect to zowex server on host...` command from the command palette. Select an SSH profile from the list of profiles to start the deployment and connection process. Once complete, the SSH profile is added to the Zowe Explorer tree views.

In the event that the server is unresponsive, you can restart the server with the `Zowe Explorer: Restart zowex server on host...` command.

To remove the server instance entirely, run the `Zowe Explorer: Uninstall zowex server on host...` command.

<!-- Commenting out for now. Need to update, though the build from source instructions should be the same as the Zowe Explorer ones...

## Building from source

1. From the root of this repository, run `npm install` to install all the dependencies
2. Change to the `packages/vsce` folder and run `npm run build` to build the extension
3. `npm run package` packages the extension

The VSIX file is created and saved in the `dist` folder.

After installation, you may be prompted to reload VS Code. -->
