# Extensibility API for Zowe Explorer

[![version](https://img.shields.io/npm/v/@zowe/zowe-explorer-api)](https://img.shields.io/npm/v/@zowe/zowe-explorer-api)
[![downloads](https://img.shields.io/npm/dt/@zowe/zowe-explorer-api)](https://img.shields.io/npm/dt/@zowe/zowe-explorer-api)

Extensibility API for Zowe Explorer is a collection of APIs that can be used to extend the [Zowe Explorer](https://github.com/zowe/zowe-explorer-vscode) VS Code extension with alternative z/OS interaction protocols and new capabilities. These capabilities are built for use in (and alongside) Zowe Explorer, and include: tree view management, Zowe profiles and security assistance, UI functions and logging utilities.

The following kinds of extensions can be certified as compliant for Zowe Explorer. Check out the [v3 Conformance Program](https://openmainframeproject.org/our-projects/zowe-conformance-program/) for the specific criteria.

Extension offerings need to comply with the General extension category along with at least one of the other following categories.

1. General requirements: VS Code extensions that utilizes Zowe Explorer resources in any way must meet all general requirements.
1. Leverage team configuration: An extension that accesses Zowe Explorer's profile cache to utilize or manage profiles.
1. Data Provider: An extension that provides an alternative profile type for a different z/OS communication protocol for one or more Zowe Explorer views.
1. Menus: An extension that contributes menus to Zowe Explorer tree views and/or accesses contextual information from the trees.

Examples of extenders of the Zowe Explorer VS Code extension include the [IBM z/OS FTP for Zowe Explorer](https://github.com/zowe/zowe-explorer-vscode/tree/main/packages/zowe-explorer-ftp-extension) and [IBM CICS for Zowe Explorer](https://github.com/zowe/cics-for-zowe-client/tree/main/packages/vsce) VS Code extension, as well as several commercial extensions.

For more information about extending Zowe Explorer via the Extensibility API for Zowe Explorer, check out the [Extending Zowe Explorer](https://github.com/zowe/zowe-explorer-vscode/wiki/Extending-Zowe-Explorer) wiki page.

## Providing feedback or help contributing

Extensibility API for Zowe Explorer is part of the [Zowe Explorer monorepo on Github](https://github.com/zowe/zowe-explorer-vscode). You find the sources there in the `/packages/zowe-explorer-api` sub-folder.

To submit a bug report or enhancement request, open an issue in the [Zowe Explorer repository](https://github.com/zowe/zowe-explorer-vscode/issues).
