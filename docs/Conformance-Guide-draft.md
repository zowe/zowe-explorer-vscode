# Proposal for Zowe Explorer Conformance Criteria for Zowe Conformance v1

**Note, this is a draft for potential future conformance criteria for extending Zowe Explorer for collecting feedback, only**

## Kinds of extensions

The following kinds of extensions can be certified for Zowe Explorer. One extension offering needs to comply with at least one of these kinds, but it can also be in several or all of the kinds listed. In addition to fulfilling all the Required criteria for at least one kind (1 to 3), the candidate extension also needs to fulfill the required criteria of the (0) General category.

0. **General** extension.
1. **Profiles access**: An extension that accesses the Zowe Explorer Zowe CLI profiles caches for read or write operations.
2. **Data Provider**: An extension that provides an alternative Zowe CLI profile type for a different z/OS communication protocol for one or more Zowe Explorer views.
3. **Menus**: An extension that injects new menus into the existing Zowe Explorer tree views accessing contextual information from the nodes.

## Format for conformance criteria

Every conformance criteria needs to be clearly scoped, defined, and objectively verifiable. We therefore specify the following in each of the criteria descriptions below:

- Unique name: each criteria has a short unique name that can be used for reference and discussion amongst parties
- Required vs Best Practice: we currently distinguish if a criteria is a must-do for conformance versus if it is just a recommended best practice.
- Goal: each criteria should in its description clearly state the goal or rationale for requiring it.
- Testability: Each criteria should specify the way and extender as well as the Zowe Explorer squad can verify conformance.

## General conformance criteria (0)

These criteria are independent of the kind of extension produce and need to be fulfill for all cases.

1. (Required) Naming: If the extension uses the word "Zowe" in its name, it abides by Linux Foundation's Trademark Usage rules to ensure the word Zowe is used in a way intended by the Zowe community. The extender needs to provide a link where the offering will be announced and/or made available to the public.
1. (Required): No Zowe CLI plugin installation requirement: If the extender makes use of a Zowe CLI profile other than the Zowe Explorer default `zosmf` then the extension must not make any assumptions that a matching Zowe CLI plugin has been installed in the Zowe Explorer user's environment. In other words the extension must be full self-contained including all the code of the Zowe CLI Plugin that implements the new profile. This will not only simplify the end user experience, but also ensures that the extension can run in other VS Code compatible environments such as Cloud IDEs such as Eclipse Che. For VS Code extensions Zowe Explorer provides APIs to call that ensure that the users can store and access such new profiles in Zowe home directory folders and secure credentials store, which should be used or an equivalent needs to be provided. To test this requirement a user shall be able start the extension and use it without having Nodejs and Zowe CLI installed locally.
1. (Required) Publication tag: If the extension is published in a public catalog or marketplace such as Npmjs, Open-VSX, or VS Code Marketplace then it must use the tag or keyword "Zowe" so it can be found when searching for Zowe and be listed with other Zowe offerings. For example, if the extension is a VS Code extension then the "keywords" array of the package.json must include the entry "Zowe". This can be verified by looking at the page's Tags section in the VS Code Marketplace or if not yet present by extracting the vsix file and inspecting the package.json file.
1. (Required) Support: The extension needs to document how a user would get support or file issues for the extension for problems that are not related to Zowe and Zowe Explorer. The extender needs to document where the user can find this information in the conformance application.
1. (Best Practice) User settings consistency: For a consistent user experience we recommend that user settings and configuration settings follow the naming conventions as documented in the Zowe Explorer extensibility documentation. The list and documentation of the configuration settings should be made available as part of the compliance application. If the extension is a VS Code extensions then including the package.json file will be sufficient unless other means of configuration settings (such as environment variables) have been used.
1. (Best Practice) Error message consistency: For a consistent user experience we recommend that error and log messages follow the format documented in the Zowe Explorer extensibility documentation. To verify this requirement it is sufficient to provide links to user documentation showing screen shots of error dialogs as well as sample log file entries.
1. (Best Practice) Zowe SDK usage: It is recommended that if possible the the available Zowe SDKs should be utilized to standardize on z/OS interactions as well as other common capabilities used by many other Zowe extensions and tools. This can be verified by reviewing the dependencies list of the implementation such as in the package.json file of a nodejs-based extension.

## Profiles Access extension conformance criteria (1)

A Profiles Access extension is a Zowe Explorer extension that uses the Zowe Extensibility API to conveniently access Zowe CLI profiles loaded by Zowe Explorer itself. This allows the extension to consistently access profile instances of specific types, offer them for edit and updates as well as common refresh operations that apply to all extensions, add more profile types it is using itself for its own custom views (for example a CICS extension adding a CICS explorer view) and other similar use cases related to Zowe CLI profiles. These extensions do **not** have to be VS Code extension if it just wants to use ProfilesCache implementation of Zowe Explorer as all APIs are provided free of any VS Code dependencies. Such an extension could be used for another non-VS Code tool, a Zowe CLI plugin, a Web Server or another technology. However, to access the profiles cache of the actual running VS Code Zowe Explorer the extender needs to be a VS Code extension that has an extension dependency defined to be able to query the extender APIs. Therefore, some of the criteria that are listed here as required are only required if the extender is a VS Code extension.

