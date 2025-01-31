# IBM z/OS FTP for Zowe Explorer

[![version](https://img.shields.io/visual-studio-marketplace/v/Zowe.zowe-explorer-ftp-extension.svg)](https://img.shields.io/visual-studio-marketplace/v/Zowe.zowe-explorer-ftp-extension.svg)
[![downloads](https://img.shields.io/visual-studio-marketplace/d/Zowe.zowe-explorer-ftp-extension.svg)](https://img.shields.io/visual-studio-marketplace/d/Zowe.zowe-explorer-ftp-extension.svg)

> All previous verisons of IBM z/OS FTP for Zowe Explorer can be downloaded from [Zowe Explorer GitHub Releases](https://github.com/zowe/zowe-explorer-vscode/releases)

The IBM z/OS FTP for Zowe Explorer adds the FTP protocol to the [Zowe Explorer](https://github.com/zowe/zowe-explorer-vscode) VS Code extension, allowing you to use [z/OS FTP Plug-in for Zowe CLI](https://github.com/zowe/zowe-cli-ftp-plugin) profiles to connect and interact with z/OS USS.

This VS Code extension also serves as a [source code example](https://github.com/zowe/zowe-explorer-vscode/tree/main/packages/zowe-explorer-ftp-extension) demonstrating how to use the [Zowe Explorer Extensibility API](https://github.com/zowe/zowe-explorer-vscode/tree/main/packages/zowe-explorer-api) to create VS Code extensions that extend the Zowe Explorer VS Code extensions with new capabilities.

## Prerequisites

Ensure that you obtain remote access to z/OS FTP service before you can use the extension.

**Follow these steps:**

1. Connect to z/OS with the FTP client.
1. Run the following command in the FTP client:

   ```bash
   rstat
   ```

1. Ensure that the `JESINTERFACELevel` option is set to `2`.

## Installation

1. Install this VS Code extension from the [Microsoft](https://marketplace.visualstudio.com/items?itemName=Zowe.zowe-explorer-ftp-extension) or [Open VSX](https://open-vsx.org/extension/Zowe/zowe-explorer-ftp-extension) marketplace.
1. If you do not have Zowe Explorer installed, it will automatically install it for you as it is a required dependency.
1. After the install, when Zowe Explorer now activates it will show a VS Code info message "Zowe Explorer was modified for FTP support." to confirm that the FTP extension is available within Zowe Explorer.

## Using the FTP Extension

### Adding an existing zFTP profile

1. Open the Zowe Explorer activity bar in VS Code to see its three explorer views (Data Sets, USS, and Jobs).
1. Hover over **DATA SETS**, **USS**, or **JOBS**
1. Click the `+` icon and you will see your existing Zowe CLI FTP profiles listed in the drop-down to select.
1. Select your Zowe FTP profile and it will appear in the view.
1. Next to the profile in the view, click the Search icon next to your newly-added profile, and specify a filter search to list items in the view.
1. Try opening, editing, and saving files.

If you do not have an existing Zowe FTP profile, you can create one graphically with Zowe Explorer:

### Create a Team Configuration File

1. Navigate to the explorer tree.
1. Hover over **DATA SETS**, **USS**, or **JOBS**.
1. Click the **+** icon.
1. Select **Create a New Team Configuration File**.
1. If no workspace is opened a global configuration file will be created. If a workspace is opened, chose either a global configuration file or a project-level configuration file.
1. Edit the config file to include the host and other connection information:

   ```json
   "zftp": {
         "type": "zftp",
         "properties": {
            "host": "YOURHOSTNAME"
         },
         "secure": []
        }
   ```

## List of Supported Data Set Functionalities

See the list of the supported functionalities for different types of data sets:

Migrated Dataset:

- Show Data Set Attribute
- Add to Favorites

Sequential Dataset:

- Show Data Set Attribute
- Pull from Mainframe
- Edit Data Set
- Rename Data Set
- Delete Data Set

Partitioned Dataset:

- Show Data Set Attribute
- Create New Member
- Edit Member
- Upload Member
- Rename Data Set
- Delete Data Set

Partitioned Dataset Member:

- Pull from Mainframe
- Edit Member
- Rename Member
- Delete Member

## List of Supported USS Functionalities

- List uss files and directories
- view file in text/binary mode
- Edit file
- Save file
- Create a new directory/new file
- Upload file
- Rename file/directory
- Delete file/directory
- Pull from mainframe
- Add to Favorites

## List of Supported Jobs Functionalities

- List Jobs with prefix and owner
- List job by jobid
- List spool files
- View spool files content
- Download spool files
- Submit job from dataset/member
- Delete job
- Add to favorites

## Providing feedback or help contributing

Zowe Explorer's FTP extension is now part of the [Zowe Explorer monorepo on Github](https://github.com/zowe/zowe-explorer-vscode). You can find the sources there in the `/packages/zowe-explorer-ftp-extension` sub-folder.

To file issues, use the [Zowe Explorer issue list](https://github.com/zowe/zowe-explorer-vscode/issues).

For [instructions on how to build](https://github.com/zowe/zowe-explorer-vscode#build-locally).
