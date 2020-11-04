# Zowe Explorer FTP extension

An example VS Code extension demonstrating how to use the Zowe Explorer extension API. It implements Zowe CLI FTP plugin support for the USS explorer. You can then create Zowe CLI FTP profiles and add them to the USS Zowe Explorer to use the FTP protocol for accessing files instead of zOSMF.

## How to build

### Install the latest Zowe Explorer

This example will ony work with version 1.2.0 or newer of the Zowe Explorer.

- Install it from the VS Code Marketplace following [the instructions described here](https://marketplace.visualstudio.com/items?itemName=Zowe.vscode-extension-for-zowe).
- Test the Zowe Explorer using z/OSMF CLI profiles if you have z/OSMF available.

### Create a Zowe FTP profile

This example is using the Zowe FTP CLI plugin as a dependency to provide FTP capabilities.

- Go to the Zowe FTP CLI Plugin GitHub repository for instructions for how to install it: <https://github.com/zowe/zowe-cli-ftp-plugin>
- Create Zowe CLI FTP profile:
  ```bash
  zowe profiles create zftp <profile name> -H <host> -u <user> -p <password> -P <port>
  ```

### Build this extension

This repo uses [Yarn](https://yarnpkg.com/) for building.

- Clone this `zowe-explorer-ftp-extension` repo:
  ```bash
  git clone git@github.com:zowe/zowe-explorer-ftp-extension.git
  ```
- Build the VS Code extension with
  ```bash
  yarn && yarn package
  ```
- Install the vsix file using the `Preferences > Extensions` menu or just run this extension from VS Code that has the Zowe Explorer built from the AI branch running with the `<F5>` key.

## Using the FTP Extension

- Start VS Code with the extension installed or via the `<F5>` out of the development workspace as described above.
- A message will be shown telling you that activation was successful.
- Click the `+` icon and you will see your Zowe FTP profile listed in the drop-down.
- Select it and it will appear in the USS Explorer.
- Click the Search icon next to it to specify a USS path to list it.
- Try opening and saving files.

## How to create your own Zowe Explorer extension

TBD, but the rough steps would be:

- Copy the file `src/api/ZoweExplorerAPI.ts`
- Implement classes that implement any of the `IMvs`, `IUss`, `IJes` interfaces.
- Implement a registration method similar to `registerFtpApi()` in `extension.ts` that queries the Zowe Explorer API and calls the registration method.
