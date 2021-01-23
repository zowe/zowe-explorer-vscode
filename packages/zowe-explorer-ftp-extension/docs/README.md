# Zowe Explorer Extension for FTP development guide

Zowe Explorer Extension for FTP is an example for using the Zowe Explorer extensibility API to add an alternative implementation for interacting with z/OS. The default Zowe Explorer implementation using the default Zowe CLI APIs for using z/OSMF REST APIs. This implementation replaces these with z/OS FTP for interacting with USS.

Although currently limited to USS the plan is to complete the implementation to supporting MVS and JES as well.

## How to build

This repo uses [Yarn](https://yarnpkg.com/) for building.

- Clone this `zowe-explorer` repo:
  ```bash
  git clone git@github.com:zowe/zowe/vscode-extension-for-zowe.git
  ```
- Build the entire repo comprising of Zowe Explorer, Zowe Explorer API, and Zowe Explorer FTP with
  ```bash
  yarn && yarn package
  ```

## How to run and debug

- Once the build is finished you find two VSIX files and one TGZ file in the top-level `dist` folder. If you have not installed Zowe Explorer yet into VS Code, then use the `dist/vscode-extension-for-zowe-1.??.?.vsix` file to install it as the FTP extension requires it to be installed.
- In VS Code switch to the Run activity group.
- In the RUN drop-down select `Run Zowe Explorer FTP VS Code Extension` and click the Play button to start it.
- Set breakpoints to explore the code.

## Review the sources

As you will see the implementation of this extension is very small and minimal. The main file to explore is `packages/zowe-explorer-ftp-extension/src/ZoweExplorerFtpApi.ts`, which is the FTP implementation of all the Zowe Explorer API methods required for USS. The interface defining these operations you find in the Zowe Explorer API under `packages/zowe-explorer-api/src/profiles/ZoweExplorerApi.ts`.

As you will see, these FTO operation are not directly implemented in that file, but rather reuse and call the using the code provided by the z/OS FTP Plug-in for Zowe™ CLI and linked via `@zowe/zos-ftp-for-zowe-cli"` NPM dependency.

The other source file `packages/zowe-explorer-ftp-extension/src/extension.ts` defines the actual VS Code extension as well as implements the registration API required to link this VS Code extension to Zowe Explorer itself. You see the `registerFtpApi()` in `extension.ts` that queries the Zowe Explorer API and calls a registration method. This registration will make Zowe Explorer find this extension after activation and add its API implementation to the USS explorer view.
