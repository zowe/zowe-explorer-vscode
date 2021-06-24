# VS Code extensions for Zowe Explorer (Draft)

Zowe Explorer provides extension APIs that assist third party extenders to create extensions that access Zowe Explorer resource entities to enrich the user experience. There are many ways Zowe Explorer can be extended to support many different use cases. We, the Zowe Explorer core contributors, have defined APIs, guidelines, as well as formal compliance criteria for three popular ways of extending it, but we encourage you to engage with us to discuss other ways for extensions that you envision that we did not yet consider.

## Kinds of extensions

The following kinds of extensions can be certified as compliant for Zowe Explorer. See the [README-Conformance.md](README-Conformance.md) file for
the specific criteria. This document will deep dive into several of these to give extenders more guidance and examples.

One extension offering needs to comply with at least one of these kinds, but it can also be in several or all of the kinds listed. In addition to fulfilling all the required criteria for at least one kind (1 to 3), the candidate extension also needs to fulfill the required criteria of the (0) General category.

0. **General** extension. A generic VS Code extension that utilizes Zowe Explorer resources in any way.
1. **Profiles access**: An extension that accesses the Zowe Explorer Zowe CLI profiles caches for read or write operations.
2. **Data Provider**: An extension that provides an alternative Zowe CLI profile type for a different z/OS communication protocol for one or more Zowe Explorer views. The [Zowe Explorer FTP Extension](../packages/zowe-explorer-ftp-extension) that is part of this repository is an example for a Data Provider.
3. **Menus**: An extension that injects new menus into the existing Zowe Explorer tree views accessing contextual information from the tree nodes.

## Getting Started with extending Zowe Explorer

Extender packages are created as new VS Code extensions. For general information about VS Code extensions, visit the following links:

- [Using extensions in Visual Studio Code](https://code.visualstudio.com/docs/introvideos/extend)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [vscode-extension-samples](https://github.com/Microsoft/vscode-extension-samples)

I is also recommended to set-up a development environment for Zowe Explorer itself following the instructions in [README-Developer.md](README-Developer.md) to learn its codebase and study of the extensibility API's implementations.

The Zowe Explorer API package provided in this GitHub repository is comprised of three sub-packages for different use cases. Modules from these sub-packages will be used in the description of the various extension cases below:

- [profiles](../packages/zowe-explorer-api/src/profiles): Contains the API declarations as well as an implementation for an in-memory Zowe CLI profiles cache. All modules in this folder have been written completely independent of VS Code and can therefore be reused also in other NPM packages such as Zowe CLI plugins.
- [tree](../packages/zowe-explorer-api/src/tree): Contains VS Code-specific APIs such as the interfaces used to overlay the VS Code tree views with additional Zowe Explorer data. These interfaces can be used to navigate the Zowe Explorer tree views for the implementation of extensions that implement additional menus and operations.
- [security](packages/zowe-explorer-api/src/security): Contains VS Code-specific APIs for initializing and accessing the secure credentials store used by Zowe.

## Zowe Explorer extension dependencies and activation

Although not required for all types of Zowe Explorer extensions, when creating an extension for Zowe Explorer it is in many cases necessary to specify a dependency in the package.json file of the Zowe Explorer extension:

```json
"extensionDependencies": [
    "zowe.vscode-extension-for-zowe"
],
```

This dependency has then two important effects:

1. It will enforce that the Zowe Explorer is a pre-requisite package for the Zowe Explorer extension, which will automatically install Zowe Explorer when the Zowe Explorer extension is installed in case it is not yet present.
1. It will enforce that Zowe Explorer is activated first at startup before the dependent Zowe Explorer extension. This ensures that important data structures related to the extensibility API have been properly initialized and can be called in the activation of the Zowe Explorer extensions own activation.

## About Zowe CLI profiles

Zowe Explorer's main capability is to provide access to z/OS resources in MVS, USS, JES as well as execution of various commands such as TSO commands. To realize these interactions it builds on Zowe CLI. One could say that Zowe Explorer provides a graphical user interface for most of the core Zowe CLI commands in form of tree view navigators, menus and pop-up dialogs. The core concept that defines a connection to z/OS in Zowe CLI is the profile. Profiles are created for different interaction protocols such as z/OSMF or FTP and stored for the current user in a location defined by Zowe CLI. Zowe Explorer accesses this same profile store.

Zowe Explorer extension can also access this profiles store via Zowe Explorer APIs, as well as extend the profiles store with new types of profiles for supporting new or alternative interaction protocols.

In case a new profile type is provided it is a recommended practice, but not required, to also provide a Zowe CLI plugin for this new profile type that implements the capabilities provided by the new profile type, which then can be reused when writing the Zowe Explorer extension. A Zowe CLI plugin is just a normal npm package that can be imported into VS Code extensions for reuse to enable code sharing between CLI plugin and VS Code extension. However, when such a Zowe CLI Plugin is provided by the extender the Zowe Explorer VS Code extension must not make the assumption that this Plugin is actually installed on the user's machine. All the code for creating and using the profile needs to be included into the VS Code extension to allow using it on development machines that did not install Zowe CLI as well.

In other words the extension must be full self-contained including all the code of the Zowe CLI Plugin that implements the new profile. This will not only simplify the end user experience, but also ensures that the extension can run in other VS Code compatible environments such as Cloud IDEs such as Eclipse Che that might or might not come with a sidecar that provide Zowe CLI. To test this requirement a user shall be able start the extension and use it without having Nodejs and Zowe CLI installed locally. Zowe Explorer provides APIs to call that ensure that the users can store and access new profile types in the Zowe home directory folders as well as the common secure credentials store, which should be utilized by the Zowe Explorer extensions as well.

## Accessing the Zowe Explorer Extender API

To create a VS Code extension that accesses the Zowe Explorer API you need to

1. define a VS Code extension dependency as [described above](#zowe-explorer-extension-dependencies-and-activation) to ensure Zowe Explorer API gets activated and initialized before your extension and
2. define an NPM dependency to the Zowe Explorer API in your VS Code extension's package.json file to get access to Typescript type definitions provided for the API:

```json
"dependencies": {
    "@zowe/zowe-explorer-api": "1.16.0"
}
```

Then you will be able to get access to initialized Zowe Explorer API objects provided by VS Code during or after activation. The following code snippet shows how to gain access:

```typescript
export function activate(context: vscode.ExtensionContext) {
  // this is the main operation to call to retrieve the ZoweExplorerApi.IApiRegisterClient object
  // use the optional parameter to constrain the version or newer of Zowe Explorer your extension is supporting
  const zoweExplorerApi = ZoweVsCodeExtension.getZoweExplorerApi("1.15.0");
  if (zoweExplorerApi) {
    // access the API such as registering new API implementations
    // <your code here>
    return true;
  }
  void vscode.window.showInformationMessage("Zowe Explorer was not found: Notify the user with a message.");
  return false;
}
```

Once you have access to the `ZoweExplorerApi.IApiRegisterClient` instance return by the call shown above you have access to various methods. Check all the declarations in the [interface specification in the source code](../packages/zowe-explorer-api/src/profiles/ZoweExplorerApi.ts).

Most of the operations listed are needed for registering new implementations of a new data provider as described further below in the Section [Creating an extension that adds a data provider](#creating-an-extension-that-adds-a-data-provider).

The operation `IApiRegisterClient.getExplorerExtenderApi(): IApiExplorerExtender` will give you access to profiles as documented in the next section.

## Creating an extension that accesses Zowe Explorer profiles

A Zowe CLI profiles access extension is a Zowe Explorer extension that uses the Zowe Extensibility API to conveniently access Zowe CLI profiles loaded by Zowe Explorer itself. This allows the extension to consistently access profile instances of specific types, offer them for edit and updates as well as common refresh operations that apply to all extensions, add more profile types it is using itself for its own custom views (for example a CICS extension adding a CICS explorer view) and other similar use cases related to Zowe CLI profiles. These extensions do **not** have to be VS Code extension if it just wants to use ProfilesCache implementation of Zowe Explorer as all APIs are provided free of any VS Code dependencies. Such an extension could be used for another non-VS Code tool, a Zowe CLI plugin, a Web Server or another technology. However, to access the profiles cache of the actual running VS Code Zowe Explorer the extender needs to be a VS Code extension that has an extension dependency defined to be able to query the extender APIs. Therefore, some of the criteria that are listed here as required are only required if the extender is a VS Code extension.

When creating such an extension you need to follow the steps described above for accessing the Zowe Explorer API. Then by calling the `getExplorerExtenderApi()` operation on the returned object you have access to various operations on profiles. See the [ZoweExplorerExtender.ts](../packages/zowe-explorer/src/ZoweExplorerExtender.ts)] file in the main `zowe-explorer` package for details on the implementation of the various operations.

Currently provided operations:

- `reloadProfiles(): Promise<void>;`
- `initForZowe(type: string, meta: ICommandProfileTypeConfiguration[]): Promise<void>;`

```typescript
const zoweExplorerApi = ZoweVsCodeExtension.getZoweExplorerApi("1.15.0");
if (zoweExplorerApi) {
  // Initialized the users ~/.zowe directory with the metadata for FTP profiles in case
  // the user does not have the FTP CLI Plugin installed and profiles created, yet.
  const meta = await CoreUtils.getProfileMeta();
  await zoweExplorerApi.getExplorerExtenderApi().initForZowe("zftp", meta);
  await zoweExplorerApi.getExplorerExtenderApi().reloadProfiles();
```

TODO:

- Add methods of accessing and manipulating profiles cache
- Add methods for returning tree views for a profile type

## Creating an extension that adds a data provider

A data provider Zowe Explorer extension that accesses Zowe Explorer profiles as well as provides an alternative protocol for Zowe Explorer to interact with z/OS. The default protocol Zowe Explorer uses is the z/OSMF REST APIs and data provider adds support for another API. For example, the Zowe Explorer extension for zFTP, which is maintained by the Zowe Explorer squad is an example for a Zowe Explorer data provider extension that uses FTP instead of z/OSMF for all of its USS and MVS interactions. To achieve such an extension it uses a Zowe CLI Plugin for FTP that implemented the core interactions and provided them as an SDK. The CLI also defined a new Zowe CLI profile type (zftp) that is used to identify and register the new data provider implementations.

To implement as data provider Zowe Explorer extension you need to

1. Implement at least one of the four available interfaces used by the API for data providers (`IUss`, `IMvs`, `IJes`, `ICommand`) as well as the `ICommon` interface as specified in [ZoweExplorerApi.ts](../packages/zowe-explorer-api/src/profiles/ZoweExplorerApi.ts). The new implementation must be using a new Zowe CLI profile type name for identification.
2. Register your API implementation with the `IApiRegisterClient` returned by Zowe Explorer during activation of your VS Code extension as shown below.
3. Initialize the user's .zowe directory with meta-data for the new profile type.

```typescript
const zoweExplorerApi = ZoweVsCodeExtension.getZoweExplorerApi("1.15.0");
if (zoweExplorerApi) {
  // Register new implementations of data provider using FTP for three Zowe Explorer views
  zoweExplorerApi.registerUssApi(new FtpUssApi());
  zoweExplorerApi.registerMvsApi(new FtpMvsApi());
  zoweExplorerApi.registerJesApi(new FtpJesApi());

  // Initialized the users ~/.zowe directory with the metadata for FTP profiles in case
  // the user does not have the FTP CLI Plugin installed and profiles created, yet.
  const meta = await CoreUtils.getProfileMeta();
  await zoweExplorerApi.getExplorerExtenderApi().initForZowe("zftp", meta);
  await zoweExplorerApi.getExplorerExtenderApi().reloadProfiles();
```

The FTP Zowe Explorer extension provides examples for providing a data provider for the FTP protocol. The extension provides data providers for USS, MVS, as well as JES. There are three modules in the source code that implement the required operations of the Zowe Explorer API for each view in the `packages/zowe-explorer-ftp-extension/src` folder:

- [ZoweExplorerFtpMvsApi.ts](../packages/zowe-explorer-ftp-extension/src/ZoweExplorerFtpMvsApi.ts)
- [ZoweExplorerFtpUssApi.ts](../packages/zowe-explorer-ftp-extension/src/ZoweExplorerFtpUssApi.ts)
- [ZoweExplorerFtpJesApi.ts](../packages/zowe-explorer-ftp-extension/src/ZoweExplorerFtpJesApi.ts)

These are parallel implementations of the same operations that are provided by Zowe Explorer itself using the z/OSMF interaction protocol. You can find that implementation for reference in the file [packages/zowe-explorer-api/src/profiles/ZoweExplorerZosmfApi.ts](../packages/zowe-explorer-api/src/profiles/ZoweExplorerZosmfApi.ts).

## Creating an extension that provides menus and contextual hooks

A Zowe Explorer menu extension contributes additional commands to Zowe Explorer's existing menus in VS Code. Typically, these are contributions to the right-click context menus associated with items in one or more of Zowe Explorer's three tree views (Data Sets, USS, and Jobs). VS Code extensions can define and use commands in the `contributes` section of their `package.json`. By setting the `when` property of a command to match the views and context values used by Zowe Explorer, a menu extension can hook into and add commands into Zowe Explorer's existing menus.

To specify which view a command contribution should appear in, Zowe Explorer menu extenders can use `view == <zowe.viewId>`, where `<zowe.viewId>` is one of the following view IDs used by Zowe Explorer:

- Data Sets view: `zowe.ds.explorer`
- USS view: `zowe.uss.explorer`
- Jobs view: `zowe.jobs.explorer`

To allow for more granular control over which type(s) of tree items a command should be associated with (for example, a USS textfile versus a USS directory), Zowe Explorer uses a strategy of adding and removing context components for an individual Tree Item's context value if that imparts additional information that could assist with menu triggers. Extenders can leverage this when defining a command's `when` property by specifying `viewItem =~ <contextValue>`, where `<contextValue>` is a regular expression that matches the context value of the target Tree Item type(s).

For more information on how to use a command's `when` property, see the VS Code [`when` clause contexts](https://code.visualstudio.com/api/references/when-clause-contexts) documentation.

In the example below, we are referencing the Jobs view, and more specifically, a Job type tree item that has additional information indicated by the `_rc` context. This can be used by an extender to trigger a specific menu.

```json
  "menus": {
    "view/item/context": [
      {
        "when": "view == zowe.jobs && viewItem =~ /^job.*/ && viewItem =~ /^.*_rc=CC.*/",
        "command": "zowe.testmule.retcode",
        "group": "4_workspace"
      }
          ],
      ...
      ...
  }
```

Notice the syntax we use for the context value (or `viewItem`) above is a regular expression as denoted by the `=~` equal test. Using regular expressions to describe context allows more meaning to be embedded in the context.
