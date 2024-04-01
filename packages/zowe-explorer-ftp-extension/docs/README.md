# Zowe Explorer Extension for FTP development guide

Zowe Explorer Extension for FTP is an example for using the Zowe Explorer extensibility API to add an alternative implementation for interacting with z/OS. The default Zowe Explorer implementation uses the default Zowe CLI APIs for using z/OSMF REST APIs. This implementation replaces these with z/OS FTP for interacting with USS.

Although currently limited to USS, the plan is to complete the implementation to supporting MVS and JES as well.

## How to build

This repo uses [PNPM](https://pnpm.io/) for building.

1. Clone this `zowe-explorer` repo:

   ```bash
   git clone git@github.com:zowe/zowe/zowe-explorer-vscode.git
   ```

1. Build the entire repo comprising of Zowe Explorer, Zowe Explorer API, and Zowe Explorer FTP with the following command:

   ```bash
   pnpm install && pnpm package
   ```

## How to run and debug

1. Once the build is finished, you will find two VSIX files and one TGZ file in the top-level `dist` folder. If you have not installed Zowe Explorer yet into VS Code, then use the `dist/vscode-extension-for-zowe-1.??.?.vsix` file to install it as the FTP extension requires it to be installed.
1. In VS Code, switch to the Run activity group.
1. In the RUN drop-down select `Run Zowe Explorer FTP VS Code Extension` and click the Play button to start it.
1. Set breakpoints to explore the code.

## Review the sources

As you will see, the implementation of this extension is very small and minimal. The main file to explore is `packages/zowe-explorer-ftp-extension/src/ZoweExplorerFtpApi.ts`, which is the FTP implementation of all the Zowe Explorer API methods required for USS. You can find the interface defining these operations in the Zowe Explorer API package under `packages/zowe-explorer-api/src/extend/interfaces.ts`.

These FTP operations are not directly implemented in that file, but rather reuse and call the code provided by the z/OS FTP Plug-in for Zowe™ CLI, and are linked via the `@zowe/zos-ftp-for-zowe-cli` NPM dependency.

The other source file `packages/zowe-explorer-ftp-extension/src/extension.ts` defines the actual VS Code extension as well as implements the registration API required to link this VS Code extension to Zowe Explorer itself. You can see that `registerFtpApi()` in `extension.ts` queries the Zowe Explorer API and calls a registration method. This registration will make Zowe Explorer find this extension after activation and add its API implementation to the USS explorer view.
