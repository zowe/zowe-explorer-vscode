# Zowe Explorer Extension for FTP

Zowe Explorer's FTP extension adds the FTP protocol to the [Zowe Explorer](https://github.com/zowe/vscode-extension-for-zowe) VS Code extension, allowing you to use [z/OS FTP Plug-in for Zowe CLI](https://github.com/zowe/zowe-cli-ftp-plugin) profiles to connect and interact with z/OS USS.

This VS Code extension also serves as a [source code example](https://github.com/zowe/vscode-extension-for-zowe/tree/master/packages/zowe-explorer-ftp-extension) demonstrating how to use the [Zowe Explorer Extensibility API](https://github.com/zowe/vscode-extension-for-zowe/tree/master/packages/zowe-explorer-api) to create VS Code extensions that extend the Zowe Explorer VS Code extensions with new capabilities.

## Installation

1. Install this VS Code extension from the [Microsoft](https://marketplace.visualstudio.com/items?itemName=Zowe.zowe-explorer-ftp-extension) or [Open VSX](https://open-vsx.org/extension/Zowe/zowe-explorer-ftp-extension) marketplace.
1. If you do not have Zowe Explorer installed, it will automatically install it for you as it is a required dependency.
1. After the install, when Zowe Explorer now activates it will show a VS Code info message "Zowe Explorer was modified for FTP support." to confirm that the FTP extension is available within Zowe Explorer.

## Using the FTP Extension

To use the FTP extension with Zowe Explorer:

1. Open the Zowe Explorer activity bar in VS Code to see its three explorer views (Data Sets, USS, and Jobs).
1. In the USS view, click the `+` icon and you will see your existing Zowe CLI FTP profiles listed in the drop-down to select.
1. Select your Zowe FTP profile and it will appear in the USS view.
1. In the USS view, click the Search icon next to your newly-added profile, and specify a USS path to list it.
1. Try opening and saving files.

If you do not have an existing Zowe FTP profile, you can create one graphically with Zowe Explorer:

1. In the USS Explorer view, click the `+` icon and select `Create a New Connection to z/OS`.
1. Provide a name for your profile.
1. You will be prompted for the type of connection you want to create. The drop-down dialog will show you the types of all the extension available, such as `zosmf` and `zftp`.
1. Select `zftp` and continue providing values for the prompts shown. As you will see, the questions prompted are now specific for FTP-type connections and match the parameters available in the FTP plugin for Zowe CLI.

## Using the Zowe CLI FTP plugin

Whe using this extension, we also recommend that you are already familiar with the [z/OS FTP Plug-in for Zowe CLI](https://github.com/zowe/zowe-cli-ftp-plugin) that this extension is based on. Not all capabilities that this plugin provides have yet be implemented for Zowe Explorer so it would greatly augment your user experience.

The following steps are not required, as the Zowe Explorer FTP extension also includes the capability of creating such a profile in the Zowe Explorer UI as described below. However, to enable FTP for Zowe CLI and reuse the profile created for Zowe CLI also in Zowe Explorer, install the plugin and create the profile via command line:

1. Go to the [z/OS FTP Plug-in for Zowe CLI](https://github.com/zowe/zowe-cli-ftp-plugin) GitHub repository and review the installation instructions for installing it into Zowe CLI. In short, after [meeting the prerequisites](https://github.com/zowe/zowe-cli-ftp-plugin#software-requirements), the command is:

   ```bash
   zowe plugins install @zowe/zos-ftp-for-zowe-cli@latest
   ```

1. Create Zowe FTP profile:

   ```bash
   zowe profiles create zftp <profile name> -H <host> -u <user> -p <password> -P <port>
   ```

Now you can run `zowe zos-ftp` commands as documented in the docs for the plugin. This profile can then also be selected in Zowe Explorer's Add Profile dialogs once this Zowe Explorer FTP VS Code extension is installed.

## Providing feedback or help contributing

Zowe Explorer's FTP extension is now part of the [Zowe Explorer monorepo on Github](https://github.com/zowe/vscode-extension-for-zowe). You can find the sources there in the `/packages/zowe-explorer-ftp-extension` sub-folder.

To file issues, use the [Zowe Explorer issue list](https://github.com/zowe/vscode-extension-for-zowe/issues).

For [instructions on how to build](https://github.com/zowe/vscode-extension-for-zowe/tree/master/packages/zowe-explorer-ftp-extension/docs/README.md) the extension, see the `docs` sub-folder.
