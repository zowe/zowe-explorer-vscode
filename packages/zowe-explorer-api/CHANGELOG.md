# Change Log

All notable changes to the "zowe-explorer-api" extension will be documented in this file.

## TBD Release

### New features and enhancements

- Added the `BaseProfileAuthOptions` interface to define base profile authentication options for SSO login and logout. [#3076](https://github.com/zowe/zowe-explorer-vscode/pull/3076)
- Deprecated the methods `ZoweVsCodeExtension.loginWithBaseProfile` and `ZoweVsCodeExtension.logoutWithBaseProfile`. Use `ZoweVsCodeExtension.ssoLogin` and `ZoweVsCodeExtension.ssoLogout` instead, which use the `BaseProfileAuthOptions` interface and allow you to choose whether the token value in the base profile should have precedence in case there are conflicts. [#3076](https://github.com/zowe/zowe-explorer-vscode/pull/3076)
- Fixed bug in `ProfilesCache` class where old profiles were still accessible after deleting a Team configuration file. [#3124](https://github.com/zowe/zowe-explorer-vscode/issues/3124)

### Bug fixes

- Updated the `TableViewProvider.setTableView` function to show the Zowe Resources panel if a table is provided. If `null` is passed, the Zowe Resources panel will be hidden. [#3113](https://github.com/zowe/zowe-explorer-vscode/issues/3113)
- Fixed behavior of logout action when token is defined in both base profile and parent profile. [#3076](https://github.com/zowe/zowe-explorer-vscode/issues/3076)
- Fixed issue with object based parameter being passed to VS Code's localization API.

## `3.0.0-next.202409132122`

### New features and enhancements

- Added optional `patternMatches` property to the `IZoweDatasetTreeNode` interface to cache pattern matches from an applied filter search. [#1164](https://github.com/zowe/zowe-explorer-vscode/issues/1164)

### Bug fixes

- Fix extender's ability to fetch profile information from ProfilesCache for SSH profile types.

## `3.0.0-next.202409091409`

### Bug fixes

- Update Zowe SDKs to `8.0.0-next.202408301809` for technical currency.

## `3.0.0-next.202408301858`

### New features and enhancements

- Deprecated the following properties on Zowe tree interfaces in favor of setters and getters to incentivize encapsulation: [#2026](https://github.com/zowe/zowe-explorer-vscode/issues/2026)
  - `binary` property on the `IZoweDatasetTreeNode` interface - use the `getEncoding` and `setEncoding` functions instead.
  - `encodingMap` property on the `IZoweDatasetTreeNode` and `IZoweUSSTreeNode` interfaces - use the `getEncodingInMap` and `updateEncodingInMap` functions instead.
  - `stats` property on the `IZoweDatasetTreeNode` interface - use the `getStats` and `setStats` functions instead.
  - `encoding` property on the `IZoweDatasetTreeNode` and `IZoweUSSTreeNode` interfaces - use the `getEncoding` and `setEncoding` functions instead.
  - `shortLabel` property on the `IZoweUSSTreeNode` interface - use the `getBaseName` function instead.
  - `attributes` property on the `IZoweUSSTreeNode` interface - use the `getAttributes` and `setAttributes` functions instead.
- **Breaking:** Added return type of `Promise<void>` to `IZoweTree.addDsTemplate`. [#2345](https://github.com/zowe/vscode-extension-for-zowe/pull/2345)
- **Breaking:** Added return type of `Promise<void>` to `MainframeInteractions.ICommon.logout`. [#2783](https://github.com/zowe/vscode-extension-for-zowe/pull/2783)
- Grouped Common methods into Singleton classes. [#2109](https://github.com/zowe/zowe-explorer-vscode/issues/2109)
- **Breaking:** Removed deprecated methods: [#2238](https://github.com/zowe/zowe-explorer-vscode/issues/2238)
  - `refreshAndReopen` function on the `IZoweTreeNode` interface - use the `reopen` function instead.
  - `copyUssFile` function on the `IZoweTreeNode` interface - use the `pasteUssTree` function instead.
  - `ZoweVsCodeExtension.showVsCodeMessage` - use `Gui.showMessage` instead.
  - `ZoweVsCodeExtension.inputBox` - use `Gui.showInputBox` instead.
  - `ZoweVsCodeExtension.promptCredentials` - use `ZoweVsCodeExtension.updateCredentials` instead.
- **Breaking:** Removed unused property `profileManagerByType` which used the V1-profile class `CLIProfileManager`. [#3057](https://github.com/zowe/zowe-explorer-vscode/issues/3057)
- **Breaking:** Added return type of `Promise<void>` to the following `IZoweTree` methods: [#2238](https://github.com/zowe/zowe-explorer-vscode/issues/2238)
  - addFavorite
  - removeFavorite
  - removeFavProfile
  - ssoLogin
  - ssoLogout
- Added an optional function `openWithEncoding` to the `IZoweTree` interface to open file using encoding specified by user. [#2931](https://github.com/zowe/zowe-explorer-vscode/pull/2931)
- Deprecated the `openFiles` property on `IZoweTree` interface - in v3 open files are tracked by the `FileSystemProvider` instead. [#2947](https://github.com/zowe/zowe-explorer-vscode/pull/2947)
- **Breaking:** Changed the parameters of the `addSession` method on the `IZoweTree` interface since they were all optional. It now receives an object of type `AddSessionOpts`. [#2947](https://github.com/zowe/zowe-explorer-vscode/pull/2947)
- **Breaking:** Removed the redundant `zoweFileProvider` parameter from `editSession` method on the `IZoweTree` interface. [#2947](https://github.com/zowe/zowe-explorer-vscode/pull/2947)
- Updated the `ProfilesCache.getProfiles` method to return empty list instead of undefined when there are no profiles. [#2947](https://github.com/zowe/zowe-explorer-vscode/pull/2947)
- Added PEM certificate support as an authentication method for logging into the API ML. [#2621](https://github.com/zowe/zowe-explorer-vscode/issues/2621)
- Deprecated the `getUSSDocumentFilePath` function on the `IZoweTreeNode` interface as Zowe Explorer no longer uses the local file system for storing USS files. **No replacement is planned**; please access data from tree nodes using their [resource URIs](https://github.com/zowe/zowe-explorer-vscode/wiki/FileSystemProvider#operations-for-extenders) instead. [#2968](https://github.com/zowe/zowe-explorer-vscode/pull/2968)
- **Next Breaking:** Changed `ProfilesCache.convertV1ProfToConfig` method to be a static method that requires `ProfileInfo` instance as a parameter.
- Added the `onVaultUpdate` VSCode event to notify extenders when credentials are updated on the OS vault by other applications. [#2994](https://github.com/zowe/zowe-explorer-vscode/pull/2994)
- Added the `onCredMgrsUpdate` VSCode event to notify extenders when the local PC's credential manager has been updated by other applications. [#2994](https://github.com/zowe/zowe-explorer-vscode/pull/2994)
- **LTS Breaking:** Updated most function signatures for exported programmatic interfaces. Changes make developing with the Zowe Explorer API more efficient for extenders by showing which properties they can expect when calling our APIs. [#2952](https://github.com/zowe/zowe-explorer-vscode/issues/2952)

  - Updated `IApiExplorerExtender.ts`, see changes below:
    - Allowed `reloadProfiles` and `initForZowe` to be synchronous methods (non-breaking)
  - Updated `MainframeInteraction.ts`, see changes below:
    - Modified `getStatus` to add `string` type to the optional parameter `profileType`
  - Updated `IZoweTree.ts`, see changes below:

    - Modified `checkCurrentProfile(node: IZoweTreeNode);` to return `Validation.IValidationProfile | Promise<Validation.IValidationProfile>`
    - Modified `getSearchHistory()` to return `string[]`
    - Modified `getAllLoadedItems()` to return `IZoweTreeNode[] | Promise<IZoweTreeNode[]>`
    - Modified `getFileHistory()` to return `string[]`
    - Modified `createFilterString?(newFilter: string, node: IZoweTreeNode);` to return `string`
    - Allowed the following methods to be implemented synchronously: (non-breaking)
      - `addSession`
      - `addSingleSession`
      - `editSession`
      - `createZoweSession`
      - `createZoweSchema`
      - `ssoLogin`
      - `ssoLogout`
      - `addFavorite`
      - `removeFavorite`
      - `removeFavProfile`
      - `onDidChangeConfiguration`
      - `flipState` _synchronous - no `Promise` returned_
      - `rename`
      - `open`
      - `copy`
      - `paste`
      - `delete`
      - `setItem` _synchronous - no `Promise` returned_
      - `saveSearch`
      - `saveFile`
      - `refreshPS`
      - `uploadDialog`
      - `filterPrompt`
      - `addSearchHistory` _synchronous - no `Promise` returned_
      - `deleteSession` _synchronous - no `Promise` returned_
      - `updateFavorites`
      - `renameFavorite`
      - `addFileHistory` _synchronous - no `Promise` returned_
      - `removeFileHistory` _synchronous - no `Promise` returned_
      - `renameNode`
      - `openItemFromPath`
      - `addDsTemplate`
      - `pollData`
      - `openWithEncoding`

    **Note**: Developers should not expect a value to be returned from the methods above (breaking)

  - Updated `IZoweTreeNode.ts`, see changes below:
    - Modified `rename?(newNamePath: string);` to return `Promise<IZosFilesResponse>`
    - Developers should not be expecting output from the following methods:
      - `openUSS`
      - `refreshUSS`
      - `deleteUSSNode`
      - `renameUSSNode`
      - `reopen`
      - `saveSearch`

- Implemented support for building, exposing and displaying table views within Zowe Explorer. Tables can be customized and exposed using the helper facilities (`TableBuilder` and `TableMediator`) for an extender's specific use case. For more information on how to configure and show tables, please refer to the [wiki article on Table Views](https://github.com/zowe/zowe-explorer-vscode/wiki/Table-Views). [#2258](https://github.com/zowe/zowe-explorer-vscode/issues/2258)
- **Breaking:** Consolidated WebView API options into a single object (`WebViewOpts` type), both for developer convenience and to support future options.
- Enhanced the `ZoweVsCodeExtension.loginWithBaseProfile` and `ZoweVsCodeExtension.logoutWithBaseProfile` methods to store SSO token in parent profile when nested profiles are in use. [#2264](https://github.com/zowe/zowe-explorer-vscode/issues/2264)
- **Next Breaking:** Changed return type of `ZoweVsCodeExtension.logoutWithBaseProfile` method from `void` to `boolean` to indicate whether logout was successful.
- **Breaking:** Changed behavior of the `ProfilesCache.fetchBaseProfile` method so that if a nested profile name is specified (e.g. "lpar.zosmf"), then its parent profile is returned unless token is already stored in the base profile.
- Renamed the `_lookup` function to `lookup` in the `BaseProvider` class and updated its access to public, allowing extenders to look up resources outside of the provider implementations. The `_lookup` function is still accessible, but now deprecated in favor of the public `lookup` function. [#3040](https://github.com/zowe/zowe-explorer-vscode/pull/3040)
- **Breaking:** Removed the `MemberEntry` filesystem class, in favor of using the `DsEntry` class with `isMember` set to `true`.
- Changed `TableViewProvider.setTableView` function to be asynchronous for more optimized data updates.
- Updated `Table.Conditional` and `Table.Callback` types to support multi-row callbacks.

### Bug fixes

- Fixed an issue where the `onProfilesUpdate` event did not fire after secure credentials were updated. [#2822](https://github.com/zowe/zowe-explorer-vscode/issues/2822)
- Fixed an issue where `ProfilesCache` may return missing or incorrect profile values when multiple extensions call it during activation. [#2831](https://github.com/zowe/zowe-explorer-vscode/issues/2831)
- Removed `handlebars` dependency in favor of `mustache` for technical currency purposes. [#2975](https://github.com/zowe/zowe-explorer-vscode/pull/2975)
- Fixed an issue where the `ZoweVsCodeExtension.updateCredentials` method could remove credentials from session when input prompt was cancelled. [#3009](https://github.com/zowe/zowe-explorer-vscode/pull/3009)
- Fixed an issue where the loaded configuration could be overridden when extenders retrieved the Zowe home directory. [#2994](https://github.com/zowe/zowe-explorer-vscode/pull/2994)
- Fixed an issue where remote lookup functionality caused the local side of a conflict to be overwritten with the remote contents. [#3085](https://github.com/zowe/zowe-explorer-vscode/pull/3085)
- Update Zowe SDKs to `8.0.0-next.202408291544` for technical currency. [#3057](https://github.com/zowe/zowe-explorer-vscode/pull/3057)

## `3.0.0-next.202404242037`

### New features and enhancements

- **Breaking:** Marked `getJobsByParameters` as a required function for the `MainframeInteraction.IJes` interface. [#2764](https://github.com/zowe/vscode-extension-for-zowe/pull/2764)
  - The new `getJobsByParameters` API is meant to replace `getJobsByOwnerAndPrefix`, and it adds new capabilities such as querying by status and limiting the amount of returned jobs.
- **Breaking:** Removed string as a return type of the `uploadFromBuffer` method, since the z/OSMF API has been fixed to return a response object that includes an etag. [#2785](https://github.com/zowe/zowe-explorer-vscode/issues/2785)
- Added `Commands` value to the `PersistenceSchemaEnum` enum for storing MVS, TSO, and USS command history. [#2788](https://github.com/zowe/zowe-explorer-vscode/issues/2788)
- Changed the type for the options parameter in the `getContents` function (`MainframeInteraction.IUss` and `MainframeInteraction.IMvs` interfaces) from `zosfiles.IDownloadOptions` to `zosfiles.IDownloadSingleOptions`. [#2207](https://github.com/zowe/zowe-explorer-vscode/issues/2207)
  - The type was changed to match the function's intended behavior (to get the contents of a **single** resource).
- Added the `getEncoding` optional function to the `IZoweDatasetTreeNode` and `IZoweUSSTreeNode` interfaces. [#2207](https://github.com/zowe/zowe-explorer-vscode/issues/2207)
  - **Breaking:** Removed the `encoding` property from the `IZoweUSSTreeNode` interface in favor of the new `getEncoding` function. [#2207](https://github.com/zowe/zowe-explorer-vscode/issues/2207)
- Added an optional function `nodeDataChanged` to the `IZoweTree` interface to signal an event when a tree node needs updated. [#2207](https://github.com/zowe/zowe-explorer-vscode/issues/2207)
- Added the optional `vscode.DragAndDropController` interface to the `IZoweTree` interface to allow Zowe tree views to support drag and drop. [#2207](https://github.com/zowe/zowe-explorer-vscode/issues/2207)
- Added a `ZoweScheme` enum to expose the core FileSystemProvider schemes for USS files, data sets and jobs. [#2207](https://github.com/zowe/zowe-explorer-vscode/issues/2207)
- Added optional function `move` to the `MainframeInteraction.IUss` interface to move USS folders/files from one path to another. [#2207](https://github.com/zowe/zowe-explorer-vscode/issues/2207)
- Added the `buildUniqueSpoolName` function to build spool names for Zowe resource URIs and VS Code editor tabs. [#2207](https://github.com/zowe/zowe-explorer-vscode/issues/2207)
- Added the `isNodeInEditor` function to determine whether a tree node is open in the editor. [#2207](https://github.com/zowe/zowe-explorer-vscode/issues/2207)

### Bug fixes

- Updated the SDK dependencies to `8.0.0-next.202404032038` for technical currency [#2783](https://github.com/zowe/vscode-extension-for-zowe/pull/2783).
- Fixed an issue where the `ProfilesCache` class would retain old service profiles, even if they were removed from the team config. [#2395](https://github.com/zowe/zowe-explorer-vscode/issues/2395)
- **Breaking:** issueUnixCommand API now takes sshSession as a optional parameter. [#2866](https://github.com/zowe/zowe-explorer-vscode/pull/2866)

## `3.0.0-next.202403051607`

### New features and enhancements

- Add Created Date to `stats` optional variable for storing dataset stats [#2565](https://github.com/zowe/vscode-extension-for-zowe/pull/2565)
- Add Date created to DatasetSortOpts enum [#2565](https://github.com/zowe/vscode-extension-for-zowe/pull/2565)
- Migrated from `@zowe/cli` package to individual Zowe SDK packages. [#2719](https://github.com/zowe/vscode-extension-for-zowe/issues/2719)
- **Breaking:** Added the following **required** API: `uploadFromBuffer` [#2738](https://github.com/zowe/vscode-extension-for-zowe/pull/2738)
  - For v3, this API will be used for saving data sets and USS files instead of `putContent(s)`. Extenders must implement this API to continue supporting Zowe Explorer save operations.

### Bug fixes

- Fixed issue where `zosmf` profiles did not respect the `protocol` property. [#2703](https://github.com/zowe/vscode-extension-for-zowe/issues/2703)
- **Breaking:** ProfilesCache.getProfileInfo no longer accepts any parameters. [#2744](https://github.com/zowe/vscode-extension-for-zowe/pull/2744)
- Fix to restore accessibility to all profiles when default profile has APIML token authentication. [#2111](https://github.com/zowe/vscode-extension-for-zowe/issues/2111)
- Updated the SDK dependencies to `8.0.0-next.202403041352` for technical currency [#2754](https://github.com/zowe/vscode-extension-for-zowe/pull/2754).

## `3.0.0-next.202402142205`

### New features and enhancements

- **Breaking:** Removed the following properties/methods:
  - `IZoweUSSTreeNode.binaryFiles` -> `IZoweUSSTreeNode.encodingMap`
  - `IZoweUSSTreeNode.mProfileName` -> `IZoweUSSTreeNode.getProfileName()`
  - `IZoweUSSTreeNode.setBinary()` -> `IZoweUSSTreeNode.setEncoding()`
- **Breaking:** Removed `ZoweTreeNode.binary`, `ZoweTreeNode.binaryFiles`, and `ZoweTreeNode.shortLabel`. These properties are not applicable for all tree nodes and should be defined in subclasses of `ZoweTreeNode` if necessary.
- **Breaking:** Removed `ProfilesCache.getSchema()`, `ProfilesCache.getCliProfileManager()`, `ProfilesCache.saveProfile()` & `ProfilesCache.deleteProfileOnDisk()` v1 Profiles manipulation endpoints.
- Added new ProfilesCache.convertV1ProfToConfig() API endpoint for extenders migrating from v1 profiles to team configuration files. [#2284](https://github.com/zowe/vscode-extension-for-zowe/issues/2284)

### Bug fixes

- Fix login and logout operations when APIML dynamic tokens are enabled. [#2692](https://github.com/zowe/vscode-extension-for-zowe/pull/2692)
- Updated dependencies for technical currency purposes.

## `3.0.0-next.202402071248`

### New features and enhancements

- Grouped common methods into singleton classes [#2109](https://github.com/zowe/vscode-extension-for-zowe/issues/2109)

## `3.0.0-next.202401241448`

### Bug fixes

- Changed IApiExplorerExtenders.initForZowe `profileTypeConfigurations: imperative.ICommandProfileTypeConfiguration[]` to a required argument to address issues seen after registration of profile type when not passed. [#2575](https://github.com/zowe/vscode-extension-for-zowe/issues/2575)

## `3.0.0-next.202401121747`

### New features and enhancements

- Added new APIs for Issue UNIX Command. [#1326](https://github.com/zowe/vscode-extension-for-zowe/issues/1326)

## `3.0.0-next.202311171754`

## Bug fixes

- fixed export of api `onProfilesUpdate`.

## `3.0.0-next.202309121526`

### New features and enhancements

- Removal of v1 profile support. [#2072](https://github.com/zowe/vscode-extension-for-zowe/issues/2072)
- Removal of deprecated APIs. Check the [list](https://github.com/zowe/vscode-extension-for-zowe/tree/next/docs/early-access/v3/Extenders.md) of APIs that were removed.
- Added `madge` script in `package.json` to track circular dependencies. [#2148](https://github.com/zowe/vscode-extension-for-zowe/issues/2148)
- Migrated to new package manager PNPM from Yarn.

## `2.18.0`

### Bug fixes

- Fixed an issue where the `ZoweVsCodeExtension.updateCredentials` method could remove credentials from session when input prompt was cancelled. [#3018](https://github.com/zowe/zowe-explorer-vscode/pull/3018)
- Updated the `@zowe/cli` dependency to fix error when using session with auth type "none". [zowe-cli#2219](https://github.com/zowe/zowe-cli/issues/2219)
- Fixed errors being logged silently rather than thrown in `ProfilesCache.refresh` method. [#3066](https://github.com/zowe/zowe-explorer-vscode/issues/3066)

## `2.17.0`

### New features and enhancements

- Updated the `@zowe/cli` dependency to 7.27.0 to support proxy environment variables [#3003](https://github.com/zowe/zowe-explorer-vscode/issues/3003)

### Bug fixes

- Removed `handlebars` dependency in favor of `mustache` for technical currency purposes. [#2974](https://github.com/zowe/zowe-explorer-vscode/pull/2974)

## `2.16.3`

## `2.16.2`

### Bug fixes

- Fixed an issue where the `onProfilesUpdate` event did not fire after secure credentials were updated. [#2822](https://github.com/zowe/zowe-explorer-vscode/issues/2822)
- Update dependencies for technical currency purposes.

## `2.16.1`

## `2.16.0`

### New features and enhancements

- Added optional `consoleName` argument to `ZosmfCommandApi.issueMvsCommand`. [#1667](https://github.com/zowe/vscode-extension-for-zowe/issues/1667)
- Added "Date Completed" attribute to JobSortOpts enum type. [#1685](https://github.com/zowe/vscode-extension-for-zowe/issues/1685)
- Added PEM certificate support as an authentication method for logging into the API ML. [#2621](https://github.com/zowe/zowe-explorer-vscode/issues/2621)

### Bug fixes

- Updated `@zowe/cli` dependency to fix issue where "Log out of authentication service" doesn't show in Manage Profile menu. [#2633](https://github.com/zowe/zowe-explorer-vscode/issues/2633)
- Fixed regression of issue where the `ProfilesCache` class would retain old service profiles, even if they were removed from the team config. [#2910](https://github.com/zowe/zowe-explorer-vscode/issues/2910)

## `2.15.4`

## `2.15.3`

### Bug fixes

- Fixed an issue where `ProfilesCache` may return missing or incorrect profile values when multiple extensions call it during activation. [#2831](https://github.com/zowe/zowe-explorer-vscode/issues/2831)

## `2.15.2`

### New features and enhancements

- Added optional method `getDsDocumentFilePath` to `IZoweDatasetTreeNode` interface to make it easier for extenders to get the local file path of a data set node. [#2760](https://github.com/zowe/vscode-extension-for-zowe/pull/2760)

### Bug fixes

- Fixed an issue where the `ProfilesCache` class would retain old service profiles, even if they were removed from the team config. [#2395](https://github.com/zowe/zowe-explorer-vscode/issues/2395)

## `2.15.1`

### Bug fixes

- Fixed TypeError encountered in the `ProfilesCache.checkMergingConfigAllProfiles` function when merging profiles. [#2771](https://github.com/zowe/vscode-extension-for-zowe/pull/2771)

## `2.15.0`

### Bug fixes

- Fix login and logout operations when APIML dynamic tokens are enabled. [#2692](https://github.com/zowe/vscode-extension-for-zowe/pull/2692)
- Fixed issue where `zosmf` profiles did not respect the `protocol` property. [#2703](https://github.com/zowe/vscode-extension-for-zowe/issues/2703)
- Fix to restore accessibility to all profiles when default profile has APIML token authentication. [#2111](https://github.com/zowe/vscode-extension-for-zowe/issues/2111)

## `2.14.1`

### Bug fixes

- Update transitive dependencies for technical currency.

## `2.14.0`

### New features and enhancements

- Added optional `openDs` function to `IZoweDatasetTreeNode` to open a data set or member in the editor.
- Added optional `setEncoding` function to `IZoweDatasetTreeNode` and `IZoweUSSTreeNode` to set the encoding of a node to binary, text, or a custom codepage.
- Added optional properties `binary`, `encoding`, and `encodingMap` to tree node interfaces for storing the codepage of a data set or USS file.
- Deprecated `IZoweUSSTreeNode.binaryFiles` and `IZoweUSSTreeNode.setBinary` in favor of `IZoweUSSTreeNode.encodingMap` and `IZoweUSSTreeNode.setEncoding`.
- Deprecated `ZoweTreeNode.binary`, `ZoweTreeNode.binaryFiles`, and `ZoweTreeNode.shortLabel`. These properties are not applicable for all tree nodes and should be defined in subclasses of `ZoweTreeNode` if necessary.
- Added new functions `loginWithBaseProfile` and `logoutWithBaseProfile` to provide extenders with the ability to automatically login to their respective services. [#2493](https://github.com/zowe/vscode-extension-for-zowe/pull/2493)
- Added APIML dynamic token support. [#2665](https://github.com/zowe/vscode-extension-for-zowe/issues/2665)
- Added new optional method `getCommonApi` to `ZoweExplorerApi.IApiRegisterClient` for enhanced typings in other Zowe Explorer APIs. [#2493](https://github.com/zowe/vscode-extension-for-zowe/pull/2493)
- Add Created Date to `stats` optional variable for storing dataset stats
- Add Date created to DatasetSortOpts enum [#2707](https://github.com/zowe/vscode-extension-for-zowe/pull/2707)

### Bug fixes

- Added a return type of void for `IZoweUSSTreeNode.openUSS`.
- Fixed use of `this` in static methods in `ZoweVsCodeExtension`. [#2606](https://github.com/zowe/vscode-extension-for-zowe/pull/2606)
- Fixed `ZoweVsCodeExtension.promptUserPass` to not use hardcoded values for user and password. [#2666](https://github.com/zowe/vscode-extension-for-zowe/issues/2666)

## `2.13.1`

### Bug fixes

- Update dependencies for technical currency purposes.

## `2.13.0`

### New features and enhancements

- Added new optional boolean parameter `hideFromAllTrees` to `IZoweTree.deleteSession` for specifying whether to hide from all trees or current tree. [#2567](https://github.com/zowe/vscode-extension-for-zowe/issues/2567)
- Added new optional parameter `provider` of type `IZoweTree<IZoweTreeNode>` for `IZoweTree.addSession` to specify a tree to add the profile to.
- Added optional `filter` and `actualJobs` variables to `IZoweJobTreeNode` to track local filter search.
- Added new optional record `openFiles` to `IZoweTree` to track opened files under a specific tree view. [#2597](https://github.com/zowe/vscode-extension-for-zowe/issues/2597)

## `2.12.2`

## `2.12.1`

## `2.12.0`

### New features and enhancements

- Added optional `getTag` function to `ZoweExplorerAPI.IUss` for getting the tag of a file on USS.
- Added new ProfilesCache API `getConfigArray` to allow extenders to get the registered profile type's metadata for team configuration file creation handled outside of Zowe Explorer views. [#2394](https://github.com/zowe/vscode-extension-for-zowe/issues/2394)
- Add `sort` and `filter` optional variables for storing sort/filter options alongside tree nodes. [#2420](https://github.com/zowe/vscode-extension-for-zowe/issues/2420)
- Add `stats` optional variable for storing dataset stats (such as user, modified date, etc.).
- Add option enums and types for sorting, filtering and sort direction in tree nodes. [#2420](https://github.com/zowe/vscode-extension-for-zowe/issues/2420)
- Added option for retaining context when generating webviews in Webview API.

## `2.11.2`

### Bug fixes

- Bundle Zowe Secrets for issues seen by extenders that use the ProfilesCache for profile management. [#2512](https://github.com/zowe/vscode-extension-for-zowe/issues/2512)

## `2.11.1`

## `2.11.0`

### New features and enhancements

- Added optional `pendingActions` record to `IZoweTreeNode` to allow nodes to track pending promises.
- Added optional `wasDoubleClicked` variable to `IZoweTreeNode` to track whether a node was double-clicked during an action.

### Bug fixes

- Bump `@zowe/secrets-for-zowe-sdk` to 7.18.4 to handle install errors gracefully and to allow running without MSVC redistributables.

## `2.10.0`

### New features and enhancements

- Added option to register callback to be called after making changes to team config profiles are made. [#2385](https://github.com/zowe/vscode-extension-for-zowe/issues/2385)
- Replaced `keytar` dependency with `keyring` module from [`@zowe/secrets-for-zowe-sdk`](https://github.com/zowe/zowe-cli/tree/master/packages/secrets). [#2358](https://github.com/zowe/vscode-extension-for-zowe/issues/2358) [#2348](https://github.com/zowe/vscode-extension-for-zowe/issues/2348)
- Added `WebView` class to allow Zowe Explorer and extenders to create enhanced webviews (choose any JavaScript bundler and JavaScript framework). [#2254](https://github.com/zowe/vscode-extension-for-zowe/issues/2254)

## `2.9.2`

## `2.9.1`

### New features and enhancements

- Added optional `profile` parameter to `IPromptCredentialsOptions` so developers can choose to skip rebuilding the profile with ProfilesCache.

### Bug fixes

- Fixed error when an extender's extension attempts to access the keyring in a remote VSCode session [#324](https://github.com/zowe/vscode-extension-for-cics/issues/324).
- Fixed issue where profiles with authentication tokens were breaking functionality for direct-to-service profiles after user interaction. [#2330](https://github.com/zowe/vscode-extension-for-zowe/issues/2330)
- Updated dependencies for security audits.

## `2.9.0`

### New features and enhancements

- Added optional IZoweTree functions, `addDsTemplate` and `getDSTemplates`.
- Added a new type `DataSetAllocTemplate` for data set attributes.
- Added optional `cancelJob` function to `ZoweExplorerApi.IJes` interface.
- Added z/OSMF API implementation for `cancelJob` function.
- Added optional `id` variable to `IZoweTreeNode` interface, which can be used to designate a unique ID for a tree node. [#2215](https://github.com/zowe/vscode-extension-for-zowe/issues/2215)
- Fixed error shown by API when accessing the `name` and `type` property of a profile when updating the profile arrays [#2334](https://github.com/zowe/vscode-extension-for-zowe/issues/2334).

## `2.8.1`

### Bug fixes

- Updated linter rules and addressed linter errors. [#2291](https://github.com/zowe/vscode-extension-for-zowe/issues/2291)
- Updated dependencies for security audits.

## `2.8.0`

### New features and enhancements

- Added `Gui.reportProgress` that can be used to notify users of action progress in conjunction with the `Gui.withProgress` call. [#2167](https://github.com/zowe/vscode-extension-for-zowe/issues/2167)
- Updated linter rules and addressed linter errors. [#2184](https://github.com/zowe/vscode-extension-for-zowe/issues/2184)
- Added checks to verify that `@zowe/cli` dependency exists before building. [#2199](https://github.com/zowe/vscode-extension-for-zowe/issues/2199)
- Added `ZoweVsCodeExtension.customLoggingPath` that can be used to get custom logging path defined in VS Code settings. [#2186](https://github.com/zowe/vscode-extension-for-zowe/issues/2186)
- Added `Poller` utility singleton for handling continuous poll requests: see `Poller.addRequest, Poller.removeRequest` functions.
- Added `pollData` optional function to `IZoweTree` class.
- Created a new optional API, `IJes.downloadSingleSpool`, that can be used to download a single spool file in text or binary formats. [#2060](https://github.com/zowe/vscode-extension-for-zowe/issues/2060)
- Added capability to download a single spool file to in text or binary formats for zOSMF profiles by adopting the new api, `ZosmfJesApi.downloadSingleSpool`. [#2060](https://github.com/zowe/vscode-extension-for-zowe/issues/2060)

### Bug fixes

- Fixed credentials being updated for wrong v1 profile if multiple profiles had different types but same name.
- Updated dependencies for security audits.
- Added fallback for `realPathSync` to resolve edge cases where the native call fails on Windows systems. [#1773](https://github.com/zowe/vscode-extension-for-zowe/issues/1773)

## `2.7.0`

### New features and enhancements

- Updated `IZoweTreeNode` with additional variable `description` to prevent compilation errors when updating node descriptions. [#2122](https://github.com/zowe/vscode-extension-for-zowe/issues/2122)
- Updated `IZoweJobTreeNode` with additional variable `filtered` to track whether a job session node has been filtered. [#2122](https://github.com/zowe/vscode-extension-for-zowe/issues/2122)
- Added new API `IMvs.copyDataSet`. [#1550](https://github.com/zowe/vscode-extension-for-zowe/issues/1550)

## `2.6.2`

### Bug fixes

- Updated dependencies for security audits.

## `2.6.0`

### New features and enhancements

- Refactored UI/UX methods into standalone `Gui` module for usability and maintainability. [#1967](https://github.com/zowe/vscode-extension-for-zowe/issues/1967)
- New API call `dataSetsMatchingPattern` to allow filtering datasets via a pattern.
- Added `copy` function to USS API to facilitate with copying files.

### Bug fixes

- Updated Imperative to fix failure to load schema when there is no profile of that type. [zowe/imperative#916](https://github.com/zowe/imperative/pull/916)
- Added missing overload for `Gui.setStatusBarMessage` to allow passing `Thenable` objects.

## `2.5.0`

- Copy and Paste added to IZoweTree API for files and directories on USS tree.

## `2.4.1`

### Bug fixes

- Added logging in places where errors were being caught and ignored.
- Fixed all existing ESLint errors within the API logic.
- Removed TSLint (as it is deprecated), and replaced all TSLint rules with their ESLint equivalents. [#2030](https://github.com/zowe/vscode-extension-for-zowe/issues/2030)

### New features and enhancements

- New API call `getJobsByParameters` to allow filtering jobs by status.
- Added `findEquivalentNode` function to IZoweTree to find a corresponding favorited/non-favorited node.
- Updated `IZoweTree`: changed `IZoweNodeType -> IZoweTreeNode` to prevent incompatibility w/ custom/future Zowe node types

## `2.4.1`

### Bug fixes

- Added an API to obtain an up to date array of Profiles from registered types, `ProfilesCache.fetchAllProfiles()`.
- Fixed `ZoweVsCodeExtension` failing to initialize in environment with empty workspace. [#1994](https://github.com/zowe/vscode-extension-for-zowe/issues/1994)

## `2.4.0`

- Fixed refresh for Zowe Explorer activation and Refresh Extension issues in web based editors. [#1807](https://github.com/zowe/vscode-extension-for-zowe/issues/1807)

## `2.2.1`

- Bugfix: Fix for extenders that call registerCustomProfileType() and recieved error when team configuration file was in place. [#1870](https://github.com/zowe/vscode-extension-for-zowe/issues/1870)

## `2.2.0`

- New API `ZoweVsCodeExtension.updateCredentials` for credential prompting that updates the ProfilesCache after obtaining credentials from user.
- New API `ProfilesCache.updateProfilesArrays` to update `ProfilesCache.allProfiles` for profiles that don't store credentials locally in profile file.
- New API `ProfilesCache.isCredentialsSecured` to check if credentials are stored securely.
- Deprecated `ZoweVsCodeExtension.promptCredentials` in favor of `ZoweVsCodeExtension.updateCredentials`.

## `2.0.0`

- Major: Introduced Team Profiles and more. See the prerelease items (if any) below for more details.

## `2.0.0-next.202204081040`

- Added documentation on promptCredentials(). [1728](https://github.com/zowe/vscode-extension-for-zowe/pull/1728)
- Updated ProfilesCache.refresh() to handle the merging on v1 and v2 profiles. [1729](https://github.com/zowe/vscode-extension-for-zowe/pull/1729)

## `2.0.0-next.202204041200`

- Added new API to expose `promptCredentials` for extender use. [#1699](https://github.com/zowe/vscode-extension-for-zowe/pull/1699)

## `1.17.0`

- Zowe Explorer extenders can now have their profile type's folder with meta file created in the /.zowe/profiles home directory upon initialization by calling the ZoweExplorerApiRegister.getExplorerExtenderApi().initForZowe(type: string, meta:imperative.ICommandProfileTypeConfiguration[]) during their activation with Zowe Explorer.

## `1.10.1`

- Initial release
