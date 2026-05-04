# Zowe Remote SSH for Zowe Explorer

The Zowe Remote SSH API for Zowe Explorer offers several features, enabling developers to interact with mainframe resources over SSH directly from their IDE.

## Features

- **Dataset Operations**: Create, read, write, and delete datasets
- **USS File Access**: Create, read, write, and delete files and directories in Unix System Services
- **Job Management**: Submit, view, cancel, hold, and release jobs on z/OS

## Usage

To deploy an instance of the Zowe Remote SSH server, run the `Zowe Explorer: Connect to zowex server on host...` command from the command palette. Select an SSH profile from the list of profiles to start the deployment and connection process. Once complete, the SSH profile is added to the Zowe Explorer tree views.

In the event that the server is unresponsive, you can restart the server with the `Zowe Explorer: Restart zowex server on host...` command.

To remove the server instance entirely, run the `Zowe Explorer: Uninstall zowex server on host...` command.
