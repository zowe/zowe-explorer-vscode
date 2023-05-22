# Zowe Explorer Extension for FTP

[![version](https://img.shields.io/visual-studio-marketplace/v/Zowe.zowe-explorer-ftp-extension.svg)](https://img.shields.io/visual-studio-marketplace/v/Zowe.zowe-explorer-ftp-extension.svg)
[![downloads](https://img.shields.io/visual-studio-marketplace/d/Zowe.zowe-explorer-ftp-extension.svg)](https://img.shields.io/visual-studio-marketplace/d/Zowe.zowe-explorer-ftp-extension.svg)

Zowe Explorer's FTP extension adds the FTP protocol to the [Zowe Explorer](https://github.com/zowe/vscode-extension-for-zowe) VS Code extension, allowing you to use [z/OS FTP Plug-in for Zowe CLI](https://github.com/zowe/zowe-cli-ftp-plugin) profiles to connect and interact with z/OS USS.

This VS Code extension also serves as a [source code example](https://github.com/zowe/vscode-extension-for-zowe/tree/main/packages/zowe-explorer-ftp-extension) demonstrating how to use the [Zowe Explorer Extensibility API](https://github.com/zowe/vscode-extension-for-zowe/tree/main/packages/zowe-explorer-api) to create VS Code extensions that extend the Zowe Explorer VS Code extensions with new capabilities.

## What's new in 1.22.0

**Added:**

- Added unit tests for the MVS and JES functionality.

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
2. If you do not have Zowe Explorer installed, it will automatically install it for you as it is a required dependency.
3. After the install, when Zowe Explorer now activates it will show a VS Code info message "Zowe Explorer was modified for FTP support." to confirm that the FTP extension is available within Zowe Explorer.

## Using the FTP Extension

To use the FTP extension with Zowe Explorer:

1. Open the Zowe Explorer activity bar in VS Code to see its three explorer views (Data Sets, USS, and Jobs).
2. Hover over **DATA SETS**, **USS**, or **JOBS**
3. Click the `+` icon and you will see your existing Zowe CLI FTP profiles listed in the drop-down to select.
4. Select your Zowe FTP profile and it will appear in the view.
5. Next to the profile in the view, click the Search icon next to your newly-added profile, and specify a filter search to list items in the view.
6. Try opening, editing, and saving files.

If you do not have an existing Zowe FTP profile, you can create one graphically with Zowe Explorer:

### Create a Team Configuration File

1. Navigate to the explorer tree.
2. Hover over **DATA SETS**, **USS**, or **JOBS**.
3. Click the **+** icon.
4. Select **Create a New Team Configuration File**.
5. If no workspace is opened a global configuration file will be created. If a workspace is opened, chose either a global configuration file or a project-level configuration file.
6. Edit the config file to include the host and other connection information:

   ```
   "zftp": {
         "type": "zftp",
         "properties": {
            "host": "YOURHOSTNAME"
         },
         "secure": []
        }
   ```

7. Refresh Zowe Explorer by either clicking the button in the notification message shown after creation, `alt+z`, or the `Zowe Explorer: Refresh Zowe Explorer` command palette option.

### Create a v1 Profile

**Note** If a Team Configuration file is in place v1 profile creation and use will not be available.

1. Navigate to the explorer tree.
2. Hover over **DATA SETS**, **USS**, or **JOBS**.
3. Click the **+** icon.
4. Provide a name for your profile.
5. You will be prompted for the type of connection you want to create. The drop-down dialog will show you the types of all the extensions available, such as `zosmf` and `zftp`.
6. Select `zftp` and continue providing values for the prompts shown. As you will see, the questions prompted are now specific for FTP-type connections and match the parameters available in the FTP plugin for Zowe CLI.

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

Zowe Explorer's FTP extension is now part of the [Zowe Explorer monorepo on Github](https://github.com/zowe/vscode-extension-for-zowe). You can find the sources there in the `/packages/zowe-explorer-ftp-extension` sub-folder.

To file issues, use the [Zowe Explorer issue list](https://github.com/zowe/vscode-extension-for-zowe/issues).

For [instructions on how to build](https://github.com/zowe/vscode-extension-for-zowe#build-locally).
