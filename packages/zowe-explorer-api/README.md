# Extensibility API for Zowe Explorer

[![version](https://img.shields.io/npm/v/@zowe/zowe-explorer-api)](https://img.shields.io/npm/v/@zowe/zowe-explorer-api)
[![downloads](https://img.shields.io/npm/dt/@zowe/zowe-explorer-api)](https://img.shields.io/npm/dt/@zowe/zowe-explorer-api)

Extensibility API for Zowe Explorer is a collection of APIs that can be used to extend the [Zowe Explorer](https://github.com/zowe/zowe-explorer-vscode) VS Code extension with alternative z/OS interaction protocols and new capabilities.

The API is used by extenders of the Zowe Explorer VS Code extension, including the [IBM z/OS FTP for Zowe Explorer](https://github.com/zowe/zowe-explorer-vscode/tree/main/packages/zowe-explorer-ftp-extension) and [IBM CICS for Zowe Explorer](https://github.com/zowe/cics-for-zowe-client/tree/main/packages/vsce) VS Code extensions, as well as several commercial extensions.

The API is organized into modules that are exposed through the top-level `index.ts` file for convenient access.

- `/profiles`: Provides access to common Zowe CLI profile management APIs, as well as abstractions for providing alternative z/OS interactions that use protocols other than z/OSMF, based on alternative Zowe CLI profile types.
- `/tree`: Provides abstractions for accessing and extending the Zowe Explorer VS Code tree views.
- `/logger`: Logs messages in a standard format, which is used by Zowe Explorer and will be consistent across Zowe components.

## Profiles API

The `/profiles` module has no dependency to VS Code and could be used in Zowe CLI extensions as well as VS Code extensions. If you want to use it without pulling in dependencies to VS Code that are needed by the `/tree` module, you can import it like this:

```ts
import { ZoweExplorerApi } from "@zowe/zowe-explorer-api/lib/profiles";
```

The main API provided by the `/profiles` module is called `ZoweExplorerApi`. It defines a namespace for interfaces for implementing access to z/OS MVS, USS, and JES. You can see that the Zowe Explorer FTP Extension provides such an alternative implementation for USS using the FTP protocol in [packages/zowe-explorer-ftp-extension/src/ZoweExplorerFtpMvsApi.ts](https://github.com/zowe/zowe-explorer-vscode/tree/main/packages/zowe-explorer-ftp-extension/src/ZoweExplorerFtpMvsApi.ts). The `/profiles` module itself contains Zowe Explorer's default implementation using z/OSMF in [packages/zowe-explorer-api/src/profiles/ZoweExplorerZosmfApi.ts](https://github.com/zowe/zowe-explorer-vscode/tree/main/packages/zowe-explorer-api/src/profiles/ZoweExplorerZosmfApi.ts)

Zowe Explorer itself exports a `IApiRegisterClient` object that can be used for an alternative implementation to be registered with Zowe Explorer. You can find an example for doing this in [packages/zowe-explorer-ftp-extension/src/extension.ts](https://github.com/zowe/zowe-explorer-vscode/tree/main/packages/zowe-explorer-ftp-extension/src/extension.ts). To be able to do this, your VS Code extension must define a dependency to Zowe Explorer to ensure that VS Code extension activation is performed in the correct order. Therefore, your VS Code extension's `package.json` must contain

```json
"extensionDependencies": [
  "Zowe.vscode-extension-for-zowe"
]
```

## Tree API

Importing from the `/tree` module requires that your NPM package has a dependency to VS Code as it performs

```ts
import * as vscode from "vscode";
```

imports.

See this [documentation on Extending Zowe Explorer](https://github.com/zowe/zowe-explorer-vscode/wiki/Extending-Zowe-Explorer) to learn more about the Tree APIs available.

## Logger API

See this [special extension document](https://github.com/zowe/zowe-explorer-vscode/wiki/Error-Handling-for-Extenders#logging-of-error-message) for more information about using the Logger API.

## Providing feedback or help contributing

Extensibility API for Zowe Explorer is part of the [Zowe Explorer monorepo on Github](https://github.com/zowe/zowe-explorer-vscode). You find the sources there in the `/packages/zowe-explorer-api` sub-folder.

To submit a bug report or enhancement request, open an issue in the [Zowe Explorer repository](https://github.com/zowe/zowe-explorer-vscode/issues).
