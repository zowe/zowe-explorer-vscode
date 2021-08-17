# Zowe Explorer Profile Configuration

Zowe Explorer @Next enables you to use the team configuration file that centralizes and simplifies your profile management.

> @Next is developed by the [Zowe CLI Squad](https://github.com/zowe/zowe-cli/blob/next/docs/Early%20Access%20-%20Using%20Global%20Profile%20Configuration.md).

You can configure global profiles and project-specific profiles.

## Prerequisites

Meet the following software requirements before you use the team configuration file:

1. Install [Zowe CLI @next version](https://github.com/zowe/zowe-cli/blob/next/docs/Early%20Access%20-%20Using%20Global%20Profile%20Configuration.md#installing-next-version).

   Ensure that the CLI and @Next versions are compatible.

2. [Initialize](https://github.com/zowe/zowe-cli/blob/next/docs/Early%20Access%20-%20Using%20Global%20Profile%20Configuration.md#initializing-global-configuration) the Global Configuration file.

   Your Zowe home directory should contain the `zowe.config.json` and `zowe.schema.json` files.

3. [Customize](https://github.com/zowe/zowe-cli/blob/next/docs/Early%20Access%20-%20Using%20Global%20Profile%20Configuration.md#editing-configuration) the Global Configuration file.

## Install the @Next Release version

Install @Next.

**Follow these steps**:

1. Download the latest [@Next release version](https://github.com/zowe/vscode-extension-for-zowe/releases) from the Zowe Explorer Github release page.
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

The global profile functionality simplifies profile management by enabling you to edit, store, and share mainframe configuration details in one location. You can use a text editor or an IDE to populate configuration files with connection details for your mainframe services. By default, your global configuration profile is located in .zowe home folder, whereas a project-level configuration file is located in the main directory of your project.

**Note**: A project context takes precedence over global configuration.

### Manage a Profile

You can edit your project-level or global configuration profiles.

**Follow these steps**:

1. Right-click on your profile.
2. Select the **Add**, **Update**, or **Delete Profile** options to edit the global `zowe.config.json` file.

   **Tip**: Use the Intellisense prompts if you need assistance with filling parameters in the .json file.

3. Reload your VS Code window by clicking **View** > **Command Palette** > **Developer: Reload Window** so that the changes take effect.

You successfully edited your configuration profile.