1. (Required if VS Code) VS Code extension dependency: Zowe Explorer VS Code extensions can only be activated after Zowe Explorer is fully activated itself. Therefore, to ensure the correct activation order and extender must include the following entry in their package.json file. The package.json file must be provided to verify this criteria.
   ```json
   "extensionDependencies": [
    "Zowe.vscode-extension-for-zowe"
   ],
   ```
1. (Required if VS Code) Zowe Extender access: Zowe Explorer VS Code extensions must access the shared Zowe Explorer profiles cache only via the `ZoweExplorerApi.IApiRegisterClient.getExplorerExtenderApi()` API as documented in the Zowe Explorer extensibility documentation. API calls to the Explorer Extender API will be logged by Zowe Explorer and be verified by inspecting Zowe Explorer log files.
1. (Required if VS Code) Added Profile Type initialization: If the extender depends on a new Zowe CLI profile type other than the Zowe Explorer default `zosmf` then an extender needs to call `ZoweExplorerApi.IApiRegisterClient.getExplorerExtenderApi().initialize(profileTypeName)` **(TBD)** as its first API call to ensure that the profile type can be supported. This call ensures that the profiles of this type can be successfully managed even without the Zowe CLI plugin being installed locally for pure VS Code users as well as that the profiles can successfully be accessed in the secure credentials store. This registration call will be logged by Zowe Explorer and be verified by inspecting Zowe Explorer log files.

## Data Provider extension conformance criteria (2)

A data provider Zowe Explorer extension provides an alternative protocol for Zowe Explorer to interact with z/OS. The default protocol Zowe Explorer uses is the z/OSMF REST APIs and data provider adds support for another API. For example, the Zowe Explorer extension for zFTP, which is maintained by the Zowe Explorer squad is an example for a Zowe Explorer data provider extension that uses FTP instead of z/OSMF for all of its USS and MVS interactions. To achieve such an extension it uses a Zowe CLI Plugin for FTP that implemented the core interactions and provided them as an SDK andd

1. (Required) A new data provider requires a new Zowe CLI profile type as it is the foundation for registering the APIs that add the new protocol as documented in the extension guideline. When new APIs get registered via the `ZoweExplorerApi.IApiRegisterClient.registerMvsApi()` call the APIs passed as a parameter needs to use a unique profile type name. Such registration events will be logged by Zowe Explorer and can be used to verify to successful implementation of the requirement in the Zowe Explorer logs.
1. (Best Practice) Matching Zowe CLI Plugin: It is a best practice to provide a Zowe CLI Plugin for the data provider's profile type that implements the core capabilities requires for the new protocol that users can then also use to interact with the protocol outside of the Zowe Explorer extension using Zowe CLI commands. A Zowe CLI Plugin is a regular NPM package that then can be completely imported as a dependency into a VS Code extension that represents a data provider for Zowe Explorer. The zFTP Zowe CLI Plugin and Zowe Explorer extension for zFTP are an example for such a pairing. This requirement can be verified by testing the CLI plugin and seeing it being used in the package.json file of the VS Code extension.
1. (Required) Data provider API implementation: The Zowe Explorer extensibility API provides interfaces for the required operations to be implemented for MVS, JESS and USS. An extender must either fully implement and register at least one of these three interfaces or alternatively throw JavaScript exceptions that provide meaningful error messages to the end-user in the `Error.message` property of the exception that Zowe Explorer will display in a dialog. "Not yet implemented by the XYZ data provider" could be an example. Registering a new data provider API instance will be logged by Zowe Explorer and be be verified in the Zowe Explorer log files.
1. (Best practice) If the extension implements a Zowe Explorer API data provider interface, it should implement a test suite that calls each of the implemented API methods. Test run logs can be provided to demonstrate the fulfillment of the requirement.

## Menu extension conformance criteria (3)

1. (Required) Menu Names: If the extension is adding new commands and context menu entries to the Zowe Explorer tree view nodes, it adheres to the Zowe Explorer-provided contextual string format. **TBD**: Define rules and verification criteria.

_For team discussion_: We currently only have documented for how to add context menus, but not how the commands that implement the menu can actually access the node on which the click occurred to determine all the information needed (e.g. the data set member name and the profile of the node). We need to implement and provide an API for our tree browsers to properly support this and prevent users for just hacking the tree views themselves. Until we have such an API perhaps this extensibility kind needs to be postponed.
