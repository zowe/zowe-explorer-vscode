# VS Code extensions for Zowe Explorer

Zowe Explorer provides extension APIs that assist third party extenders to create extensions that access Zowe Explorer resource entities to enrich the user experience. There are many ways Zowe Explorer can be extended to support many different use cases. We, the Zowe Explorer core contributors, have defined APIs, guidelines, as well as formal compliance criteria for three popular ways of extending it, but we encourage you to engage with us to discuss other ways for extensions that you envision that we did not yet consider.

## Kinds of extensions

The following kinds of extensions can be certified as compliant for Zowe Explorer. See the [README-Conformance.md](README-Conformance.md) file for
the specific criteria. This document will deep dive into several of these to give extenders more guidance and examples.

One extension offering needs to comply with at least one of these kinds, but it can also be in several or all of the kinds listed. In addition to fulfilling all the required criteria for at least one kind (1 to 3), the candidate extension also needs to fulfill the required criteria of the (0) General category.

0. **General** extension. A generic VS Code extension that utilizes Zowe Explorer resources in any way.
1. **Profiles access**: An extension that accesses the Zowe Explorer Zowe CLI profiles caches for read or write operations.
2. **Data Provider**: An extension that provides an alternative Zowe CLI profile type for a different z/OS communication protocol for one or more Zowe Explorer views.
3. **Menus**: An extension that injects new menus into the existing Zowe Explorer tree views accessing contextual information from the nodes.

## Getting Started with extending Zowe Explorer

Extender packages are created as new VS Code extensions that either could be installed by end-users independently of Zowe Explorer or directly depend on Zowe Explorer and therefore force a co-installation via a dependency relationship.

For general information about VS Code extensions, visit the following links:

