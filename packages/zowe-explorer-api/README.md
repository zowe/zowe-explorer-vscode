# Extensibility API for Zowe Explorer

[![version](https://img.shields.io/npm/v/@zowe/zowe-explorer-api)](https://img.shields.io/npm/v/@zowe/zowe-explorer-api)
[![downloads](https://img.shields.io/npm/dt/@zowe/zowe-explorer-api)](https://img.shields.io/npm/dt/@zowe/zowe-explorer-api)

Extensibility API for Zowe Explorer is a collection of APIs that can be used to extend the [Zowe Explorer](https://github.com/zowe/vscode-extension-for-zowe) VS Code extension with alternative z/OS interaction protocols and new capabilities.

The current state of this API is experimental, but the goal is provide a stabilized version that can be used for Zowe Conformance certifications in the future. See this issue for more details: <https://github.com/zowe/vscode-extension-for-zowe/issues/837>.

However, the current API is being used by other extensions already, such as for Zowe Explorer with the [Zowe Explorer FTP Extension](../zowe-explorer-ftp-extension) that you can find in this same Git repository, as well as for commercial extensions maintained by Zowe's contributors and available on their company websites.

Currently, the API is organized into two modules, which both are rolled up into the top-level `index.ts` file for convenient access.

- `/profiles`: Provides access to common Zowe CLI profile management APIs, as well as abstractions for providing alternative z/OS interactions that use protocols other than z/OSMF, based on alternative Zowe CLI profile types.
- `/tree`: Provides abstractions for accessing and extending the Zowe Explorer VS Code tree views.
- `/logger`: Logs messages in a standard format, which is used by Zowe Explorer and will be consistent across Zowe components.

## Profiles API

The `/profiles` module has no dependency to VS Code and could be used in Zowe CLI extensions as well as VS Code extensions. If you want to use it without pulling in dependencies to VS Code that are needed by the `/tree` module, you can import it like this:

```ts
import { ZoweExplorerApi } from "@zowe/zowe-explorer-api/lib/profiles";
```

The main API provided by the `/profiles` module is called `ZoweExplorerApi`. It defines a namespace for interfaces for implementing access to z/OS MVS, USS, and JES. You can see that the Zowe Explorer FTP Extension provides such an alternative implementation for USS using the FTP protocol in [packages/zowe-explorer-ftp-extension/src/ZoweExplorerFtpApi.ts](../zowe-explorer-ftp-extension/src/ZoweExplorerFtpApi.ts). The `/profiles` module itself contains Zowe Explorer's default implementation using z/OSMF in [packages/zowe-explorer-api/src/profiles/ZoweExplorerZosmfApi.ts](./src/profiles/ZoweExplorerZosmfApi.ts)

Zowe Explorer itself exports a `ZoweExplorerApi.IApiRegisterClient` object that can be used for an alternative implementation to be registered with Zowe Explorer. You can find an example for doing this in [packages/zowe-explorer-ftp-extension/src/extension.ts](../zowe-explorer-ftp-extension/src/extension.ts). To be able to do this, your VS Code extension must define a dependency to Zowe Explorer to ensure that VS Code extension activation is performed in the correct order. Therefore, your VS Code extension's `package.json` must contain

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

See this [documentation on Extending Zowe Explorer](https://github.com/zowe/vscode-extension-for-zowe/wiki/Extending-Zowe-Explorer) to learn more about the Tree APIs available.

## Logger API

See this [special extension document](https://github.com/zowe/vscode-extension-for-zowe/wiki/Error-Handling-for-Extenders#logging-of-error-message) for more information about using the Logger API.

## Providing feedback or help contributing

Extensibility API for Zowe Explorer is part of the [Zowe Explorer monorepo on Github](https://github.com/zowe/vscode-extension-for-zowe). You find the sources there in the `/packages/zowe-explorer-api` sub-folder.

To file issues, use the [Zowe Explorer issue list](https://github.com/zowe/vscode-extension-for-zowe/issues) after reviewing the [API Roadmap item](https://github.com/zowe/vscode-extension-for-zowe/issues/837).
