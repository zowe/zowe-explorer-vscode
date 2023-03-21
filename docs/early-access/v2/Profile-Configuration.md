# Zowe Explorer Profile Configuration

Zowe Explorer vNext enables you to use the team configuration file that centralizes and simplifies your profile management.

> vNext is developed by the [Zowe CLI Squad](https://github.com/zowe/zowe-cli/blob/next/docs/Early%20Access%20-%20Using%20Global%20Profile%20Configuration.md).

You can configure global profiles and project-specific profiles.

## Prerequisites

Meet the following software requirements before you use the team configuration file:

1. Install [Zowe CLI vNext version](https://github.com/zowe/zowe-cli/blob/next/docs/Early%20Access%20-%20Using%20Global%20Profile%20Configuration.md#installing-next-version).

   **Note:** With Zowe Explorer `v2.0.0-next.202202221200` or higher, users can install Zowe CLI via the command `npm install -g @zowe/cli@next` since it is no longer a pre-requisite.

   | Zowe Explorer version    | Zowe CLI version        | Zowe CLI prerequisite |
   | ------------------------ | ----------------------- | --------------------- |
   | v2.0.0-next.202107151328 | 7.0.0-next.202106012053 | required              |
   | v2.0.0-next.202110141604 | 7.0.0-next.202109281609 | required              |
   | v2.0.0-next.202112161700 | 7.0.0-next.202109281609 | required              |
   | v2.0.0-next.202202221200 | 7.0.0-next.202201261615 | optional              |
   | v2.0.0-next.202202281000 | 7.0.0-next.202202242016 | optional              |
   | v2.0.0-next.202204041200 | 7.0.0-next.202203311904 | optional              |
   | v2.0.0-next.202204180940 | 7.0.0-next.202204142300 | optional              |

2. Initialize the Global Configuration file by using either [the Zowe CLI](https://github.com/zowe/zowe-cli/blob/next/docs/Early%20Access%20-%20Using%20Global%20Profile%20Configuration.md#initializing-global-configuration) or [Zowe Explorer](#create-a-team-configuration-file).

   Your Zowe home directory should contain the `zowe.config.json` and `zowe.schema.json` files.

3. Customize the Global Configuration file by using either [the Zowe CLI](https://github.com/zowe/zowe-cli/blob/next/docs/Early%20Access%20-%20Using%20Global%20Profile%20Configuration.md#editing-configuration) or [Zowe Explorer](#manage-a-profile).

**Note**: There is backwards compatibility for V1 profile configuration. The V2 profile configuration will take precedence over V1 profile configuration, if a Global or Team configuration file is in place the V1 profiles will not be accessible.

## Install the vNext Release version

Install vNext.

**Follow these steps**:

1. Download the [vNext-enabled Zowe Explorer version](https://github.com/zowe/vscode-extension-for-zowe/releases) from the Zowe Explorer Github release page.
2. Open VS Code.
3. Navigate to **File** > **Preferences** > **Extensions** > **Install from vsix\*\***.
4. Select the .vsix file to install.
5. Reload your VS Code window.

### Load a Profile

**Follow these steps**:

1. Navigate to the explorer tree.
2. Hover over **DATA SETS**, **USS**, or **JOBS**.
3. Click the **+** icon.
4. From the drop-down menu, select the profile that you want to use.

You can now use your global or project-specific profile.

## Profile Configuration

The global profile functionality simplifies profile management by enabling you to edit, store, and share mainframe configuration details in one location. You can use a text editor or an IDE to populate configuration files with connection details for your mainframe services. By default, your global configuration file is located in .zowe home folder, whereas a project-level configuration file is located in the main directory of your project.

**Note**: A project context takes precedence over global configuration.

### Create a Team Configuration File

Create a team configuration file.

1. Navigate to the explorer tree.
2. Hover over **DATA SETS**, **USS**, or **JOBS**.
3. Click the **+** icon.
4. Select **Create a New Team Configuration File**.
5. Chose either a global configuration file or a project-level configuration file.
6. Edit the config file to include the host information.
7. Refresh Zowe Explorer by either clicking the button in the notification message shown after creation, `alt+z`, or the `Zowe Explorer: Refresh Zowe Explorer` command palette option.

Your team configuration file appears either in your `.zowe` folder if you choose the global configuration file option, or in your workspace directory if you choose the project-level configuration file option. The notification message that shows in VS Code after config file creation will include the path of the file created.

### Manage a Profile

You can edit your project-level or global configuration files.

**Follow these steps**:

1. Right-click on your profile.
2. Select the **Add**, **Update**, or **Delete Profile** options to edit the zowe config file in place.

   **Tip**: Use the Intellisense prompts if you need assistance with filling parameters in the .json file.

3. Refresh the view by clicking the refresh icon in the Data Sets, USS, or Jobs view.

   Alternatively, press F1 to open the command palette, type and execute the **Zowe Explorer: Refresh Zowe Explorer** option.

You successfully edited your configuration file.

### Sample Profile Configuration

View the profile configuration sample. In the sample, the default `lpar1.zosmf` profile will be loaded upon activation.

You can use the sample to customize your profile configuration file. Ensure that you edit the `host` and `port` values before you work in your environment.

```json
{
  "$schema": "./zowe.schema.json",
  "profiles": {
    "lpar1": {
      "properties": {
        "host": "192.86.32.67"
      },
      "profiles": {
        "zosmf": {
          "type": "zosmf",
          "properties": {
            "port": 10443
          },
          "secure": []
        },
        "tso": {
          "type": "tso",
          "properties": {
            "account": "",
            "codePage": "1047",
            "logonProcedure": "IZUFPROC"
          },
          "secure": []
        },
        "ssh": {
          "type": "ssh",
          "properties": {
            "port": 22
          },
          "secure": []
        },
        "zftp": {
          "type": "zftp",
          "properties": {
            "port": 21
          },
          "secure": []
        }
      }
    },
    "my_base": {
      "type": "base",
      "properties": {
        "rejectUnauthorized": false
      },
      "secure": ["user", "password"]
    }
  },
  "defaults": {
    "zosmf": "lpar1.zosmf",
    "tso": "lpar1.tso",
    "ssh": "lpar1.ssh",
    "zftp": "lpar1.zftp",
    "base": "my_base"
  },
  "plugins": []
}
```