- [Using extensions in Visual Studio Code](https://code.visualstudio.com/docs/introvideos/extend)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [vscode-extension-samples](https://github.com/Microsoft/vscode-extension-samples)

I is also recommended to set-up a development environment for Zowe Explorer itself following the instructions in [README-Developer.md](README-Developer.md) to learn its codebase and study of the extensibility API's implementations.

## Zowe Explorer extension dependencies and activation

When creating an extension for Zowe Explorer it is in many cases necessary to specify a dependency in the package.json file of the Zowe Explorer extension:

```json
"extensionDependencies": [
    "zowe.vscode-extension-for-zowe"
],
```

This dependency has then two important effects:

1. It will enforce that the Zowe Explorer is a pre-requisite package on the users machine which will automatically install it if necessary when the Zowe Explorer extension is installed.
1. It will enforce that Zowe Explorer is activated first at startup before the dependent Zowe Explorer extension. This ensures that important data structures related to the extensibility API have been properly initialized and can be called in the activation of the Zowe Explorer extensions own activation.

## About Zowe CLI profiles

Zowe Explorer's main capability is to provide access to z/OS resources in MVS, USS, JES as well as execution of various commands such as TSO commands. To realize these interactions it builds on Zowe CLI. One could say that Zowe Explorer provides a graphical user interface for most on the core Zowe CLI commands in form of tree view navigators, menus and pop-up dialogs. The core concept that defines a connection to z/OS in Zowe CLI is the profile. Profiles are created for different interaction protocols such as z/OSMF or FTP and stored for the current user in a location defined by Zowe CLI. Zowe Explorer accesses (read and write) this same profile store.

Zowe Explorer extension can also access this profiles store via Zowe Explorer APIs, as well as extend the profiles store with new types of profiles for supporting new or alternative interaction protocols.

In case a new profile type is provided it is a recommended practice, but not required, to also provide a Zowe CLI plugin for this new profile type that implements the capabilities provided by the new profile type, which then can be reused when writing the Zowe Explorer extension, because a Zowe CLI plugin is just a normal npm package that can be imported into VS Code extensions for reuse as well. However, when such a Zowe CLI Plugin exist the Zowe Explorer extension must not make the assumption that this Plugin is actually installed on the user's machine. All the code for creating and using the profile needs to be included into the VS Code extension to allow using it on machine that did not install Zowe CLI. In other words the extension must be full self-contained including all the code of the Zowe CLI Plugin that implements the new profile. This will not only simplify the end user experience, but also ensures that the extension can run in other VS Code compatible environments such as Cloud IDEs such as Eclipse Che. Zowe Explorer provides APIs to call that ensure that the users can store and access such new profiles in Zowe home directory folders and secure credentials store, which should be used or an equivalent needs to be provided. To test this requirement a user shall be able start the extension and use it without having Nodejs and Zowe CLI installed locally.

## Accessing the Zowe Explorer Extender API

The following code snippet shows how to gain access to the published Zowe Explorer extender API.

```javascript
export function activate(context: vscode.ExtensionContext) {
    const EXTENDER_API;
    const baseExt = vscode.extensions.getExtension('zowe.vscode-extension-for-zowe');
    try {
        if (baseExt && baseExt.exports) {
            EXTENDER_API = baseExt.exports.getExplorerExtenderApi();
            return;
        }
    } catch (error) {
        vscode.window.showWarningMessage("Unable to access Zowe Explorer API");
    }
}
```

Details about the functions available in the API can be found by looking in the [Zowe Explorer source](https://github.com/zowe/vscode-extension-for-zowe/blob/master/src/api/ZoweExplorerExtender.ts)
Initially, the following access methods were added to provide access to the appropriate profiles.

```typescript
/**
 * Used by other VS Code Extensions to access the primary profile.
 *
 * @param primaryNode represents the Tree item that is being used
 * @return The requested profile
 *
 */
getProfile(primaryNode: IZoweTreeNode): IProfileLoaded;
```

## Creating an extension that accesses Zowe Explorer profiles

A Zowe CLI profiles access extension is a Zowe Explorer extension that uses the Zowe Extensibility API to conveniently access Zowe CLI profiles loaded by Zowe Explorer itself. This allows the extension to consistently access profile instances of specific types, offer them for edit and updates as well as common refresh operations that apply to all extensions, add more profile types it is using itself for its own custom views (for example a CICS extension adding a CICS explorer view) and other similar use cases related to Zowe CLI profiles. These extensions do **not** have to be VS Code extension if it just wants to use ProfilesCache implementation of Zowe Explorer as all APIs are provided free of any VS Code dependencies. Such an extension could be used for another non-VS Code tool, a Zowe CLI plugin, a Web Server or another technology. However, to access the profiles cache of the actual running VS Code Zowe Explorer the extender needs to be a VS Code extension that has an extension dependency defined to be able to query the extender APIs. Therefore, some of the criteria that are listed here as required are only required if the extender is a VS Code extension.

TBD: _Details and Examples_

## Creating an extension that adds a data provider

A data provider Zowe Explorer extension provides an alternative protocol for Zowe Explorer to interact with z/OS. The default protocol Zowe Explorer uses is the z/OSMF REST APIs and data provider adds support for another API. For example, the Zowe Explorer extension for zFTP, which is maintained by the Zowe Explorer squad is an example for a Zowe Explorer data provider extension that uses FTP instead of z/OSMF for all of its USS and MVS interactions. To achieve such an extension it uses a Zowe CLI Plugin for FTP that implemented the core interactions and provided them as an SDK.

TBD: _Details and Examples_

## Creating an extension that provides menus and contextual Hooks

A Zowe Explorer menu extension contributes additional commands to Zowe Explorer's existing menus in VS Code. Typically, these are contributions to the right-click context menus associated with items in one or more of Zowe Explorer's three views (Data Sets, USS, and Jobs). VS Code extensions can define and use commands in the `contributes` section of their `package.json`. By setting the `when` property of a command match the view(s) and context values used by Zowe Explorer, a menu extension can hook into and add commands into Zowe Explorer's existing menus.

To enable menus, extenders can reference the context values associated with the individual Tree Items. Zowe Explorer uses a strategy of adding and removing elements of context to the individual context values if that imparts additional information that could assist with menu triggers. In the example below we are referencing a Job type tree item that has additional information indicated by the _\_rc_ context. This can be used by an extender to trigger a specific menu.

```json
  "menus": {
    "view/item/context": [
      {
        "when": "view == zowe.jobs && viewItem =~ /^job.*/ && viewItem =~ /^.*_rc=CC.*/",
        "command": "zowe.testmule.retcode",
        "group": "4_workspace"
      }
          ],
      ..
      ..
  }
```

Notice the syntax we use is for the context value or viewItem above is a regular expression as denoted by the "=~" equal test. Using regular expressions to describe context allows more meaning to be embedded in the context.
