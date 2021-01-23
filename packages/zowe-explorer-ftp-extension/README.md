# Zowe Explorer Extension for FTP

Zowe Explorer's FTP extension adds the FTP protocol to the [Zowe Explorer](https://github.com/zowe/vscode-extension-for-zowe) VS Code extension allowing you to use [z/OS FTP Plug-in for Zowe CLI](https://github.com/zowe/zowe-cli-ftp-plugin) profiles to connect and interact with z/OS USS.

This VS Code extension also serves as a [source code example](https://github.com/zowe/vscode-extension-for-zowe/tree/master/packages/zowe-explorer-ftp-extension) demonstrating how to use the [Zowe Explorer Extensibility API](https://github.com/zowe/vscode-extension-for-zowe/tree/master/packages/zowe-explorer-api) to create VS Code extensions that extend the Zowe Explorer VS Code extensions with new capabilities.

## Create a Zowe FTP profile

To use this extension we recommend that you are already familiar with the [z/OS FTP Plug-in for Zowe CLI](https://github.com/zowe/zowe-cli-ftp-plugin) and have installed it and created a profile. These steps are not required, as the Zowe Explorer FTP extension also includes the capability of creating such a profile in the Zowe Explorer UI as described below.

However, to also enable Zowe CLI for FTP and reuse the profile created for Zowe CLI also in Zowe Explorer install the plugin and create the profile via command line:

- Go to the [z/OS FTP Plug-in for Zowe CLI](https://github.com/zowe/zowe-cli-ftp-plugin) GitHub repository and review the installation instructions for installing it into Zowe CLI. In short the command is
  ```bash
  zowe plugins install @zowe/zos-ftp-for-zowe-cli@latest
  ```
- Create Zowe CLI FTP profile:
  ```bash
  zowe profiles create zftp <profile name> -H <host> -u <user> -p <password> -P <port>
  ```

Now you can run `zowe zos-ftp` commands as documented in the docs for the plugin. This profile can then also be selected in Zowe Explorer's Add Profile dialogs once this Zowe Explorer FTP VS Code extension is installed.

## Installation

- Install this VS Code extension from the [Microsoft](https://marketplace.visualstudio.com/items?itemName=Zowe.zowe-explorer-ftp-extension) or [Open VSX](https://open-vsx.org/extension/Zowe/zowe-explorer-ftp-extension) marketplace.
- If you do not have Zowe Explorer installed it will automatically install it for you as it is a required dependency.
- After the install when Zowe Explorer now activates it will show a VS Code info message "Zowe Explorer was modified for FTP support." to confirm that the FTP extension is available withing Zowe Explorer.

## Using the FTP Extension

To use the FTP extension with Zowe Explorer:

- Open the Zowe Explorer activity bar in VS Code to see its three explorer views.
- In the USS view, click the `+` icon and you will see your exiting Zowe CLI FTP profiles listed in the drop-down to select.
- Select it and it will appear in the USS Explorer.
- Click the Search icon next to it to specify a USS path to list it.
- Try opening and saving files.

If you do not have a Zowe CLI FTP Plugin profile you can create it graphically with Zowe Explorer:

- In the USS Explorer view click the `+` icon and select `Create a New Connection to z/OS`
- Provide a name for your profile
- Now it will prompt you for the type of connection you want to create showing you the types of all the extension available, hence as a minimum `zosmf` and `zftp`.
- Select `zftp` and continue providing value for the prompts shown. As you will see the questions prompted are now specific for the type FTP and match the parameters available for the FTP Zowe CLI plugin.

## Providing feedback or help contributing

Zowe Explorer's FTP extension is now part of the [Zowe Explorer monorepo on Github](https://github.com/zowe/vscode-extension-for-zowe). You find the sources there in the `/packages/zowe-explorer-ftp-extension` sub-folder.

To file issues use the [Zowe Explorer issue list](https://github.com/zowe/vscode-extension-for-zowe/issues).

For [instructions for how to build](https://github.com/zowe/vscode-extension-for-zowe/tree/master/packages/zowe-explorer-ftp-extension/docs/README.md) the extension see the `docs` sub-folder.
