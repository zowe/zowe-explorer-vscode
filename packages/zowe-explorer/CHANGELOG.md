# Change Log

All notable changes to the "vscode-extension-for-zowe" extension will be documented in this file.

## TBD Release

### New features and enhancements

- Added Time Started, Time Ended, and Time Submitted job properties to the Jobs table view. [#3055](https://github.com/zowe/zowe-explorer-vscode/issues/3055)
- Implemented copy/paste functionality of data sets within and across LPARs. [#3012](https://github.com/zowe/zowe-explorer-vscode/issues/3012)
- Added Time Started, Time Ended, and Time Submitted job properties to the Jobs table view. [#3055](https://github.com/zowe/zowe-explorer-vscode/issues/3055)
- Implemented copy/paste functionality of data sets within and across LPARs. [#3012](https://github.com/zowe/zowe-explorer-vscode/issues/3012)
- Implemented drag and drop functionality of data sets within and across LPARs. [#3413](https://github.com/zowe/zowe-explorer-vscode/pull/3413)

### Bug fixes

- Fixed an issue where a TypeError occurred when applying VS Code proxy settings to an invalid session. [#3425](https://github.com/zowe/zowe-explorer-vscode/issues/3425)
- Fixed issue where the 'Delete' key binding for the USS tree returns a 'contextValue' error. [#2796](https://github.com/zowe/zowe-explorer-vscode/issues/2796)

## `3.1.0`

### New features and enhancements

- Updated Zowe SDKs to `8.10.4` for technical currency. [#3306](https://github.com/zowe/zowe-explorer-vscode/pull/3306)
- Added expired JSON web token detection for profiles in each tree view (Data Sets, USS, Jobs). When a user performs a search on a profile, they are prompted to log in if their token expired. [#3175](https://github.com/zowe/zowe-explorer-vscode/issues/3175)
- Added integrated terminals for z/OS Unix, TSO, and MVS commands which can be enabled via the `Zowe › Commands: Use Integrated Terminals` setting. [#3079](https://github.com/zowe/zowe-explorer-vscode/pull/3079)
- Add a data set or USS resource to a virtual workspace with the new "Add to Workspace" context menu option. [#3265](https://github.com/zowe/zowe-explorer-vscode/issues/3265)
- Power users and developers can now build links to efficiently open mainframe resources in Zowe Explorer. Use the **Copy External Link** option in the context menu to get the URL for a data set or USS resource, or create a link in the format `vscode://Zowe.vscode-extension-for-zowe?<ZoweResourceUri>`. For more information on building resource URIs, see the [FileSystemProvider wiki article](https://github.com/zowe/zowe-explorer-vscode/wiki/FileSystemProvider#file-paths-vs-uris). [#3271](https://github.com/zowe/zowe-explorer-vscode/pull/3271)
- Adopted support for VS Code proxy settings with zosmf profile types. [#3010](https://github.com/zowe/zowe-explorer-vscode/issues/3010)
- Implemented more user-friendly error messages for API or network errors within Zowe Explorer. [#3243](https://github.com/zowe/zowe-explorer-vscode/pull/3243)
- Use the "Troubleshoot" option for certain errors to obtain additional context, tips, and resources for how to resolve the errors. [#3243](https://github.com/zowe/zowe-explorer-vscode/pull/3243)
- Easily search for data in filtered data sets and partitioned data sets with the new `Search Filtered Data Sets` and `Search PDS Members` functionality. [#3306](https://github.com/zowe/zowe-explorer-vscode/pull/3306)
- Allow extenders to add context menu actions to a top level node, i.e. data sets, USS, Jobs, by encoding the profile type in the context value. [#3309](https://github.com/zowe/zowe-explorer-vscode/pull/3309)
- You can now add multiple partitioned data sets or USS directories to your workspace at once using the "Add to Workspace" feature. [#3324](https://github.com/zowe/zowe-explorer-vscode/issues/3324)
- Exposed read and write access to local storage keys for Zowe Explorer extenders. [#3180](https://github.com/zowe/zowe-explorer-vscode/issues/3180)
- Added `Open with Encoding` to the context menu of Job Spool files. [#1941](https://github.com/zowe/zowe-explorer-vscode/issues/1941)

### Bug fixes

- Fixed an issue during initialization where the error dialog shown for a broken team configuration file was missing the "Show Config" action. [#3322](https://github.com/zowe/zowe-explorer-vscode/pull/3322)
- Fixed an issue where editing a team config file or updating secrets in the OS credential vault could trigger multiple events for a single action. [#3296](https://github.com/zowe/zowe-explorer-vscode/pull/3296)
- Fixed an issue where opening a PDS member after renaming an expanded PDS resulted in an error. [#3314](https://github.com/zowe/zowe-explorer-vscode/issues/3314)
- Fixed issue where persistent settings defined at the workspace level were migrated into global storage rather than workspace-specific storage. [#3180](https://github.com/zowe/zowe-explorer-vscode/issues/3180)
- Fixed an issue where renaming a data set with unsaved changes did not cancel the rename operation. Now, when renaming a data set with unsaved changes, you are prompted to resolve them before continuing. [#3326](https://github.com/zowe/zowe-explorer-vscode/pull/3326)
- Fixed an issue where a migrated data set is unusable after it is recalled through Zowe Explorer. [#3294](https://github.com/zowe/zowe-explorer-vscode/issues/3294)
- Fixed an issue where a recalled PDS is expandable after it is migrated through Zowe Explorer. [#3294](https://github.com/zowe/zowe-explorer-vscode/issues/3294)
- Fixed an issue where data set nodes did not update if migrated or recalled outside of Zowe Explorer. [#3294](https://github.com/zowe/zowe-explorer-vscode/issues/3294)
- Fixed an issue where listing data sets resulted in an error after opening a data set with an encoding. [#3347](https://github.com/zowe/zowe-explorer-vscode/issues/3347)
- Fixed an issue where binary USS files were not fetched using the "Pull from Mainframe" context menu option. [#3355](https://github.com/zowe/zowe-explorer-vscode/issues/3355)
- Fixed an issue where cached encoding was applied for all profiles with the same data set or USS path in the "Open with Encoding" menu. [#3363](https://github.com/zowe/zowe-explorer-vscode/pull/3363)
- Removed "Delete Profile" action from the "Manage Profile" menu since this action is currently not supported in Zowe Explorer. [#3037](https://github.com/zowe/zowe-explorer-vscode/issues/3037)
- Fixed an issue where the filesystem continued to use a profile with invalid credentials to fetch resources. Now, after an authentication error occurs for a profile, it cannot be used again in the filesystem until the authentication error is resolved. [#3329](https://github.com/zowe/zowe-explorer-vscode/issues/3329)
- Fixed data loss when creating a data set member with the same name as an existing member. When creating a new member, the user is now prompted to replace it if the member already exists. [[#3327](https://github.com/zowe/zowe-explorer-vscode/issues/3327)]
- Resolved user interface bug with tables that caused an inconsistent table height within the VS Code Panel. [#3389](https://github.com/zowe/zowe-explorer-vscode/pull/3389)
- Fixed an issue where opening a data set with the same starting pattern as an archived data set caused a REST API error (code 500) to appear in the editor. [#3407](https://github.com/zowe/zowe-explorer-vscode/pull/3407)
- Fixed an issue where registering new profile types from a Zowe Explorer extender could cause an internal API error on startup. [#3412](https://github.com/zowe/zowe-explorer-vscode/pull/3412)

## `3.0.3`

### Bug fixes

- `DatasetFSProvider.stat()` will now throw a `FileNotFound` error for extenders trying to fetch an MVS resource that does not exist. [#3252](https://github.com/zowe/zowe-explorer-vscode/issues/3252)
- Fixed an issue where renaming or deleting a USS file or data set did not update the opened editor. [#3260](https://github.com/zowe/zowe-explorer-vscode/issues/3260)
- Fixed an issue during initialization where a broken team configuration file caused the "Show Config" action in the error dialog to stop working. [#3273](https://github.com/zowe/zowe-explorer-vscode/issues/3273)
- Fixed issue where switching the authentication methods would cause `Cannot read properties of undefined` error. [#3142](https://github.com/zowe/zowe-explorer-vscode/issues/3142)
- Fixed an issue where calling `vscode.workspace.fs.readFile` with a PDS member URI would throw an error when the PDS already existed as a filesystem entry. [#3267](https://github.com/zowe/zowe-explorer-vscode/issues/3267)
- Fixed issue where Zowe Explorer would present the "No configs detected" notification when initialized in a workspace without a Zowe team configuration. [#3280](https://github.com/zowe/zowe-explorer-vscode/issues/3280)
- Reduced the number of MVS API calls performed by `vscode.workspace.fs.readFile` when fetching the contents of a data set entry. [#3278](https://github.com/zowe/zowe-explorer-vscode/issues/3278)
- Fixed an issue to review inconsistent capitalization across translation strings. [#2935](https://github.com/zowe/zowe-explorer-vscode/issues/2935)
- Updated the test for the default credential manager for better compatibility with Cloud-based platforms such as Eclipse Che and Red Hat OpenShift Dev Spaces. [#3297](https://github.com/zowe/zowe-explorer-vscode/pull/3297)
- Fixed issue where users were not prompted to enter credentials if a 401 error was encountered when opening files, data sets or spools in the editor. [#3197](https://github.com/zowe/zowe-explorer-vscode/issues/3197)
- Fixed issue where profile credential updates or token changes were not reflected within the filesystem. [#3289](https://github.com/zowe/zowe-explorer-vscode/issues/3289)
- Fixed issue to update the success message when changing authentication from token to basic through the 'Change Authentication' option. [#3316](https://github.com/zowe/zowe-explorer-vscode/pull/3316)
- Fixed an issue where fetching a USS file using `UssFSProvider.stat()` with a `fetch=true` query would cause Zowe Explorer to get stuck in an infinite loop. [#3321](https://github.com/zowe/zowe-explorer-vscode/pull/3321)

## `3.0.2`

### New features and enhancements

- Zowe Explorer now includes support for the [VS Code display languages](https://code.visualstudio.com/docs/getstarted/locales) French, German, Japanese, Portuguese, and Spanish. Download the respective language pack and switch. [#3239](https://github.com/zowe/zowe-explorer-vscode/pull/3239)
- Localization of strings within Zowe Explorer webviews. [#2983](https://github.com/zowe/zowe-explorer-vscode/issues/2983)

### Bug fixes

- Fixed an issue where the contents of an editor did not update when polling spool content or using the "Pull from Mainframe" action with jobs. [#3249](https://github.com/zowe/zowe-explorer-vscode/pull/3249)
- Fixed an issue where Zowe Explorer sometimes prompted the user to convert V1 profiles when changes were made to a team configuration after initialization. [#3246](https://github.com/zowe/zowe-explorer-vscode/pull/3246)
- Fixed an issue where the encoding of a USS file was not automatically detected when opened for the first time. [#3253](https://github.com/zowe/zowe-explorer-vscode/pull/3253)

## `3.0.1`

### Bug fixes

- Fixed an issue where opening sequential data sets within favorited searches resulted in an error. [#3163](https://github.com/zowe/zowe-explorer-vscode/pull/3163)
- Fixed an issue where automatic file extension detection identified file types incorrectly. [#3181](https://github.com/zowe/zowe-explorer-vscode/pull/3181)
- Fixed an issue where Zowe Explorer displayed a "No Zowe client configurations" prompt when a project user configuration existed but no global configuration was present. [#3168](https://github.com/zowe/zowe-explorer-vscode/issues/3168)
- Fixed an issue where the `ProfilesUtils.getProfileInfo` function returned a new `ProfileInfo` instance that ignored the `ZOWE_CLI_HOME` environment variable and workspace paths. [#3168](https://github.com/zowe/zowe-explorer-vscode/issues/3168)
- Fixed an issue where the location prompt for the `Create Directory` and `Create File` USS features would appear even when a path is already set for the profile or parent folder. [#3183](https://github.com/zowe/zowe-explorer-vscode/pull/3183)
- Fixed an issue where the `Create Directory` and `Create File` features would continue processing when the first prompt was dismissed, causing an incorrect URI to be generated. [#3183](https://github.com/zowe/zowe-explorer-vscode/pull/3183)
- Fixed an issue where the `Create Directory` and `Create File` features would incorrectly handle user-specified locations with trailing slashes. [#3183](https://github.com/zowe/zowe-explorer-vscode/pull/3183)
- Fixed an issue where a 401 error could occur when opening PDS members after updating credentials within the same user session. [#3150](https://github.com/zowe/zowe-explorer-vscode/issues/3150)
- Fixed the "Edit Profile" operation to open the correct files when both global and project team configs are present. [#3125](https://github.com/zowe/zowe-explorer-vscode/issues/3125)

## `3.0.0`

### New features and enhancements

- Support VS Code engine 1.79.0 and higher.
- Updated activation event to `onStartupFinished`. [#1910](https://github.com/zowe/vscode-extension-for-zowe/issues/1910)
- Removal of Zowe V1 profile support. [#2072](https://github.com/zowe/vscode-extension-for-zowe/issues/2072)
- Removal of Theia support. [#2647](https://github.com/zowe/vscode-extension-for-zowe/issues/2647)
- Migrate package manager from Yarn to PNPM. [#2424](https://github.com/zowe/zowe-explorer-vscode/pull/2424)
- Migrated to webpack V5 [#2214](https://github.com/zowe/vscode-extension-for-zowe/issues/2214)
- Migrated from `@zowe/cli` dependency package to individual Zowe `8.0.0` SDK packages for Zowe V3 support. [#2719](https://github.com/zowe/vscode-extension-for-zowe/issues/2719)
- Updated Zowe Explorer API dependency to `3.0.0` for Zowe V3 support. Check the [list](https://github.com/zowe/zowe-explorer-vscode/wiki/v3-Changes-for-Users-and-Extenders) of APIs that were removed.
- Removed deprecated methods and conoslidated VS Code commands. Check the [list](https://github.com/zowe/zowe-explorer-vscode/wiki/v3-Changes-for-Users-and-Extenders) of APIs that were removed.
- Added `madge` dependency to support to track circular dependencies. [#2148](https://github.com/zowe/vscode-extension-for-zowe/issues/2148)
- Migrated from `i18n` to `l10n` for VS Code localization. [#2253](https://github.com/zowe/vscode-extension-for-zowe/issues/2253)
- Replaced `lodash` dependency with `es-toolkit` to reduce webview bundle size and add technical currency. [#3060](https://github.com/zowe/zowe-explorer-vscode/pull/3060)
- Replaced `ts-loader` dependency with `esbuild-loader` to improve build speed for developers. [#2909](https://github.com/zowe/zowe-explorer-vscode/pull/2909)
- Minimized activation function for Zowe Explorer to load only necessary items on activation. [#1985](https://github.com/zowe/vscode-extension-for-zowe/issues/1985)
- **Breaking:** Zowe Explorer no longer uses a temporary directory for storing Data Sets and USS files. All settings related to the temporary downloads folder have been removed. In order to access resources stored by Zowe Explorer V3, refer to the [FileSystemProvider documentation](https://github.com/zowe/zowe-explorer-vscode/wiki/FileSystemProvider) for information on how to build and access resource URIs. Extenders can detect changes to resources using the `onResourceChanged` function in the `ZoweExplorerApiRegister` class. [#2951](https://github.com/zowe/zowe-explorer-vscode/issues/2951)
- **Breaking** Moved data set templates out of data set history settings into new setting `zowe.ds.templates`. [#2345](https://github.com/zowe/zowe-explorer-vscode/issues/2345)
- Added UI migration steps on startup for users with V1 profiles to either convert existing V1 profiles to team configuration file or create a new team configuration file. [#2284](https://github.com/zowe/vscode-extension-for-zowe/issues/2284)
- Added support for Local Storage settings for persistent settings in Zowe Explorer [#2208](https://github.com/zowe/vscode-extension-for-zowe/issues/2208)
- Grouped Common methods into Singleton classes. [#2109](https://github.com/zowe/zowe-explorer-vscode/issues/2109)
- **New** Extender registration APIs:
  - `onVaultUpdate` VS Code events to notify extenders when credentials are updated on the OS vault by other applications. [#2994](https://github.com/zowe/zowe-explorer-vscode/pull/2994)
  - `onCredMgrUpdate` VS Code events to notify extenders when the local PC's credential manager has been updated by other applications. [#2994](https://github.com/zowe/zowe-explorer-vscode/pull/2994)
  - `onResourceChanged` function to the `ZoweExplorerApiRegister` class to allow extenders to subscribe to any changes to Zowe resources (data sets, USS files/folders, jobs, etc.). See the [FileSystemProvider wiki page](https://github.com/zowe/zowe-explorer-vscode/wiki/FileSystemProvider) for more information on Zowe resources.
  - `addFileSystemEvent` function to the `ZoweExplorerApiRegister` class to allow extenders to register their FileSystemProvider `onDidChangeFile` events.
- Implemented support for building, exposing, and displaying table views within Zowe Explorer. Tables can be customized and exposed using the helper facilities (`TableBuilder` and `TableMediator`) for an extender's specific use case. For more information on how to configure and show tables, please refer to the [wiki article on Table Views](https://github.com/zowe/zowe-explorer-vscode/wiki/Table-Views). [#2258](https://github.com/zowe/zowe-explorer-vscode/issues/2258)
- Added support for logging in to multiple API ML instances per team configuration file. [#2264](https://github.com/zowe/zowe-explorer-vscode/issues/2264)
- Added remote lookup functionality for data sets and USS, allowing Zowe Explorer to locate and resolve mainframe resources on demand. [#3040](https://github.com/zowe/zowe-explorer-vscode/pull/3040)
- Implemented change detection in the data sets and USS filesystems so that changes on the mainframe are reflected in opened editors for Data Sets and USS files. [#3040](https://github.com/zowe/zowe-explorer-vscode/pull/3040)
- Implemented a "Show as Table" option for profile nodes in the Jobs tree, displaying lists of jobs in a tabular view. Jobs can be filtered and sorted within this view, and users can select jobs to cancel, delete, or download. [#2258](https://github.com/zowe/zowe-explorer-vscode/issues/2258)
- Implemented the VS Code FileSystemProvider for the Data Sets, Jobs, and USS trees to handle all read/write actions as well as conflict resolution. [#2207](https://github.com/zowe/zowe-explorer-vscode/issues/2207)
  See the [FileSystemProvider wiki page](https://github.com/zowe/zowe-explorer-vscode/wiki/FileSystemProvider) for more information on the FileSystemProvider.
  - Refactored behavior and management of Favorites in Zowe Explorer. [#2026](https://github.com/zowe/zowe-explorer-vscode/issues/2026)
- Added the capability for extenders to contribute new profile types to the Zowe schema during extender activation. [#2508](https://github.com/zowe/vscode-extension-for-zowe/issues/2508)
- Added a new command feature, Issue UNIX Commands available in the VS Code command pallete or via right-click action in the USS treeview. [#1326](https://github.com/zowe/vscode-extension-for-zowe/issues/1326)
- Added enhancement to compare 2 files from MVS and/or UNIX System Services views via right click actions, with option to compare in Read-Only mode too.
- Added a prompt to create a new Zowe client configuration for an environment that does not have any Zowe client configurations. [#3148](https://github.com/zowe/zowe-explorer-vscode/pull/3148)
- Implemented support for favoriting a data set search that contains member wildcards. [#1164](https://github.com/zowe/zowe-explorer-vscode/issues/1164)
- Changed default base profile naming scheme in newly generated configuration files to prevent name and property conflicts between Global and Project profiles [#2682](https://github.com/zowe/zowe-explorer-vscode/issues/2682)
- Renamed `isHomeProfile` context helper function to `isGlobalProfile` for clarity. [#2026](https://github.com/zowe/zowe-explorer-vscode/issues/2026)
- Set up [POEditor project](https://poeditor.com/join/project/Siy3KCNFKk) for contributing translations and cleaned up redundant localization strings. [#546](https://github.com/zowe/zowe-explorer-vscode/issues/546)
- Added integration and end-to-end test framework to verify extension behavior and catch issues during Zowe Explorer development. [#2322](https://github.com/zowe/zowe-explorer-vscode/issues/2322)

### Bug fixes

- The "Zowe Resources" panel is now hidden by default until Zowe Explorer reveals it to display a table or other data. [#3113](https://github.com/zowe/zowe-explorer-vscode/issues/3113)
- Fixed behavior of logout action when token is defined in both base profile and parent profile. [#3076](https://github.com/zowe/zowe-explorer-vscode/issues/3076)
- Fixed bug that displayed obsolete profiles in the Zowe Explorer tree views after the associated team configuration file was deleted. [#3124](https://github.com/zowe/zowe-explorer-vscode/issues/3124)
- Removal of broken VSC command to `Zowe Explorer: Refresh Zowe Explorer`, use VS Code's `Extensions: Refresh` command instead. [#3100](https://github.com/zowe/zowe-explorer-vscode/issues/3100)
- Fixed issue where "Allocate Like" input box placeholder was showing a localization ID instead of the intended message ("Enter a name for the new data set"). [#2759](https://github.com/zowe/vscode-extension-for-zowe/issues/2759)
- Fixed default behavior of "Create a new Team Configuration File" to create a Project Config instead of Project User Config. [#2684](https://github.com/zowe/vscode-extension-for-zowe/issues/2684)
- Changed ZoweExplorerExtender.initForZowe `profileTypeConfigurations: imperative.ICommandProfileTypeConfiguration[]` to a required argument to address issues seen after registration of profile type when not passed. [#2575](https://github.com/zowe/vscode-extension-for-zowe/issues/2575)
- Resolved `TypeError: Cannot read properties of undefined (reading 'direction')` error for favorited items. [#3067](https://github.com/zowe/zowe-explorer-vscode/pull/3067)
- Fixed issue where switching from token-based authentication to user/password would cause an error for nested profiles. [#3142](https://github.com/zowe/zowe-explorer-vscode/issues/3142)

## `3.0.0-next.202409251932`

### New features and enhancements

- Users can now follow a prompt to create a new Zowe client configuration. The prompt displays when VS Code is opened with Zowe Explorer installed, but the user does not have any Zowe client configurations. [#3148](https://github.com/zowe/zowe-explorer-vscode/pull/3148)

### Bug fixes

- The "Zowe Resources" panel is now hidden by default until Zowe Explorer reveals it to display a table or other data. [#3113](https://github.com/zowe/zowe-explorer-vscode/issues/3113)
- Fixed behavior of logout action when token is defined in both base profile and parent profile. [#3076](https://github.com/zowe/zowe-explorer-vscode/issues/3076)
- Fixed bug that displayed obsolete profiles in the Zowe Explorer tree views after the associated team configuration file was deleted. [#3124](https://github.com/zowe/zowe-explorer-vscode/issues/3124)
- Fix issue with extender profiles not being included in fresh team configuration file. [#3122](https://github.com/zowe/zowe-explorer-vscode/issues/3122)
- Fixed issue where file extensions were removed from data sets, causing language detection to sometimes fail for Zowe Explorer extenders. [#3121](https://github.com/zowe/zowe-explorer-vscode/issues/3121)
- Fixed an issue where copying and pasting a file/folder in the USS tree would fail abruptly, displaying an error. [#3128](https://github.com/zowe/zowe-explorer-vscode/issues/3128)
- Removal of broken VSC command to `Zowe Explorer: Refresh Zowe Explorer`, use VS Code's `Extensions: Refresh` command instead. [#3100](https://github.com/zowe/zowe-explorer-vscode/issues/3100)
- Update Zowe SDKs to `8.0.0` for technical currency. [#3146](https://github.com/zowe/zowe-explorer-vscode/issues/3146)
- Fixed issue where Zowe Explorer would reload the VS Code window during initialization when no config files are present. [#3147](https://github.com/zowe/zowe-explorer-vscode/issues/3147)
- Fixed issue where obsolete credentials persisted for PDS member nodes in Data Sets tree. [#3112](https://github.com/zowe/zowe-explorer-vscode/issues/3112)
- Fixed issue where Search operation did not prompt for credentials if profile contains expired token. [#2259](https://github.com/zowe/zowe-explorer-vscode/issues/2259)
- Fixed issue where inactive status was not displayed for profiles loaded from Global Config. [#3134](https://github.com/zowe/zowe-explorer-vscode/issues/3134)

## `3.0.0-next.202409132122`

### New features and enhancements

- Implemented support for favoriting a data set search that contains member wildcards. [#1164](https://github.com/zowe/zowe-explorer-vscode/issues/1164)
- Resolved `TypeError: Cannot read properties of undefined (reading 'direction')` error for favorited items. [#3067](https://github.com/zowe/zowe-explorer-vscode/pull/3067)

### Bug fixes

- Fix issue with outdated SSH credentials stored securely in the SSH profile causing errors. [#2901](https://github.com/zowe/zowe-explorer-vscode/issues/2901)

## `3.0.0-next.202409091409`

### Bug fixes

- Update Zowe SDKs to `8.0.0-next.202408301809` for technical currency.

## `3.0.0-next.202408301858`

### New features and enhancements

- Refactored behavior and management of Favorites in Zowe Explorer. [#2026](https://github.com/zowe/zowe-explorer-vscode/issues/2026)
- Renamed `isHomeProfile` context helper function to `isGlobalProfile` for clarity. [#2026](https://github.com/zowe/zowe-explorer-vscode/issues/2026)
- Set up [POEditor project](https://poeditor.com/join/project/Siy3KCNFKk) for contributing translations and cleaned up redundant localization strings. [#546](https://github.com/zowe/zowe-explorer-vscode/issues/546)
- Replaced `ts-loader` with `esbuild-loader` to improve build speed for developers. [#2909](https://github.com/zowe/zowe-explorer-vscode/pull/2909)
- Grouped Common methods into Singleton classes. [#2109](https://github.com/zowe/zowe-explorer-vscode/issues/2109)
- **BREAKING** Moved data set templates out of data set history settings into new setting "zowe.ds.templates". [#2345](https://github.com/zowe/zowe-explorer-vscode/issues/2345)
- Ported the following enhancements from v2:
  - Added a "Copy Relative Path" context option for USS files and directories in the tree view. [#2908](https://github.com/zowe/zowe-explorer-vscode/pull/2908)
  - Added a "Copy Name" context option for data sets, jobs and spool files in the tree view. [#2908](https://github.com/zowe/zowe-explorer-vscode/pull/2908)
- Added integration and end-to-end test framework to verify extension behavior and catch issues during Zowe Explorer development. [#2322](https://github.com/zowe/zowe-explorer-vscode/issues/2322)
- **Breaking:** Removed deprecated methods: [#2238](https://github.com/zowe/zowe-explorer-vscode/issues/2238)
  - `DatasetActions.copyDataSet` - use `DatasetActions.copyDataSets` instead
  - `USSActions.pasteUssFile` - use `DatasetActions.pasteUss` instead
  - `ZoweUSSNode.refreshAndReopen` - use `ZoweUSSNode.reopen` instead
- Add deprecation message to history settings explaining to users how to edit items. [#2303](https://github.com/zowe/zowe-explorer-vscode/issues/2303)
- **Breaking:** Consolidated VS Code commands:
  - `zowe.ds.addFavorite`, `zowe.uss.addFavorite`, `zowe.jobs.addFavorite` - use `zowe.addFavorite` instead
  - `zowe.ds.disableValidation`, `zowe.uss.disableValidation`, `zowe.jobs.disableValidation` - use `zowe.disableValidation` instead
  - `zowe.ds.deleteProfile`, `zowe.uss.deleteProfile`, `zowe.jobs.deleteProfile`, `zowe.cmd.deleteProfile` - use `zowe.deleteProfile` instead
  - `zowe.ds.editSession`, `zowe.uss.editSession`, `zowe.jobs.editSession` - use `zowe.editSession` instead
  - `zowe.ds.enableValidation`, `zowe.uss.enableValidation`, `zowe.jobs.enableValidation` - use `zowe.enableValidation` instead
  - `zowe.ds.openWithEncoding`, `zowe.uss.openWithEncoding` - use `zowe.openWithEncoding` instead
  - `zowe.ds.removeFavorite`, `zowe.uss.removeFavorite`, `zowe.jobs.removeFavorite` - use `zowe.removeFavorite` instead
  - `zowe.ds.removeFavProfile`, `zowe.uss.removeFavProfile`, `zowe.jobs.removeFavProfile` - use `zowe.removeFavProfile` instead
  - `zowe.ds.removeSavedSearch`, `zowe.uss.removeSavedSearch`, `zowe.jobs.removeSearchFavorite` - use `zowe.removeFavorite` instead
  - `zowe.ds.removeSession`, `zowe.uss.removeSession`, `zowe.jobs.removeSession` - use `zowe.removeSession` instead
  - `zowe.ds.saveSearch`, `zowe.uss.saveSearch`, `zowe.jobs.saveSearch` - use `zowe.saveSearch` instead
  - `zowe.ds.ssoLogin`, `zowe.uss.ssoLogin`, `zowe.jobs.ssoLogin` - use `zowe.ssoLogin` instead
  - `zowe.ds.ssoLogout`, `zowe.uss.ssoLogout`, `zowe.jobs.ssoLogout` - use `zowe.ssoLogout` instead
- Added support for `consoleName` property in z/OSMF profiles when issuing MVS commands [#1667](https://github.com/zowe/vscode-extension-for-zowe/issues/1667)
- Updated sorting of PDS members to show items without stats at bottom of list [#2660](https://github.com/zowe/vscode-extension-for-zowe/issues/2660)
- Added PEM certificate support as an authentication method for logging into the API ML. [#2621](https://github.com/zowe/zowe-explorer-vscode/issues/2621)
- Added support to view the Encoding history for MVS and Dataset in the History View. [#2776](https://github.com/zowe/vscode-extension-for-zowe/issues/2776)
- Added error handling for when the default credential manager is unable to initialize. [#2811](https://github.com/zowe/zowe-explorer-vscode/issues/2811)
- **Breaking:** Zowe Explorer no longer uses a temporary directory for storing Data Sets and USS files. All settings related to the temporary downloads folder have been removed. In order to access resources stored by Zowe Explorer v3, refer to the [FileSystemProvider documentation](https://github.com/zowe/zowe-explorer-vscode/wiki/FileSystemProvider) for information on how to build and access resource URIs. Extenders can detect changes to resources using the `onResourceChanged` function in the `ZoweExplorerApiRegister` class. [#2951](https://github.com/zowe/zowe-explorer-vscode/issues/2951)
- Implemented the `onVaultUpdate` VSCode events to notify extenders when credentials are updated on the OS vault by other applications. [#2994](https://github.com/zowe/zowe-explorer-vscode/pull/2994)
- Changed default base profile naming scheme in newly generated configuration files to prevent name and property conflicts between Global and Project profiles [#2682](https://github.com/zowe/zowe-explorer-vscode/issues/2682)
- Implemented the `onCredMgrUpdate` VSCode events to notify extenders when the local PC's credential manager has been updated by other applications. [#2994](https://github.com/zowe/zowe-explorer-vscode/pull/2994)
- Implemented support for building, exposing and displaying table views within Zowe Explorer. Tables can be customized and exposed using the helper facilities (`TableBuilder` and `TableMediator`) for an extender's specific use case. For more information on how to configure and show tables, please refer to the [wiki article on Table Views](https://github.com/zowe/zowe-explorer-vscode/wiki/Table-Views). [#2258](https://github.com/zowe/zowe-explorer-vscode/issues/2258)
- Added support for logging in to multiple API ML instances per team config file. [#2264](https://github.com/zowe/zowe-explorer-vscode/issues/2264)
- Added remote lookup functionality for Data Sets and USS, allowing Zowe Explorer to locate and resolve mainframe resources on demand. [#3040](https://github.com/zowe/zowe-explorer-vscode/pull/3040)
- Implemented change detection in the Data Sets and USS filesystems, so that changes on the mainframe will be reflected in opened editors for Data Sets and USS files. [#3040](https://github.com/zowe/zowe-explorer-vscode/pull/3040)
- Implemented a "Show as Table" option for profile nodes in the Jobs tree, displaying lists of jobs in a tabular view. Jobs can be filtered and sorted within this view, and users can select jobs to cancel, delete or download. [#2258](https://github.com/zowe/zowe-explorer-vscode/issues/2258)
- Replaced `lodash` dependency with `es-toolkit` to reduce webview bundle size and add technical currency. [#3060](https://github.com/zowe/zowe-explorer-vscode/pull/3060)

### Bug fixes

- Fixed vNext-only issue where users are not able to create data sets. [#2783](https://github.com/zowe/vscode-extension-for-zowe/pull/2783).
- Omitted the following Zowe Explorer commands from the Command Palette that do not execute properly when run as a standalone command:
  - `Zowe Explorer: Cancel job`
  - `Zowe Explorer: Filter jobs`
  - `Zowe Explorer: Filter PDS members`
  - `Zowe Explorer: Sort jobs`
  - `Zowe Explorer: Sort PDS members`
  - `Zowe Explorer: Start Polling`
  - `Zowe Explorer: Stop Polling`
- Ported the following fixes from v2:
  - Moved schema warnings into the log file (rather than a UI message) to minimize end-user disruption. [#2860](https://github.com/zowe/zowe-explorer-vscode/pull/2860)
- Fix issue with base profile not being included in fresh team configuration file. [#2887](https://github.com/zowe/zowe-explorer-vscode/issues/2887)
- Fixed an issue where the `onProfilesUpdate` event did not fire after secure credentials were updated. [#2822](https://github.com/zowe/zowe-explorer-vscode/issues/2822)
- Fixed issue where saving changes to favorited PDS member fails when custom temp folder is set on Windows. [#2880](https://github.com/zowe/zowe-explorer-vscode/issues/2880)
- Fixed issue where multiple extensions that contribute profiles to a tree view using the Zowe Explorer API may fail to load. [#2888](https://github.com/zowe/zowe-explorer-vscode/issues/2888)
- Fixed regression where `getProviderForNode` returned the wrong tree provider after performing an action on a Zowe tree node, causing some commands to fail silently. [#2967](https://github.com/zowe/zowe-explorer-vscode/issues/2967)
- Fixed issue where creating a new team configuration file could cause Zowe Explorer to crash, resulting in all sessions disappearing from trees. [#2906](https://github.com/zowe/zowe-explorer-vscode/issues/2906)
- Addressed breaking changes from the Zowe Explorer API package.[#2952](https://github.com/zowe/zowe-explorer-vscode/issues/2952)
- Fixed data set not opening when the token has expired. [#3001](https://github.com/zowe/zowe-explorer-vscode/issues/3001)
- Fixed an issue where upgrading from Zowe Explorer v1 and selecting "Reload Extensions" causes Zowe Explorer v3 to fail during initialization. [#3051](https://github.com/zowe/zowe-explorer-vscode/pull/3051)
- Fixed an issue where remote lookup functionality caused the local side of a conflict to be overwritten with the remote contents. [#3085](https://github.com/zowe/zowe-explorer-vscode/pull/3085)
- Fixed an issue where the remote conflict icons showed when using the "Compare with Selected" feature. [#3085](https://github.com/zowe/zowe-explorer-vscode/pull/3085)
- Resolved an issue where extender event callbacks were not always fired when the team configuration file was created, updated or deleted. [#3078](https://github.com/zowe/zowe-explorer-vscode/issues/3078)
- Update Zowe SDKs to `8.0.0-next.202408291544` for technical currency. [#3057](https://github.com/zowe/zowe-explorer-vscode/pull/3057)
- Fix issue with UnixCommand prompting for credentials. [#2762](https://github.com/zowe/zowe-explorer-vscode/issues/2762)
- Fixed issue where listing data sets or USS files would cause a drastic increase in API calls, causing delays or a complete halt in Zowe Explorer. [#3093](https://github.com/zowe/zowe-explorer-vscode/pull/3093)

## `3.0.0-next.202404242037`

### New features and enhancements

- Implemented the FileSystemProvider for the Data Sets, Jobs and USS trees to handle all read/write actions as well as conflict resolution. [#2207](https://github.com/zowe/zowe-explorer-vscode/issues/2207)
- **Breaking:** Removed the `zowe.jobs.zosJobsOpenSpool` command in favor of using `vscode.open` with a spool URI. See the [FileSystemProvider wiki page](https://github.com/zowe/zowe-explorer-vscode/wiki/FileSystemProvider#file-paths-vs-uris) for more information on spool URIs. [#2207](https://github.com/zowe/zowe-explorer-vscode/issues/2207)
- **Breaking:** Removed the `zowe.ds.ZoweNode.openPS` command in favor of using `vscode.open` with a data set URI. See the [FileSystemProvider wiki page](https://github.com/zowe/zowe-explorer-vscode/wiki/FileSystemProvider#file-paths-vs-uris) for more information on data set URIs. [#2207](https://github.com/zowe/zowe-explorer-vscode/issues/2207)
- **Breaking:** Removed the `zowe.uss.ZoweUSSNode.open` command in favor of using `vscode.open` with a USS URI. See the [FileSystemProvider wiki page](https://github.com/zowe/zowe-explorer-vscode/wiki/FileSystemProvider#file-paths-vs-uris) for more information on USS URIs. [#2207](https://github.com/zowe/zowe-explorer-vscode/issues/2207)
- Added the `onResourceChanged` function to the `ZoweExplorerApiRegister` class to allow extenders to subscribe to any changes to Zowe resources (Data Sets, USS files/folders, Jobs, etc.). See the [FileSystemProvider wiki page](https://github.com/zowe/zowe-explorer-vscode/wiki/FileSystemProvider) for more information on Zowe resources.
- Added the `addFileSystemEvent` function to the `ZoweExplorerApiRegister` class to allow extenders to register their FileSystemProvider "onDidChangeFile" events. See the [FileSystemProvider wiki page](https://github.com/zowe/zowe-explorer-vscode/wiki/FileSystemProvider) for more information on the FileSystemProvider.

### Bug fixes

- Fixed issue where "Allocate Like" input box placeholder was showing a localization ID instead of the intended message ("Enter a name for the new data set"). [#2759](https://github.com/zowe/vscode-extension-for-zowe/issues/2759)
- Fix concerns regarding Unix command handling work. [#2866](https://github.com/zowe/zowe-explorer-vscode/pull/2866)

## `3.0.0-next.202403051607`

### New features and enhancements

- Implemented sorting of PDS members by date created [#2565](https://github.com/zowe/vscode-extension-for-zowe/pull/2565)
- Added the capability for extenders to contribute new profile types to the Zowe schema during extender activation. [#2508](https://github.com/zowe/vscode-extension-for-zowe/issues/2508)
- Migrated from `@zowe/cli` package to individual Zowe SDK packages. [#2719](https://github.com/zowe/vscode-extension-for-zowe/issues/2719)

### Bug fixes

- Fixed default behavior of "Create a new Team Configuration File" to create a Project Config instead of Project User Config. [#2684](https://github.com/zowe/vscode-extension-for-zowe/issues/2684)
- Adjusted order of 'Manage Profile' and 'Edit History' in the jobs tree's context menu to match the other trees. [#2670](https://github.com/zowe/vscode-extension-for-zowe/issues/2670)
- Updated the SDK dependencies to `8.0.0-next.202403041352` for technical currency [#2754](https://github.com/zowe/vscode-extension-for-zowe/pull/2754).

## `3.0.0-next.202402142205`

### New features and enhancements

- **Breaking:** Removed `zowe.uss.binary` and `zowe.uss.text` commands. Use `zowe.uss.openWithEncoding` instead.
- Added UI migration steps on startup for users with v1 profiles to either convert existing v1 profiles to team configuration file or create a new team configuration file. [#2284](https://github.com/zowe/vscode-extension-for-zowe/issues/2284)
- Removal of Theia support. [#2647](https://github.com/zowe/vscode-extension-for-zowe/issues/2647)

### Bug fixes

- Updated dependencies for technical currency purposes.
- Fixed issue where spools with duplicate DD names would overwrite each other causing less spools in job output view [#2315](https://github.com/zowe/vscode-extension-for-zowe/issues/2315)

## `3.0.0-next.202402071248`

### New features and enhancements

- Adapted to new API changes from grouping of common methods into singleton classes [#2109](https://github.com/zowe/vscode-extension-for-zowe/issues/2109)
- Migrated to webpack v5 [#2214](https://github.com/zowe/vscode-extension-for-zowe/issues/2214)

## `3.0.0-next.202401241448`

### New features and enhancements

- Removed Gulp dependency and migrated from `i18n` standard to `l10n`. [#2253](https://github.com/zowe/vscode-extension-for-zowe/issues/2253)

### Bug fixes

- Changed ZoweExplorerExtender.initForZowe `profileTypeConfigurations: imperative.ICommandProfileTypeConfiguration[]` to a required argument to address issues seen after registration of profile type when not passed. [#2575](https://github.com/zowe/vscode-extension-for-zowe/issues/2575)

## `3.0.0-next.202401121747`

### New features and enhancements

- Added the Issue UNIX Commands feature. [#1326](https://github.com/zowe/vscode-extension-for-zowe/issues/1326)
- Minimized activation function for Zowe Explorer to load only necessary items on activation. [#1985](https://github.com/zowe/vscode-extension-for-zowe/issues/1985)
- Added back local storage for Zowe Explorer persistent items

### Bug fixes

- Update dependencies for technical currency purposes.

## `3.0.0-next.202311171754`

## `3.0.0-next.202311171523`

### New features and enhancements

- Migrate from Yarn to PNPM.
- Update dependencies for technical currency purposes
- Support VS Code engine 1.79.0 and higher.
- Ability to compare 2 files from MVS and/or UNIX System Services views via right click actions, with option to compare in Read-Only mode too.

## `3.0.0-next.202309121526`

### New features and enhancements

- Removal of v1 profile support. [#2072](https://github.com/zowe/vscode-extension-for-zowe/issues/2072)
- Removal of support for Zowe Explorer APIs that have been removed. Check the [list](https://github.com/zowe/vscode-extension-for-zowe/tree/next/docs/early-access/v3/Extenders.md) of APIs that were removed.
- Added support for Local Storage settings for persistent settings in Zowe Explorer [#2208](https://github.com/zowe/vscode-extension-for-zowe/issues/2208)
- Updated activation event to `onStartupFinished`. [#1910](https://github.com/zowe/vscode-extension-for-zowe/issues/1910)
- Added `madge` script in `package.json` to track circular dependencies. [#2148](https://github.com/zowe/vscode-extension-for-zowe/issues/2148)
- Migrated to new package manager PNPM from Yarn.

## `2.18.0`

### New features and enhancements

- Added new Zowe Explorer z/OS Console webview with access via VS Code command pallete to issue MVS Console commands. [#2925](https://github.com/zowe/zowe-explorer-vscode/pull/2925)

### Bug fixes

- Fixed issue where creating a new team configuration file could cause Zowe Explorer to crash, resulting in all sessions disappearing from trees. [#2906](https://github.com/zowe/zowe-explorer-vscode/issues/2906)
- Fixed data set not opening when the token has expired. [#3001](https://github.com/zowe/zowe-explorer-vscode/issues/3001)
- Fixed JSON errors being ignored when `zowe.config.json` files change on disk and are reloaded. [#3066](https://github.com/zowe/zowe-explorer-vscode/issues/3066) [#3074](https://github.com/zowe/zowe-explorer-vscode/issues/3074)
- Resolved an issue where extender event callbacks were not always fired when the team configuration file was created, updated or deleted. [#3078](https://github.com/zowe/zowe-explorer-vscode/issues/3078)

## `2.17.0`

### New features and enhancements

- To add the ability to open a Favorited Job Search under Favorites [#2630](https://github.com/zowe/zowe-explorer-vscode/pull/2930)
- Added the ability to switch between basic authentication and token-based authentication. [#2944](https://github.com/zowe/zowe-explorer-vscode/pull/2944)

## `2.16.3`

### Bug fixes

- Fixed issue where USS files could not be submitted as JCL. [#2991](https://github.com/zowe/zowe-explorer-vscode/issues/2991)

## `2.16.2`

### Bug fixes

- Update dependencies for technical currency purposes.
- Fix issue Right-click-delete option deleting the currently open/selected file and not the file which is right-clicked when members having same name [#2941](https://github.com/zowe/zowe-explorer-vscode/issues/2941)
- Fixed issue where Download Spool action could fail to find spool files to download. [#2943](https://github.com/zowe/zowe-explorer-vscode/pull/2943)

## `2.16.1`

### Bug fixes

- Fixed issue where multiple extensions that contribute profiles to a tree view using the Zowe Explorer API may fail to load. [#2888](https://github.com/zowe/zowe-explorer-vscode/issues/2888)

## `2.16.0`

### New features and enhancements

- Added support for `consoleName` property in z/OSMF profiles when issuing MVS commands. [#1667](https://github.com/zowe/vscode-extension-for-zowe/issues/1667)
- Updated sorting of PDS members to show items without stats at bottom of list. [#2660](https://github.com/zowe/vscode-extension-for-zowe/issues/2660)
- Added support to view the Encoding history for MVS and Dataset in the History View. [#2776](https://github.com/zowe/zowe-explorer-vscode/pull/2776)
- Updated MVS view progress indicator for entering a filter search. [#2181](https://github.com/zowe/zowe-explorer-vscode/issues/2181)
- Added error handling for when the default credential manager is unable to initialize. [#2811](https://github.com/zowe/zowe-explorer-vscode/issues/2811)
- Provide users with the option to upload binary files by implementing a "Upload Files (Binary)" right-click option in the USS tree. [#1956](https://github.com/zowe/zowe-explorer-vscode/issues/1956)
- Added Status bar to indicate that data is being pulled from mainframe. [#2484](https://github.com/zowe/zowe-explorer-vscode/issues/2484)
- Added PEM certificate support as an authentication method for logging into the API ML. [#2621](https://github.com/zowe/zowe-explorer-vscode/issues/2621)
- Added a confirmation dialog when the encoding is changed for an unsaved data set or USS file. [#2911](https://github.com/zowe/zowe-explorer-vscode/pull/2911)
- Added a "Copy Relative Path" context option for USS files and directories in the tree view. [#2908](https://github.com/zowe/zowe-explorer-vscode/pull/2908)
- Added a "Copy Name" context option for data sets, jobs and spool files in the tree view. [#2908](https://github.com/zowe/zowe-explorer-vscode/pull/2908)

### Bug fixes

- Fixed issue where clicking on a submitted job hyperlink throws an error. [#2813](https://github.com/zowe/vscode-extension-for-zowe/issues/2813)
- Omitted the following Zowe Explorer commands from the Command Palette that do not execute properly when run as a standalone command: [#2853](https://github.com/zowe/zowe-explorer-vscode/pull/2853)
  - `Zowe Explorer: Cancel job`
  - `Zowe Explorer: Filter jobs`
  - `Zowe Explorer: Filter PDS members`
  - `Zowe Explorer: Sort jobs`
  - `Zowe Explorer: Sort PDS members`
  - `Zowe Explorer: Start Polling`
  - `Zowe Explorer: Stop Polling`
- Duplicated profile schema writing on repeated Team Config file initialization:
  [#2828](https://github.com/zowe/zowe-explorer-vscode/pull/2828)
- Fixed issue where saving changes to favorited PDS member fails when custom temp folder is set on Windows. [#2880](https://github.com/zowe/zowe-explorer-vscode/issues/2880)
- Fixed issue where data sets or members containing binary content cannot be opened. [#2696](https://github.com/zowe/zowe-explorer-vscode/issues/2696)

## `2.15.4`

### Bug fixes

- Fixed issue where new PDS member node cannot be re-opened unless you pull from mainframe. [#2857](https://github.com/zowe/zowe-explorer-vscode/issues/2857)
- Fixed issue where expanding a favorited PDS resulted in an error message. [#2873](https://github.com/zowe/zowe-explorer-vscode/issues/2873)

## `2.15.3`

### Bug fixes

- Fixed error that could occur when listing data set members that contain control characters in the name. [#2807](https://github.com/zowe/zowe-explorer-vscode/pull/2807)
- Fixed issue where saving changes to a favorited data set or USS file could fail when it is opened outside of favorites. [#2820](https://github.com/zowe/vscode-extension-for-zowe/pull/2820)
- Moved schema warnings into the log file (rather than a UI message) to minimize end-user disruption. [#2860](https://github.com/zowe/zowe-explorer-vscode/pull/2860)
- Fixed duplicated profile schema writing with repeated Team Config file initialization. [#2828](https://github.com/zowe/zowe-explorer-vscode/pull/2828)

## `2.15.2`

### Bug fixes

- Fixed issue where files left open in prior VS Code session cannot be uploaded to mainframe after window is reloaded. [#2758](https://github.com/zowe/vscode-extension-for-zowe/issues/2758)
- Fixed issue where saving changes to favorited data set or USS file could fail. [#2801](https://github.com/zowe/vscode-extension-for-zowe/pull/2801)

## `2.15.1`

### Bug fixes

- Fixed issue where VS Code quick pick separators were used in environments that did not support the feature. [#2771](https://github.com/zowe/vscode-extension-for-zowe/pull/2771)

## `2.15.0`

### New features and enhancements

- Implemented sorting of PDS members by date created [#2707](https://github.com/zowe/vscode-extension-for-zowe/pull/2707)
- Added the capability for extenders to contribute new profile types to the Zowe schema during extender activation. [#2508](https://github.com/zowe/vscode-extension-for-zowe/issues/2508)
- Sort encoding by the latest encoding and filter any duplicate encoding if it already exists.
- Implemented sorting of jobs by timestamp(on last job ran) [#1685](https://github.com/zowe/vscode-extension-for-zowe/issues/1685)

### Bug fixes

- Adjusted order of 'Manage Profile' and 'Edit History' in the jobs tree's context menu to match the other trees. [#2670](https://github.com/zowe/vscode-extension-for-zowe/issues/2670)
- Fixed issue where spools with duplicate DD names would overwrite each other causing less spools in job output view [#2315](https://github.com/zowe/vscode-extension-for-zowe/issues/2315)
- To fix Strange behaviour with the Job label in Job Favorites [#2632](https://github.com/zowe/vscode-extension-for-zowe/issues/2632)
- Fixed issue of migrate/recall icons and right-click options now update instantly upon selection, eliminating the need to reload VSCode [#2755](https://github.com/zowe/vscode-extension-for-zowe/issues/2755)
- To fix error when user clicks on a favourited job [#2618](https://github.com/zowe/vscode-extension-for-zowe/issues/2618)

## `2.14.1`

### Bug fixes

- Update transitive dependencies for technical currency.

## `2.14.0`

### New features and enhancements

- Added new data set creation template for partitioned data set extended. [#2600](https://github.com/zowe/vscode-extension-for-zowe/issues/2600)
- Added "Open with Encoding" feature to open data sets and USS files in a non-standard codepage. [#2435](https://github.com/zowe/vscode-extension-for-zowe/issues/2435)
- Adopted new common methods for `loginWithBaseProfile` and `logoutWithBaseProfile`. [#2493](https://github.com/zowe/vscode-extension-for-zowe/pull/2493)
- Added APIML dynamic token support. [#2665](https://github.com/zowe/vscode-extension-for-zowe/issues/2665)
- Implemented profile determination without triggering quick pick for `Submit JCL` if the file is part of Zowe Explorer's temp files. [#2628](https://github.com/zowe/vscode-extension-for-zowe/issues/2628)

### Bug fixes

- Fixed the allocate-like functionality by removing the inclusion of DS item in the filter history. [#2620](https://github.com/zowe/vscode-extension-for-zowe/issues/2620)
- Fixed issue with `Submit JCL` losing focus on JCL being submitted, causing the wrong job submission. [#2616](https://github.com/zowe/vscode-extension-for-zowe/issues/2616)
- Fixed issue where USS file tag could get overwritten when changes to file are uploaded. [#2576](https://github.com/zowe/vscode-extension-for-zowe/issues/2576)
- Fixed failure to refresh token value after user logs in to authentication. [#2638](https://github.com/zowe/vscode-extension-for-zowe/issues/2638)
- Fixed order of spool files reverses when the Job is expanded and collapsed. [#2644](https://github.com/zowe/vscode-extension-for-zowe/pull/2644)
- Fixed local filtering of jobs to work with SMFID (exec-member field). [#2651](https://github.com/zowe/vscode-extension-for-zowe/pull/2651)
- Fixed tree item labels failing to update after renaming an MVS or USS file or folder. [#2656](https://github.com/zowe/vscode-extension-for-zowe/issues/2656)
- Updated the `@zowe/cli` dependency to address the "blksz to 0 after an Allocate Like" issue. [#2610](https://github.com/zowe/vscode-extension-for-zowe/pull/2610). Thanks @KevinLoesch1
- Fixed unintended behavior in `ProfileUtils.isProfileUsingBasicAuth`. [#2664](https://github.com/zowe/vscode-extension-for-zowe/issues/2664)
- Fixed the recent search job id filter. [#2562](https://github.com/zowe/vscode-extension-for-zowe/issues/2562)

## `2.13.1`

### Bug fixes

- Update dependencies for technical currency purposes.

## `2.13.0`

### New features and enhancements

- Added support for hiding a Zowe profile across all trees [#2567](https://github.com/zowe/vscode-extension-for-zowe/issues/2567)
- Added support for enabling/disabling validation for a Zowe profile across all trees [#2570](https://github.com/zowe/vscode-extension-for-zowe/issues/2570)
- Added Display confirmation dialog when submitting local JCL. [#2061](https://github.com/zowe/vscode-extension-for-zowe/issues/2061)
- Added support for adding a Zowe profile across all trees [#2603](https://github.com/zowe/vscode-extension-for-zowe/issues/2603)
- Added "Filter Jobs" feature in Jobs tree view: accessible via filter icon or right-clicking on session node. [#2599](https://github.com/zowe/vscode-extension-for-zowe/issues/2599)
- Added z/OS System Name (SMFID) to Zowe Explorer Jobs View. [#2629](https://github.com/zowe/vscode-extension-for-zowe/issues/2629)
- PROC and PROCLIB datasets are recognized as JCL files for syntax highlighting [#2614](https://github.com/zowe/vscode-extension-for-zowe/issues/2614)

### Bug fixes

- Fixed dataset allocation issue when secondary space (or other numeric values that did not exists in the dataset-template) where specified [#2591](https://github.com/zowe/vscode-extension-for-zowe/issues/2591)
- Fixed issue where an opened USS file or data set could not be saved once a user changes their search pattern in the Side Bar. [#2597](https://github.com/zowe/vscode-extension-for-zowe/issues/2597)

## `2.12.2`

### Bug fixes

- Fixed issue where etag was not updated for USS files after conflict is detected and user selects Overwrite option.

## `2.12.1`

### Bug fixes

- Fix issue with certain actions displaying profiles that are not registered with the tree that is providing the action. [#2534](https://github.com/zowe/vscode-extension-for-zowe/issues/2534)
- Update when the option to submit local file as JCL will be displayed in context menus. [#2541](https://github.com/zowe/vscode-extension-for-zowe/issues/2541)
- Solved issue with a conflicting keybinding for `Edit History`, changed keybinding to `Ctrl`+`Alt`+`y` for Windows and `⌘ Cmd`+`⌥ Opt`+`y` for macOS. [#2543](https://github.com/zowe/vscode-extension-for-zowe/issues/2543)
- Removed duplicate context menu items displayed in USS view that now exist within the `Manage Profile` option.[#2547](https://github.com/zowe/vscode-extension-for-zowe/issues/2547)
- Fixed issue where sort PDS feature applied the date description to members without a valid date [#2552](https://github.com/zowe/vscode-extension-for-zowe/issues/2552)
- Fixed VSC Compare function, not working with Favorites from Zowe Explorer. [#2549](https://github.com/zowe/vscode-extension-for-zowe/pull/2549)
- Fixed issue where setting `zowe.security.checkForCustomCredentialManagers` appeared in all scopes instead of just the user scope [#2555](https://github.com/zowe/vscode-extension-for-zowe/issues/2555)

## `2.12.0`

### New features and enhancements

- Introduce a new user interface for managing profiles via right-click action "Manage Profile".
- Added new edit feature on `Edit Attributes` view for changing file tags on USS. [#2113](https://github.com/zowe/vscode-extension-for-zowe/issues/2113)
- Added new API {ZE Extender MetaData} to allow extenders to have the metadata of registered extenders to aid in team configuration file creation from a view that isn't Zowe Explorer's. [#2394](https://github.com/zowe/vscode-extension-for-zowe/issues/2394)
- Added ability to install extension from VS Code marketplace if custom credential manager extension is missing after defining it on `imperative.json`. [#2381](https://github.com/zowe/vscode-extension-for-zowe/issues/2381)
- Added new right-click action for `Submit as JCL` for local files in the VS Code file explorer as well as files opened in the VS Code text editor. [#2475](https://github.com/zowe/vscode-extension-for-zowe/issues/2475)
- Added "Sort PDS members" feature in Data Sets tree view: accessible via sort icon on session node, or by right-clicking a PDS or session. [#2420](https://github.com/zowe/vscode-extension-for-zowe/issues/2420)
- Added "Filter PDS members" feature in Data Sets tree view: accessible via filter icon on session node, or by right-clicking a PDS or session. [#2420](https://github.com/zowe/vscode-extension-for-zowe/issues/2420)
- Added descriptions to data set nodes if filtering and/or sorting is enabled (where applicable).
- Added webview for editing persistent items on Zowe Explorer. [#2488](https://github.com/zowe/vscode-extension-for-zowe/issues/2488)

### Bug fixes

- Fixed submitting local JCL using command pallet option `Zowe Explorer: Submit as JCL` by adding a check for chosen profile returned to continue the action. [#1625](https://github.com/zowe/vscode-extension-for-zowe/issues/1625)
- Fixed conflict resolution being skipped if local and remote file have different contents but are the same size. [#2496](https://github.com/zowe/vscode-extension-for-zowe/issues/2496)
- Fixed issue with token based auth for unsecure profiles in Zowe Explorer. [#2518](https://github.com/zowe/vscode-extension-for-zowe/issues/2518)

## `2.11.2`

### Bug fixes

- Update Zowe Explorer API dependency to pick up latest fixes for Zowe Secrets. [#2512](https://github.com/zowe/vscode-extension-for-zowe/issues/2512)

## `2.11.1`

### Bug fixes

- Fixed issue where USS nodes were not removed from tree during deletion. [#2479](https://github.com/zowe/vscode-extension-for-zowe/issues/2479)
- Fixed issue where new USS nodes from a paste operation were not shown in tree until refreshed. [#2479](https://github.com/zowe/vscode-extension-for-zowe/issues/2479)
- Fixed issue where the "Delete Job" action showed a successful deletion message, even if the API returned an error.
- USS directories, PDS nodes, job nodes and session nodes now update with their respective "collapsed icon" when collapsed.
- Fixed bug where the list of datasets from a filter search was not re-sorted after a new data set was created in Zowe Explorer. [#2473](https://github.com/zowe/vscode-extension-for-zowe/issues/2473)

## `2.11.0`

### New features and enhancements

- Allow deleting migrated datasets [#2447](https://github.com/zowe/vscode-extension-for-zowe/issues/2447)

### Bug fixes

- Fixed issue with favorited Job filter search. [#2440](https://github.com/zowe/vscode-extension-for-zowe/issues/2440)
- Remove the 'Show Attributes' context menu action for migrated datasets. [#2033](https://github.com/zowe/vscode-extension-for-zowe/issues/2033)
- Fixed issue with endless credential prompt loop when logging out. [#2262](https://github.com/zowe/vscode-extension-for-zowe/issues/2262)
- Bump `@zowe/secrets-for-zowe-sdk` to 7.18.4 to handle install errors gracefully and to allow running without MSVC redistributables.
- Fixed issue where data set content does not always appear as soon as the editor is opened. [#2427](https://github.com/zowe/vscode-extension-for-zowe/issues/2427)
- Adjust scope of "Security: Secure Credentials Enabled" setting to `machine-overridable` so it appears again in certain cloud IDEs.
- Fixed issue where disabling "Automatic Profile Validation" caused the search prompts to stop appearing for all tree views. [#2454](https://github.com/zowe/vscode-extension-for-zowe/issues/2454)

## `2.10.0`

### New features and enhancements

- Added call to callback if defined by extenders when a change to the team config profile is made. [#2385](https://github.com/zowe/vscode-extension-for-zowe/issues/2385)
- Replaced `keytar` dependency with `keyring` module from [`@zowe/secrets-for-zowe-sdk`](https://github.com/zowe/zowe-cli/tree/master/packages/secrets). [#2358](https://github.com/zowe/vscode-extension-for-zowe/issues/2358) [#2348](https://github.com/zowe/vscode-extension-for-zowe/issues/2348)
- Added "Edit Attributes" option for USS files and folders. [#2254](https://github.com/zowe/vscode-extension-for-zowe/issues/2254)

### Bug fixes

- Fix the USS refresh icon (replacing "download" with "refresh")
- Fix error for Theia check when token authentication returns 401. [#2407](https://github.com/zowe/vscode-extension-for-zowe/issues/2407)

## `2.9.2`

### Bug fixes

- Added jobs not found message when no results are returned from filter [#2362](https://github.com/zowe/vscode-extension-for-zowe/issues/2362)
- Fixed loop when user selects Cancel on the Check Credentials message. [#2262](https://github.com/zowe/vscode-extension-for-zowe/issues/2262)
- Fixed issue where job session nodes were not adding new job nodes when refreshed. [#2370](https://github.com/zowe/vscode-extension-for-zowe/issues/2370)
- Fixed error when listing data set members that include control characters in the name.

## `2.9.1`

### Bug fixes

- Optimized fetching and caching of child nodes across the primary tree views (Data Sets, Unix System Services, Jobs). [#2347](https://github.com/zowe/vscode-extension-for-zowe/issues/2347)
- Fixed issue where profiles with authentication tokens were breaking functionality for direct-to-service profiles after user interaction. [#2330](https://github.com/zowe/vscode-extension-for-zowe/issues/2330)
- Fixed profile watcher for browser based environments. [#2211](https://github.com/zowe/vscode-extension-for-zowe/issues/2211)
- Updated dependencies for security audits.

## `2.9.0`

### New features and enhancements

- Added option to save unique data set attributes as a template after allocation for future use. [#1425](https://github.com/zowe/vscode-extension-for-zowe/issues/1425)
- Added "Cancel Job" feature for job nodes in Jobs tree view. [#2251](https://github.com/zowe/vscode-extension-for-zowe/issues/2251)
- Enhanced ID generation for parent tree nodes to ensure uniqueness.
- Added support for custom credential manager extensions in Zowe Explorer [#2212](https://github.com/zowe/vscode-extension-for-zowe/issues/2212)

### Bug fixes

- Fixed issue where the "Disable Validation for Profile" context menu option did not update to "Enable Validation for Profile" after use. [#1897](https://github.com/zowe/vscode-extension-for-zowe/issues/1897)
- Fixed parameters passed to `path.join()` calls [#2172](https://github.com/zowe/vscode-extension-for-zowe/issues/2172)
- Fixed issue handling job files with the same DD names across different steps. [#2279](https://github.com/zowe/vscode-extension-for-zowe/issues/2279)
- Fixed issue handling job files with unnamed steps. [#2315](https://github.com/zowe/vscode-extension-for-zowe/issues/2315)
- Fixed issue with Windows path when uploading a file to a data set. [#2323](https://github.com/zowe/vscode-extension-for-zowe/issues/2323)
- Fixed an issue where the mismatch etag error returned was not triggering the diff editor, resulting in possible loss of data due to the issue. [#2277](https://github.com/zowe/vscode-extension-for-zowe/issues/2277)
- Fixed issue where refreshing views collapsed the respective trees. [#2215](https://github.com/zowe/vscode-extension-for-zowe/issues/2215)
- Fixed an issue where user would not get prompted when authentication error is thrown. [#2334](https://github.com/zowe/vscode-extension-for-zowe/issues/2334)
- Fixed issue where profiles with authentication tokens were breaking functionality for direct-to-service profiles after user interaction. [#2111](https://github.com/zowe/vscode-extension-for-zowe/issues/2111)

## `2.8.2`

### Bug fixes

- Fixed `zowe.settings.version` being added to settings.json in workspaces. [#2312](https://github.com/zowe/vscode-extension-for-zowe/issues/2312)

## `2.8.1`

### Bug fixes

- Fixed an issue with updating imperative.json file's Credential Manager value. [#2289](https://github.com/zowe/vscode-extension-for-zowe/issues/2289)
- Fixed an issue with "Zowe Explorer: Poll Content in Active Editor" keybind interfering with debug capabilities in VScode. The keybind to poll JES Spool file content will require the spool file to be active in the text editor. [#2285](https://github.com/zowe/vscode-extension-for-zowe/issues/2285)
- Updated linter rules and addressed linter errors. [#2291](https://github.com/zowe/vscode-extension-for-zowe/issues/2291)
- Fixed an issue with `zowe.settings.version` setting being updated with incorrect type. [#2166](https://github.com/zowe/vscode-extension-for-zowe/issues/2166)
- Updated dependencies for security audits.

## `2.8.0`

### New features and enhancements

- Added a new Zowe Explorer setting, `zowe.logger`, with a default setting of `INFO`.
- Added an output channel, `Zowe Explorer`, for logging within VS Code's Output view. The log level is set by the new Zowe Explorer setting, `zowe.logger`.
- Added a new setting `zowe.files.logsFolder.path` that can be used to override Zowe Explorer logs folder if default location is read-only. [#2186](https://github.com/zowe/vscode-extension-for-zowe/issues/2186)
- Opening a dialog for Upload or Download of files will now open at the project level directory or the user's home directory if no project is opened. [#2203](https://github.com/zowe/vscode-extension-for-zowe/issues/2203)
- Updated linter rules and addressed linter errors. [#2184](https://github.com/zowe/vscode-extension-for-zowe/issues/2184)
- Added polling options for JES Spool files. Spool files can be polled manually by clicking on the spool file name or automatic polling can be set with `Start Polling` option in context menu. [#1952](https://github.com/zowe/vscode-extension-for-zowe/issues/1952)
- Added the JOBS context menu option to download all spool files in binary format. [#2060](https://github.com/zowe/vscode-extension-for-zowe/issues/2060)
- Added two new options to download a single spool file from a Job in plain text or in binary format. [#2060](https://github.com/zowe/vscode-extension-for-zowe/issues/2060)
- Added the option for secure credential storage to be enable in Theia environment.

### Bug fixes

- Fixed issue with silent failures when uploading members into a data set. [#2167](https://github.com/zowe/vscode-extension-for-zowe/issues/2167)
- Fixed an issue where VSCode did not provide all context menu options for a profile node after a multi-select operation. [#2108](https://github.com/zowe/vscode-extension-for-zowe/pull/2108)
- Fixed an issue where the "Paste" option is shown for a multi-select operation in the "Data Sets" view.
- Fixed a z/OSMF issue for Data Sets and Jobs with special characters in the names. [#2175](https://github.com/zowe/vscode-extension-for-zowe/issues/2175)
- Fixed redundant text in error messages that included the same error details twice.
- Fixed issue where a spool file would open a duplicate tab when clicked between updates. [#1952](https://github.com/zowe/vscode-extension-for-zowe/issues/1952)
- Fixed issue where a job search query would not expand the session node after it has been filtered.
- Fixed error message when no data sets found that match pattern.
- Fixed secure credential storage not possible to enable in Theia.

## `2.7.0`

### New features and enhancements

- Added Job search query label to the session in the Jobs tree. [#2062](https://github.com/zowe/vscode-extension-for-zowe/pull/2064)
- Added feature to copy datasets (pds, sequential, members across pds) with multi-select capabilities. [#1150](https://github.com/zowe/vscode-extension-for-zowe/issues/1550)

### Bug fixes

- Fixed issue where job search queries were not working properly when favorited. [#2122](https://github.com/zowe/vscode-extension-for-zowe/issues/2122)
- Fixed issues where document changes may fail to upload if the environment has a slow filesystem or mainframe connection, or when VS Code exits during an upload operation. [#1948](https://github.com/zowe/vscode-extension-for-zowe/issues/1948)
- Fixed custom credential manager in `~/.zowe/settings/imperative.json` file being overwritten with invalid JSON. [#2187](https://github.com/zowe/vscode-extension-for-zowe/issues/2187)
- Fixed several linter errors throughout the codebase and consolidated linter rules. [#2184](https://github.com/zowe/vscode-extension-for-zowe/issues/2184)

## `2.6.2`

### Bug fixes

- Updated dependencies for security audits.

## `2.6.1`

### Bug fixes

- Removed excess pop-ups when listing/opening USS files, and replaced required pop-ups with status bar items to improve UX. [#2091](https://github.com/zowe/vscode-extension-for-zowe/issues/2091)
- Prevented creation of duplicate session after executing a favorited search query. [#1029](https://github.com/zowe/vscode-extension-for-zowe/issues/1029)
- Resolved an issue where VS Code did not provide all context menu options for a profile node after a multi-select operation. [#2108](https://github.com/zowe/vscode-extension-for-zowe/pull/2108)
- Fixed issue with standardization of old v1 settings in Zowe Explorer during activation. [#1520](https://github.com/zowe/vscode-extension-for-zowe/issues/1520)
- Fixed bug where a JSON error occurs for job nodes when collapsing or expanding with a single click. [#2121](https://github.com/zowe/vscode-extension-for-zowe/issues/2121)
- Fixed possible data loss when file is saved but fails to upload and VS Code does not detect unsaved changes. [#2099](https://github.com/zowe/vscode-extension-for-zowe/issues/2099)

## `2.6.0`

### New features and enhancements

- Added Job search prefix validator [1971](https://github.com/zowe/vscode-extension-for-zowe/issues/1971)
- Added file association for `zowe.config.json` and `zowe.config.user.json` to automatically detect them as JSON with Comments. [#1997](https://github.com/zowe/vscode-extension-for-zowe/issues/1997)
- Added the ability to list all datasets, even those with Imperative Errors. [#235](https://github.com/zowe/vscode-extension-for-zowe/issues/235) & [#2036](https://github.com/zowe/vscode-extension-for-zowe/issues/2036)
- Added favorite job query to jobs view. [#1947](https://github.com/zowe/vscode-extension-for-zowe/issues/1947)
- Added confirmation message for "Submit Job" feature as an option in extension settings (set to "All jobs" by default). [#998](https://github.com/zowe/vscode-extension-for-zowe/issues/998)
- Updated UI/UX method calls to use standalone `Gui` module for better usability and maintainability. [#1967](https://github.com/zowe/vscode-extension-for-zowe/issues/1967)
- Updated error dialog when Zowe config is invalid, with option to "Show Config" within VS Code for diagnostics. [#1986](https://github.com/zowe/vscode-extension-for-zowe/issues/1986)
- Added support for pasting at top-level of USS tree (if filtered), and optimized copy/paste operations to avoid using local paths when possible. [#2041](https://github.com/zowe/vscode-extension-for-zowe/issues/2041)

### Bug fixes

- Updated check for Theia environment to reduce false positives in different environments. [#2079](https://github.com/zowe/vscode-extension-for-zowe/issues/2079)
- Fixed issue where responseTimeout (in Zowe config) was not provided for supported API calls. [#1907](https://github.com/zowe/vscode-extension-for-zowe/issues/1907)
- Fixed issue where "Show Attributes" feature used conflicting colors with light VS Code themes. [#2048](https://github.com/zowe/vscode-extension-for-zowe/issues/2048)
- Fixed settings not persisting in Theia versions >=1.29.0. [#2065](https://github.com/zowe/vscode-extension-for-zowe/pull/2065)
- Removed TSLint (as it is deprecated), and replaced all TSLint rules with their ESLint equivalents. [#2030](https://github.com/zowe/vscode-extension-for-zowe/issues/2030)
- Fixed issue with a success message being returned along with error for Job deletion. [#2075](https://github.com/zowe/vscode-extension-for-zowe/issues/2075)
- Removed extra files from the VSIX bundle to reduce download size by 64%. [#2042](https://github.com/zowe/vscode-extension-for-zowe/pull/2042)
- Surfaced any errors from a dataset Recall/Migrate operation. [#2032](https://github.com/zowe/vscode-extension-for-zowe/issues/2032)
- Re-implemented regular dataset API call if the dataSetsMatching does not exist. [#2084](https://github.com/zowe/vscode-extension-for-zowe/issues/2084)

## `2.5.0`

### New features and enhancements

- Added ability to filter jobs by status. Improved Job filtering User experience. [#1925](https://github.com/zowe/vscode-extension-for-zowe/issues/1925)
- Added option to view PDS member attributes, and updated formatting for attributes webview. [#1577](https://github.com/zowe/vscode-extension-for-zowe/issues/1577)
- Streamlined attribute viewing options into one feature - "Show Attributes".
- Added multiple select copy/paste feature on uss view [#1549](https://github.com/zowe/vscode-extension-for-zowe/issues/1549)
- Added multiple select for hide session [#1555](https://github.com/zowe/vscode-extension-for-zowe/issues/1555)

### Bug fixes

- Fixed missing localization for certain VScode error/info/warning messages. [#1722](https://github.com/zowe/vscode-extension-for-zowe/issues/1722)
- Fixed "Allocate Like" error that prevented proper execution. [#1973](https://github.com/zowe/vscode-extension-for-zowe/issues/1973)
- Fixed de-sync issue between Data Set and Favorites panels when adding or deleting datasets/members that were favorited. [#1488](https://github.com/zowe/vscode-extension-for-zowe/issues/1488)
- Added logging in places where errors were being caught and ignored.
- Fixed issue where parent in Jobs list closes after single/multiple job deletion. [#1676](https://github.com/zowe/vscode-extension-for-zowe/issues/1676)

## `2.4.1`

### Bug fixes

- Bugfix: Added validation check while creating, renaming and using allocate alike feature for datasets [#1849](https://github.com/zowe/vscode-extension-for-zowe/issues/1849)
- Fixed login/logout errors from Team config file watcher. [#1924](https://github.com/zowe/vscode-extension-for-zowe/issues/1924)
- Fixed the loading of previously saved profiles in the tree views.
- Fixed default zosmf profile being added to tree view when no previous sessions have been added. [#1992](https://github.com/zowe/vscode-extension-for-zowe/issues/1992)
- Fixed the `Secure Credentials Enabled` setting to update the `~/.zowe/settings/imperative.json` file upon change of the setting without overwriting preexisting data in the file.
- Fixed errors encountered from not having Zowe CLI installed by creating the `~/.zowe/settings/imperative.json` file during activation if it doesn't already exist. This file is for Zowe Explorer to know the Security Credential Manager used for secure profile information and removes the Zowe CLI installation prerequisite. [#1850](https://github.com/zowe/vscode-extension-for-zowe/issues/1850)
- Fixed Zowe Explorer failing to activate in environment with empty workspace. [#1994](https://github.com/zowe/vscode-extension-for-zowe/issues/1994)

## `2.4.0`

### New features and enhancements

- Added check for existing team configuration file in location during create, prompting user to continue with the create action. [#1923](https://github.com/zowe/vscode-extension-for-zowe/issues/1923)
- Added a solution to allow Zowe Explorer extensions with a dependency on Zowe Explorer to work as web extension without Zowe Explorer functionality in vscode.dev. [#1953](https://github.com/zowe/vscode-extension-for-zowe/issues/1953)
- Added a new setting `Secure Credentials Enabled`, default value is selected for security and will have to be unselected to allow creation of team configuration files without default secure arrays to support environments that don't have access to Zowe CLI's Secure Credential Management.

### Bug fixes

- Fixed activation and Refresh Extension issues in web based editors, ie. Theia. [#1807](https://github.com/zowe/vscode-extension-for-zowe/issues/1807)
- Fix refresh job & spool file pull from mainframe doesn't update job status [#1936](https://github.com/zowe/vscode-extension-for-zowe/pull/1936)
- Fix for serial saving of data sets and files to avoid conflict error. [#1868](https://github.com/zowe/vscode-extension-for-zowe/issues/1868)

## `2.3.0`

### New features and enhancements

- Added option to edit team configuration file via the + button for easy access. [#1896](https://github.com/zowe/vscode-extension-for-zowe/issues/1896)
- Added multiple selection to manage context menu of Datasets, USS, and Jobs views. [#1428](https://github.com/zowe/vscode-extension-for-zowe/issues/1428)
- Added Spool file attribute information to a hover over the Spool file's name. [#1832](https://github.com/zowe/vscode-extension-for-zowe/issues/1832)
- Added support for CLI home directory environment variable in Team Config file watcher, and support watching Team Config files named zowe.config.json and zowe.config.user.json at both locations. [#1913](https://github.com/zowe/vscode-extension-for-zowe/issues/1913)
- Update to Job's View Spool file label to display PROCSTEP if available, if PROCSTEP isn't available the label will display the Spool file's record count. [#1889](https://github.com/zowe/vscode-extension-for-zowe/issues/1889) [#1832](https://github.com/zowe/vscode-extension-for-zowe/issues/1832)

### Bug fixes

- Fixed extension being slow to load large team config files. [#1911](https://github.com/zowe/vscode-extension-for-zowe/issues/1911)
- Fixed issue with cached profile information after updates to profiles. [#1915](https://github.com/zowe/vscode-extension-for-zowe/issues/1915)
- Fixed issue with saving credentials to v1 profile's yaml file when un-secure and save is selected after credential prompting. [#1886](https://github.com/zowe/vscode-extension-for-zowe/issues/1886)
- Fixed issue with outdated cached information after Update Credentials. [#1858](https://github.com/zowe/vscode-extension-for-zowe/issues/1858)
- Fixed issue with support for ZOWE_CLI_HOME environment variable. [#1747](https://github.com/zowe/vscode-extension-for-zowe/issues/1747)

## `2.2.1`

- Bugfix: Fixed activation failure when error reading team configuration file. [#1876](https://github.com/zowe/vscode-extension-for-zowe/issues/1876)
- Bugfix: Fixed Profile IO errors by refactoring use of Imperative's CliProfileManager. [#1851](https://github.com/zowe/vscode-extension-for-zowe/issues/1851)
- Bugfix: Fixed runtime error found in initForZowe call used by extenders. [#1872](https://github.com/zowe/vscode-extension-for-zowe/issues/1872)
- Bugfix: Added error notification for users when OS case sensitivitiy is not set up to avoid issues found with USS files in single directory of same name but different case. [#1484](https://github.com/zowe/vscode-extension-for-zowe/issues/1484)
- Bugfix: Added file watcher for team configuration files to fix v2 profile update issues experienced during creation, updating, and deletion of global or project level configuration files in VS Code. [#1760](https://github.com/zowe/vscode-extension-for-zowe/issues/1760)
- Bugfix: Updated dependencies for improved security. [#1878](https://github.com/zowe/vscode-extension-for-zowe/pull/1878)

## `2.2.0`

- Optimized saving of files on DS/USS when utilizing autosave or experiencing slow upload speeds.
- Updates to use new Zowe Explorer APIs `ZoweVsCodeExtension.updateCredentials` for credential prompting and `ProfilesCache.updateProfilesArrays` for profiles that don't store credentials locally in profile file.

## `2.1.0`

- Added: `Pull from Mainframe` option added for JES spool files. [#1837](https://github.com/zowe/vscode-extension-for-zowe/pull/1837)
- Added: Updated Licenses. [#1841](https://github.com/zowe/vscode-extension-for-zowe/issues/1841)
- Bugfix: Updated imports to use the imperative instance provided by the CLI package. [#1842](https://github.com/zowe/vscode-extension-for-zowe/issues/1842)
- Bugfix: Fixed unwanted requests made by tree node when closing folder. [#754](https://github.com/zowe/vscode-extension-for-zowe/issues/754)
- Bugfix: Fix for credentials not being updated after the invalid credentials error is displayed. [#1799](https://github.com/zowe/vscode-extension-for-zowe/issues/1799)
- Bugfix: Fixed hyperlink for Job submitted when profile is not already in JOBS view. [#1751](https://github.com/zowe/vscode-extension-for-zowe/issues/1751)
- Bugfix: Fixed keybindings for `Refresh Zowe Explorer` to not override default VSC keybinding. See [README.md](https://github.com/zowe/vscode-extension-for-zowe/blob/main/packages/zowe-explorer/README.md#keyboard-shortcuts) for new keybindings. [#1826](https://github.com/zowe/vscode-extension-for-zowe/issues/1826)
- Bugfix: Fixed `Update Profile` issue for missing non-secure credentials. [#1804](https://github.com/zowe/vscode-extension-for-zowe/issues/1804)
- Bugfix: Fixed errors when operation cancelled during credential prompt. [#1827](https://github.com/zowe/vscode-extension-for-zowe/issues/1827)
- Bugfix: Login and Logout operations no longer require a restart of Zowe Explorer or VSC. [#1750](https://github.com/zowe/vscode-extension-for-zowe/issues/1750)
- Bugfix: Fix for Login token always being stored in plain text. [#1840](https://github.com/zowe/vscode-extension-for-zowe/issues/1840)
- Bugfix: Fixed Theia tests. [#1665](https://github.com/zowe/vscode-extension-for-zowe/issues/1665)

## `2.0.3`

- Bugfix: Fixed Quick-key Delete in USS and Jobs trees. [#1821](https://github.com/zowe/vscode-extension-for-zowe/pull/1821)
- Bugfix: Fixed issue with Zowe Explorer crashing during initialization due to Zowe config file errors. [#1822](https://github.com/zowe/vscode-extension-for-zowe/pull/1822)
- Bugfix: Fixed issue where Spool files failed to open when credentials were not stored in a profile. [#1823](https://github.com/zowe/vscode-extension-for-zowe/pull/1823)
- Bugfix: Fixed extra space in the Invalid Credentials dialog, at profile validation profilename. [#1824](https://github.com/zowe/vscode-extension-for-zowe/pull/1824)
- Bugfix: Updated dependencies for improved security. [#1819](https://github.com/zowe/vscode-extension-for-zowe/pull/1819)

## `2.0.2`

- Bugfix: Fixed USS search filter fails on credential-less profiles. [#1811](https://github.com/zowe/vscode-extension-for-zowe/pull/1811)
- Bugfix: Fixed Zowe Explorer recognizing environment variable ZOWE_CLI_HOME. [#1803](https://github.com/zowe/vscode-extension-for-zowe/pull/1803)
- Bugfix: Fixed Zowe Explorer prompting for TSO Account number when saved in config file's TSO profile. [#1801](https://github.com/zowe/vscode-extension-for-zowe/pull/1801)

## `2.0.1`

- BugFix: Improved logging information to help diagnose Team Profile issues. [#1776](https://github.com/zowe/vscode-extension-for-zowe/pull/1776)
- BugFix: Fixed adding profiles to the tree view on Theia. [#1774](https://github.com/zowe/vscode-extension-for-zowe/issues/1774)
- BugFix: Updated Log4js version to resolve initialization problem on Eclipse Che. [#1692](https://github.com/zowe/vscode-extension-for-zowe/issues/1692)
- BugFix: Fixed dataset upload issue by trimming labels. [#1789](https://github.com/zowe/vscode-extension-for-zowe/issues/1789)
- BugFix: Fixed duplicate jobs appearing in the jobs view upon making an owner/prefix filter search for extenders. [#1780](https://github.com/zowe/vscode-extension-for-zowe/pull/1780)
- BugFix: Fixed error displayed when opening a job file for extenders. [#1701](https://github.com/zowe/vscode-extension-for-zowe/pull/1701)

## `2.0.0`

- Major: Introduced Team Profiles and more. See the prerelease items (if any) below for more details.

## 2.0.0-next.202204202000

- Updated Imperative to gather information from the corresponding base profile. [#1757](https://github.com/zowe/vscode-extension-for-zowe/pull/1757)
- Fixed issue when first Team Config profile management file is created. [#1754](https://github.com/zowe/vscode-extension-for-zowe/pull/1754)
- Fixed `Failed to find property user` on load or refresh. [#1757](https://github.com/zowe/vscode-extension-for-zowe/pull/1757)
- Fixed getting credentials from the wrong base profile. [#1757](https://github.com/zowe/vscode-extension-for-zowe/pull/1757)
- Fixed writing tokens to the wrong base profile. [#1757](https://github.com/zowe/vscode-extension-for-zowe/pull/1757)
- Fixed Windows not being able to share Tokens between CLI and ZE. [#1757](https://github.com/zowe/vscode-extension-for-zowe/pull/1757)
- Fixed Login info written to global file if proifle name is the same as project level profile. [#1761](https://github.com/zowe/vscode-extension-for-zowe/pull/1761)

## 2.0.0-next.202204180940

- Refactored the PRofilesCache to reduce maintenance efforts going forward. [#1715](https://github.com/zowe/vscode-extension-for-zowe/issues/1715)
- Updated CLI to consume security related fixes and more. [#1740](https://github.com/zowe/vscode-extension-for-zowe/pull/1740)
- Added differentiation between project and global level profiles. [#1727](https://github.com/zowe/vscode-extension-for-zowe/issues/1727)
- Removed the Secure Credential setting. [#1739](https://github.com/zowe/vscode-extension-for-zowe/issues/1739), [#722](https://github.com/zowe/vscode-extension-for-zowe/issues/722), [#820](https://github.com/zowe/vscode-extension-for-zowe/issues/820), and [#1223](https://github.com/zowe/vscode-extension-for-zowe/issues/1223)
- Synchronized the ZE preferred Security service with the CLI. [#1736](https://github.com/zowe/vscode-extension-for-zowe/issues/1736)
- Fixed APIML token not working between clients (ZE and CLI). [#1713](https://github.com/zowe/vscode-extension-for-zowe/issues/1713)

## 2.0.0-next.202204081040

- Fixed TSO commands in when using teamConfig. [#1731](https://github.com/zowe/vscode-extension-for-zowe/pull/1731)
- Fixed `Zowe Explorer: Refresh Zowe Explorer` command palette option. [1735](https://github.com/zowe/vscode-extension-for-zowe/pull/1735)

## 2.0.0-next.202204041200

- Added Secure Credential support, allowing users to update credentials using GUI. [#1699](https://github.com/zowe/vscode-extension-for-zowe/pull/1693)
- Update Zowe Explorer 2.0 settings migration. [1714](https://github.com/zowe/vscode-extension-for-zowe/pull/1714)
- Update Zowe Explorer SSO logout check for extenders. [#1711](https://github.com/zowe/vscode-extension-for-zowe/pull/1711)
- Update Zowe SDK dependency. [#1699](https://github.com/zowe/vscode-extension-for-zowe/pull/1693)
- Updated dependencies for improved security. [#1702](https://github.com/zowe/vscode-extension-for-zowe/pull/1702)

## `v2.0.0-next.202202281000`

- Update Zowe CLI SDK to version 7.0.0-next.202202242016.
- Fixed the bug that overwrites like-named profiles in a nested config.

## `v2.0.0-next.202202221200`

- Added extender's type info to config schema during config file creation and removed Zowe CLI installation dependency. [#1629](https://github.com/zowe/vscode-extension-for-zowe/pull/1629)
- Added support for Login and Logout using the config file. [#1637](https://github.com/zowe/vscode-extension-for-zowe/pull/1637)
- Added capability to refresh Zowe Explorer updating the Views to reflect different profile handling to include the config file. [#1650](https://github.com/zowe/vscode-extension-for-zowe/pull/1650)
- Updated Zowe SDK dependency. [#1624](https://github.com/zowe/vscode-extension-for-zowe/pull/1624)

## `1.22.0`

- Added: Extensible Login and Logout capabilities for Zowe extenders to utilize for token based authentication. [#1606](https://github.com/zowe/vscode-extension-for-zowe/pull/1606) and [#1255](https://github.com/zowe/vscode-extension-for-zowe/issues/1255).
- Added: Eclipse Public License file. Users can view the license file in the root directory of the Zowe Explorer repository [#1626](https://github.com/zowe/vscode-extension-for-zowe/pull/1626).
- Updated: Supported Node.js version was changed to v12 or higher. We no longer support running the product on earlier versions (10.x and earlier) of Node.js [#1640](https://github.com/zowe/vscode-extension-for-zowe/pull/1640).
- Updated: Security updates for `copy-props`, `nanoid`, and `markdown-it` dependencies were changed to improve security alerting [#1638](https://github.com/zowe/vscode-extension-for-zowe/pull/1638), [#1636](https://github.com/zowe/vscode-extension-for-zowe/pull/1636), and [#1649](https://github.com/zowe/vscode-extension-for-zowe/pull/1649).
- Updated: A work around was developed to help developers debug Zowe Explorer VS Code extension on Theia. For more information, see **Work around for debugging in Theia** [#1576](https://github.com/zowe/vscode-extension-for-zowe/pull/1576).
- Fixed: The Zowe Explorer deployment script was updated to use vsce (Visual Studio Code Extension Manager) version 1.103.1 to help ensure that it is compatible with Node v12 [#1608](https://github.com/zowe/vscode-extension-for-zowe/pull/1608).
- Fixed: Fixed the Theia input box issue that caused entered values to be validated incorrectly [#1580](https://github.com/zowe/vscode-extension-for-zowe/pull/1580).

## `1.21.0`

- Add a progress bar for the simultaneous deletion of multiple jobs [#1583](https://github.com/zowe/vscode-extension-for-zowe/pull/1583). Thanks @uzuko01
- Added the note about the deprecation of the associate profile feature to the Associate Profile section of Zowe Docs and to the Zowe Explorer Readme [#1575](https://github.com/zowe/vscode-extension-for-zowe/pull/1575). Thanks @IgorCATech
- Changed the `DataSet uploaded successfully` message type. Now messages are shown in the status bar instead of the notification pop-up [#1542](https://github.com/zowe/vscode-extension-for-zowe/pull/1542). Thanks @anokhikastiaIBM
- Updated dependencies for improved security [#1591](https://github.com/zowe/vscode-extension-for-zowe/pull/1591) and [#1601](https://github.com/zowe/vscode-extension-for-zowe/pull/1601). Thanks @lauren-li
- Updated Theia tests to use the latest Theia version [#1566](https://github.com/zowe/vscode-extension-for-zowe/pull/1566). Thanks @JillieBeanSim
- Fixed the issue that caused JCL errors in the JOBS tree to be displayed as `undefined:undefined(undefined)` [#1584](https://github.com/zowe/vscode-extension-for-zowe/pull/1584). Thanks @roman-kupriyanov
- Fixed the Theia input box issue that caused entered values to be incorrectly validated [#1580](https://github.com/zowe/vscode-extension-for-zowe/pull/1580). Thanks @JillieBeanSim
- Fixed the issue that caused the removal of unsaved credentials of a profile in the Jobs tree after deleting a job. Now when you delete a job from the Jobs tree with a profile that does not have the stored credentials, the profile keeps the cached credentials [#1524](https://github.com/zowe/vscode-extension-for-zowe/pull/1524). Thanks @nickImbirev

## `1.20.0`

- Added a Github action bot that automates the issue triage [#1530](https://github.com/zowe/vscode-extension-for-zowe/pull/1530). Thanks @crawr
- Updated the @zowe/cli version to 6.33.3 to fix the SSH2 audit failure [#1522](https://github.com/zowe/vscode-extension-for-zowe/pull/1522). Thanks @JillieBeanSim
- Updated the Jobs Issue Stop and Issue Modify commands so that they can be consumed by Extenders with the `issueMvsCommand` API [#1508](https://github.com/zowe/vscode-extension-for-zowe/pull/1508). Thanks @JillieBeanSim
- Use Visual Studio Code's standard confirmation prompt for the Data Sets, USS, and Job trees when clicking on a Favorited profile that does not exist [#1506](https://github.com/zowe/vscode-extension-for-zowe/pull/1506). Thanks @JillieBeanSim
- Updated the deletion prompt for the USS and Jobs trees [#1505](https://github.com/zowe/vscode-extension-for-zowe/pull/1505). Thanks @JillieBeanSim
- Updated the placeholder text in the `Add Profile` entry field [#1490](https://github.com/zowe/vscode-extension-for-zowe/pull/1490). Thanks @anokhikastiaIBM
- Fixed the Not Found issue that resulted from attempts to delete a member whose parent data set was already deleted using multi-delete [#1525](https://github.com/zowe/vscode-extension-for-zowe/pull/1525). Thanks @JillieBeanSim

## `1.19.0`

- Added a check to ensure that a base profile exists before running the function that combines base and service profiles [#1500](https://github.com/zowe/vscode-extension-for-zowe/pull/1500). Thanks @lauren-li
- Added Imperative logger access for extenders [#1433](https://github.com/zowe/vscode-extension-for-zowe/pull/1433). Thanks @katelynienaber
- Added documentation for Imperative logger for extenders [#1467](https://github.com/zowe/vscode-extension-for-zowe/pull/1467). Thanks @katelynienaber
- Implemented separate console windows for TSO and MVS commands [#1478](https://github.com/zowe/vscode-extension-for-zowe/pull/1478). Thanks @katelynienaber
- Fixed the bug that caused the check credentials pop-up to disappear too quickly [#1486](https://github.com/zowe/vscode-extension-for-zowe/pull/1486). Thanks @JillieBeanSim
- Fixed the bug that kept the command text box while escaping the process of entering a TSO command. Now the command text box does not pop up if you cancel entering a TSO command [#1479](https://github.com/zowe/vscode-extension-for-zowe/pull/1479). Thanks @katelynienaber
- Fixed the bug that caused issues with deleting data set members in Ecplipse Theia or Che [#1487](https://github.com/zowe/vscode-extension-for-zowe/pull/1478). Thanks @phaumer
- Fixed the bug that caused the deletion of selected data sets while removing a single data set member by using the right-click action. [#1483](https://github.com/zowe/vscode-extension-for-zowe/pull/1483). Thanks @JillieBeanSim

## `1.18.0`

- Added the ability to register custom profile types in `ProfilesCache` for extenders [#1419](https://github.com/zowe/vscode-extension-for-zowe/pull/1419). Thanks @phaumer
- Added the ability to pass account and other information from tso profile [#1378](https://github.com/zowe/vscode-extension-for-zowe/pull/1378). Thanks @fswarbrick
- Added profiles cache to extenders [#1390](https://github.com/zowe/vscode-extension-for-zowe/pull/1390). Thanks @phaumer
- Status icons now reset when refreshing the explorer views [#1404](https://github.com/zowe/vscode-extension-for-zowe/pull/1404). Thanks @lauren-li
- Fixed the issue that prevented the expected error message `No valid value for z/OS URL. Operation Cancelled` from being displayed while escaping the host text box during the creation or update of a profile [#1426](https://github.com/zowe/vscode-extension-for-zowe/pull/1426). Thanks @JillieBeanSim
- Fixed the issue that invoked profile validation before updating a profile. Now a profile is validated only after the update [#1415](https://github.com/zowe/vscode-extension-for-zowe/pull/1415). Thanks @JillieBeanSim
- Fixed the issue of Zowe profiles encoding value when opening a USS file in the text editor [#1400](https://github.com/zowe/vscode-extension-for-zowe/pull/1400). Thanks @JillieBeanSim

## `1.17.0`

- Added the feature that automatically includes a missing profile in the Jobs view when submitting a job [#1386](https://github.com/zowe/vscode-extension-for-zowe/pull/1386). Thanks @nickImbirev
- Added the extender documentation for KeytarApi for Secure Credential Store [#1384](https://github.com/zowe/vscode-extension-for-zowe/pull/1384). Thanks @JillieBeanSim
- Added a new setting that enables you to hide Zowe Explorer's temporary downloads folder from a workspace [#1373](https://github.com/zowe/vscode-extension-for-zowe/pull/1373). Thanks @crawr
- Added the command to refresh a particular job and get the latest information and content for its spool files [#1363](https://github.com/zowe/vscode-extension-for-zowe/pull/1363). Thanks @nickImbirev
- Added the function that enables you to delete multiple datasets and data set members [#1323](https://github.com/zowe/vscode-extension-for-zowe/pull/1323). Thanks @katelynienaber
- Added the feature that enables you to use multiple VS Code windows for files opened via Zowe Explorer [#1347](https://github.com/zowe/vscode-extension-for-zowe/pull/1347). Thanks @JillieBeanSim
- Added the command to refresh USS directory file names without the entire tree collapsing [#1369](https://github.com/zowe/vscode-extension-for-zowe/pull/1369). Thanks @rudyflores
- Removed non-functioning code from invalid credentials for Theia [#1371](https://github.com/zowe/vscode-extension-for-zowe/pull/1371). Thanks @lauren-li
- Fixed the issue with USS Search and Update Profile errors for profiles without credentials [#1391](https://github.com/zowe/vscode-extension-for-zowe/pull/1391). Thanks @lauren-li

## `1.16.0`

- Added the refresh data set member names option. You can now retrieve a new list of members from the mainframe [#1343](https://github.com/zowe/vscode-extension-for-zowe/pull/1343). Thanks @rudyflores
- Added the best practice documentation for error handling [#1335](https://github.com/zowe/vscode-extension-for-zowe/pull/1335). Thanks @katelynienaber
- Added the developer guide for adding commands to core Zowe Explorer menus [#1332](https://github.com/zowe/vscode-extension-for-zowe/pull/1332). Thanks @lauren-li
- Standardized context group names [#1340](https://github.com/zowe/vscode-extension-for-zowe/pull/1340). Thanks @lauren-li
- Fixed the error message that popped up when accessing a profile from Favorites [#1344](https://github.com/zowe/vscode-extension-for-zowe/pull/1344). Thanks @rudyflores
- Fixed the issue that prevented the Allocate Like feature from working correctly [#1322](https://github.com/zowe/vscode-extension-for-zowe/pull/1322). Thanks @katelynienaber

## `1.15.1`

- Fixed the issue that required the vscode module to be imported in the API package [#1318](https://github.com/zowe/vscode-extension-for-zowe/pull/1318). Thanks @JillieBeanSim

## `1.15.0`

- Added the secure credentials support for Extenders API [#1306](https://github.com/zowe/vscode-extension-for-zowe/pull/1306). Thanks @JillieBeanSim
- Improved Zowe Explorer extenders. Zowe Explorer extenders can now utilize Extender API to have profile folder and meta file created upon initialization [#1282](https://github.com/zowe/vscode-extension-for-zowe/pull/1282). Thanks @JillieBeanSim
- Improved the Command Palette by adding "Zowe Explorer:" before all commands that are related to the extension. Removed some commands from the palette that caused issues [#1308](https://github.com/zowe/vscode-extension-for-zowe/pull/1308). Thanks @lauren-li
- Updated Theia Tests. Now you need to have Zowe CLI 6.31.0 and the latest .vsix file in the `theia/plugins` folder to run Theia tests [#1268](https://github.com/zowe/vscode-extension-for-zowe/pull/1268). Thanks @deepali-hub
- Fixed the issue that prevented the `issue STOP command` function from executing correctly [#1304](https://github.com/zowe/vscode-extension-for-zowe/pull/1304). Thanks
  @nickImbirev
- Fixed the issue that caused the Add Profile icon to disappear [#1307](https://github.com/zowe/vscode-extension-for-zowe/pull/1307). Thanks @lauren-li
- Fixed the vulnerability in NPM Audit [#1309](https://github.com/zowe/vscode-extension-for-zowe/pull/1309). Thanks @JillieBeanSim
- Fixed the issue that doubled the occurrence of the port prompt [#1298](https://github.com/zowe/vscode-extension-for-zowe/pull/1298). Thanks @katelynienaber
- Fixed the issue that triggered the `Delete Job` command even outside Zowe Explorer views [#1310](https://github.com/zowe/vscode-extension-for-zowe/pull/1310). @crawr
- Fixed the trailing slash issue that caused issues with USS search [#1313](https://github.com/zowe/vscode-extension-for-zowe/pull/1313). Thanks @katelynienaber

## `1.14.0`

- Added the Issue TSO Commands feature [#1245](https://github.com/zowe/vscode-extension-for-zowe/pull/1245). Thanks @JillieBeanSim
- Fixed the issue that caused the USS tree to collapse after renaming a folder [#1259](https://github.com/zowe/vscode-extension-for-zowe/pull/1259). Thanks @lauren-li
- Fixed the issue that prevented jobs with an octothorpe (#) in the name from opening [#1253](https://github.com/zowe/vscode-extension-for-zowe/issues/1253). Thanks @katelynienaber

## `1.13.1`

- Updated the dialog text for issuing MVS commands. Now the text of the function is `Zowe: Issue MVS Command` [#1230](https://github.com/zowe/vscode-extension-for-zowe/pull/1230). Thanks @JillieBeanSim
- Added the prompt for credentials when issuing MVS commands, using the right click action, against profiles with missing credentials [#1231](https://github.com/zowe/vscode-extension-for-zowe/pull/1231). Thanks @JillieBeanSim
- Added the Prerequisites section to the IBM z/OS FTP for Zowe Explorer ReadMe [#1246](https://github.com/zowe/vscode-extension-for-zowe/pull/1246). Thanks @lauren-li
- Added Open VSX to the deployment pipeline [#1240](https://github.com/zowe/vscode-extension-for-zowe/pull/1240). Thanks @zFernand0

## `1.13.0`

- Added the monorepo landing Readme that contains the high-level overview of the repository folders such as `packages` folder, instructions on how to contribute to the project and links to Medium articles providing additional useful information about Zowe Explorer and Zowe [#1199](https://github.com/zowe/vscode-extension-for-zowe/pull/1199). Thanks @IgorCATech
- Fixed the issue that prevented the list of recently opened files from being displayed upon request. You can access a list of recently opened files by pressing the Ctrl+Alt+R (Windows) or Command+Option+R (Mac) key combination [#1208](https://github.com/zowe/vscode-extension-for-zowe/pull/#1208). Thanks @jellypuno
- Fixed the issue that prevented file picker from functioning. The file picker feature lets you filter your datasets in the tree by pressing the Ctrl+Alt+P (Windows) or Command+Option+P (Mac) key combination [#992](https://github.com/zowe/vscode-extension-for-zowe/issues/992). Thanks @katelynienaber
- Fixed the issue that caused the content from a previously filtered USS directory instead of the currently filtered USS directory to be served [#1134](https://github.com/zowe/vscode-extension-for-zowe/issues/1134). Thanks @lauren-li
- Added the previously selected `RejectUnauthorized` value to the placeholder text of the entry field while updating an existing profile. In addition, the value is highlighted and shown at the top of the selection list [#1218](https://github.com/zowe/vscode-extension-for-zowe/pull/1218). Thanks @JillieBeanSim
- Added the pre-filled and pre-selected filename of the copied member to the entry field while performing the paste member action [#1183](https://github.com/zowe/vscode-extension-for-zowe/pull/1183). Thanks @JillieBeanSim
- Added the multiple deletion of jobs feature [#1128](https://github.com/zowe/vscode-extension-for-zowe/pull/1128). Thanks @crawr
- Improved error handling for the data set copy/paste member, migrate, and recall functions [#1219](https://github.com/zowe/vscode-extension-for-zowe/pull/1219). Thanks @tiantn

## `1.12.1`

- Fixed the issue that prevented edited profile base paths from being saved [#989](https://github.com/zowe/vscode-extension-for-zowe/issues/989). Thanks @katelynienaber
- Fixed the issue that prevented Zowe Explorer from storing empty values for optional profile fields, such as `user`, `password`, `timeout`, and `encoding`. This is done to be consistent with the way Zowe CLI stores profile information when creating and editing profiles [#1016](https://github.com/zowe/vscode-extension-for-zowe/issues/1016). Thanks @katelynienaber
- Fixed the issue that caused repeated credential prompting if a user refused to authenticate [#1147](https://github.com/zowe/vscode-extension-for-zowe/issues/1147). Thanks @katelynienaber
- Fixed the issue that caused removed favorite profiles to be favorited again in subsequent IDE sessions [#1144](https://github.com/zowe/vscode-extension-for-zowe/issues/1144). Thanks @lauren-li
- Fixed the issue that prevented updated credential prompting from occurring when a profile was marked “invalid” [#1095](https://github.com/zowe/vscode-extension-for-zowe/issues/1095). Thanks @katelynienaber

## `1.12.0`

- Added the ability to edit data set attributes before allocation [#1031](https://github.com/zowe/vscode-extension-for-zowe/issues/1031). Thanks @katelynienaber
- Allowed filtering of member names from the Data Sets search bar [#868](https://github.com/zowe/vscode-extension-for-zowe/issues/868). Thanks @JillieBeanSim
- Reorganized the context menus and streamlined the visible icons [#1052](https://github.com/zowe/vscode-extension-for-zowe/issues/1052). Thanks @katelynienaber
- Fixed the messaging displayed when handling inactive profiles and when updating profiles [#1065](https://github.com/zowe/vscode-extension-for-zowe/issues/1065) [#1096](https://github.com/zowe/vscode-extension-for-zowe/issues/1096). Thanks @jellypuno
- Fixed the issue causing tree restructure when renaming a USS file or directory [#757](https://github.com/zowe/vscode-extension-for-zowe/issues/757). Thanks @katelynienaber
- Fixed the issue preventing issuing of commands when using profiles with tokens [#1051](https://github.com/zowe/vscode-extension-for-zowe/issues/1051). Thanks @crawr
- Refactored refresh functions. Thanks @lauren-li @JillieBeanSim
- Updated FTP and API Readme documentation. Thanks @phaumer
- Added regression tests for profiles in Theia. Thanks @deepali-hub

## `1.11.1`

- Updated Keytar and Jest dev deps for Node 14. Thanks @t1m0thyj

## `1.11.0`

- Added login and logout functions for base profiles. You can now log in to API Mediation Layer and generate a token for your base profile. [#914](https://github.com/zowe/vscode-extension-for-zowe/issues/914). Thanks @crawr
- Fixed the empty profile folders in Favorites issue. [#1026](https://github.com/zowe/vscode-extension-for-zowe/issues/1026). Thanks @lauren-li
- Fixed the initialization error that occurred when base profiles were used while being logged out from API ML. [1063](https://github.com/zowe/vscode-extension-for-zowe/issues/1063). Thanks @jellypuno
- Fixed the issue preventing the tree refresh function from updating extender profiles. [1078](https://github.com/zowe/vscode-extension-for-zowe/issues/1078). Thanks @lauren-li
- Fixed the issue causing jobs retrieval failure when using profiles with tokens. [1088](https://github.com/zowe/vscode-extension-for-zowe/issues/1088). Thanks @jellypuno

## `1.10.1`

- Updated arguments to keep the order of precedence consistent between service and base profile. [#1055](https://github.com/zowe/vscode-extension-for-zowe/issues/1055). Thanks @JillieBeanSim

## `1.10.0`

- Added Base Profile support. [#1037](https://github.com/zowe/vscode-extension-for-zowe/issues/1037). Thanks @katelynienaber, @jellypuno, @JillieBeanSim, @lauren-li, @crawr, @phaumer

## `1.9.0`

- Added the Allocate Like feature. [#904](https://github.com/zowe/vscode-extension-for-zowe/issues/904). Thanks @katelynienaber
- Added the ability to disable/enable profile validation. [#922](https://github.com/zowe/vscode-extension-for-zowe/issues/922). Thanks @JillieBeanSim
- Added the ability to access other profiles during profile validation. [#953](https://github.com/zowe/vscode-extension-for-zowe/issues/953). Thanks @JillieBeanSim
- Grouped Favorites by profile for Datasets, USS, and Jobs. [#168](https://github.com/zowe/vscode-extension-for-zowe/issues/168). Thanks @lauren-li
- Fixed USS renaming issues. [#911](https://github.com/zowe/vscode-extension-for-zowe/issues/911). Thanks @katelynienaber and @lauren-li
- Fixed the deletion of datasets issue. [#963](https://github.com/zowe/vscode-extension-for-zowe/issues/963). Thanks @katelynienaber
- Once entered, datasets and members are displayed in uppercase. [#962](https://github.com/zowe/vscode-extension-for-zowe/issues/962). Thanks @AndrewTwydell and @Pranay154
- Removed errors in Favorites items caused by profiles that are created by other extensions. [#968](https://github.com/zowe/vscode-extension-for-zowe/issues/968). Thanks @lauren-li
- Updated the environment check for Theia compatibility. [#1009](https://github.com/zowe/vscode-extension-for-zowe/issues/1009). Thanks @lauren-li

## `1.8.0`

- Webpack working with localization and logging. Thanks @lauren-li
- Allow extenders to load their saved profile sessions upon their activation. Thanks @lauren-li
- Provide a re-validation for invalid profiles automatically. Thanks @JillieBeanSim
- Bug fix related to saving USS files. Thanks @JillieBeanSim.
- Bug fix related to the deletion of datasets. Thanks @katelynienaber

## `1.7.1`

- Fixed USS save operation. Thanks @JillieBeanSim
- Added validation information message. Thanks @JillieBeanSim
- Restructured Readme. Thanks @IgorCATech

## `1.7.0`

- Disallow multiple profiles with same name but different capitalizations. Thanks @katelynienaber
- Improvements for Optional Credentials. Thanks @crawr @jellypuno
- Reorganize Data Sets context menu. Thanks @katelynienaber
- Adding star icon for favorites. Thanks @katelynienaber
- Profile Validation. Thanks @jellypuno
- Updating Credentials via Check Credentials. Thanks @JillieBeanSim
- Favorites get loaded and opened into new files. Thanks @phaumer
- Improve messaging of confirmation dialogues. Thanks @crawr
- Enable editing of filters. Thanks @katelynienaber
- Update Codecov settings. Thanks @jellypuno
- Handle encoding value from z/OSMF Profiles. Thanks @dkelosky
- Enable editing of ASCII files in USS. Thanks @Colin-Stone
- Refactor unit test and add more integration tests. Thanks @katelynienaber

## `1.6.0`

- Create connections with any registered profile type. Thanks @JillieBeanSim
- Streamline first profile creation. Thanks @crawr
- Add recall options for migrated datasets. Thanks @Pranay154
- Fix persistent data after recall functionality. Thanks @katelynienaber
- Fix deleting and editing connection not considering other profile types. Thanks @phaumer
- Fix multiple prompts when escaping/canceling editing session. Thanks @jellypuno
- Fix failure to load optional secure fields from profiles. Thanks @tjohnsonBCM
- Fixed issue when manually editing/deleting associated profiles. Thanks @Colin-Stone
- Refactor unit tests. Thanks @stepanzharychevbroadcom, @katelynienaber

## `1.5.2`

- Fix undefined profile error message. Thanks @JillieBeanSim

## `1.5.1`

- Fix failure to load optional secure fields from profiles. Thanks @tjohnsonBCM
- Fix pressing Escape does not abort Edit profile dialogue. Thanks @jellypuno
- Fix editing of Credentials when setting them to spaces. Thanks @jellypuno
- Fix deletion of profiles not considering all extensibility use cases. Thanks @phaumer

## `1.5.0`

- Fixes for saving of Datasets from Favourites section. Thanks @stepanzharychevbroadcom
- Management of Theia specific merge conflict resolution. Thanks @Alexandru-Dumitru
- Add to recall when PS File opened. Thanks @katelynienaber
- Provide edit support for Profile credentials. Thanks @jellypuno
- Support for profile deletion. Thanks @crawr
- Addressed USS file merge conflict triggering issue. Thanks @Alexandru-Dumitru
- Provide refresh all method for Zowe Explorer - Extenders. Thanks @phaumer
- Extender guidelines and documentation. Thanks @Colin-Stone
- Provision of profile association links to support extenders of Zowe Explorer. Thanks @Colin-Stone
- Creation of an extender API for extenders of Zowe Explorer. Thanks @Colin-Stone
- Management of VSAM files within Dataset explorer. Thanks @Colin-Stone
- VSCode context now based on Regular expression for flexibility. Thanks @Colin-Stone
- Vsix file deployment via Theia pipeline. Thanks @crawr
- Reduction in size of extension.ts file. Thanks @katelynienaber
- ContextValue of undefined error addressed for new members. Thanks @katelynienaber
- Fixed when Pull from mainframe didn't work on USS Files. Thanks @stepanzharychevbroadcom
- Fixed Bug submitting JCL from Command Palette. Thanks @stepanzharychevbroadcom
- Refactoring of testing for accuracy and maintainability. Thanks @stepanzharychevbroadcom

## `1.4.1`

- Fix for USS files not saving correctly. Thanks @phaumer
- Icon update for migrated files only. Thanks @Colin-Stone

## `1.4.0`

- Added support for large datasets and PDS members. Thanks @jellypuno
- Fixed inconsistent behavior when renaming USS file and directories. Thanks @stepanzharychevbroadcom
- Fixed deleting a USS file. Thanks @Colin-Stone
- Fixed profiles not automatically updating values when changed externally. Thanks @jellypuno
- Fixed load error when file names had special characters. Thanks @jellypuno
- Fixed load os USS file list. Thanks @jellypuno
- Improved user experience of USS file navigation #461. Thanks @stepanzharychevbroadcom
- Fixed tab name when renaming dataset. Thanks @stepanzharychevbroadcom
- Improved performance when renaming datasets and members. Thanks @CForrest97
- Added prompting of credentials if previous credentials where entered incorrectly. Thanks @jellypuno
- Added support for VSCode Quick Open shortcut. Thanks @katelynienaber
- Added support for VSCode Open Recent Files shortcut. Thanks @katelynienaber
- Fixed USS Favorites not being remembered. Thanks @Colin-Stone
- Setup automated regression testing on a Theia environment. Thanks @crawr
- Fixed copying dataset on temporary folder #635. Thanks @Colin-Stone
- Made dataset terminology more consistent. Thanks @stepanzharychevbroadcom
- Fixed uploading files to USS. Thanks @stepanzharychevbroadcom
- Fixed searching/filtering data. Thanks @Colin-Stone
- Refactored code to include interfaces and abstract classes. Thanks @Colin-Stone
- Refactored icon retrieval process. Thanks @stepanzharychevbroadcom
- Updated Zowe Explorer video. Thanks @IgorCATech
- Revised pipeline to use shared libraries. Thanks @zFernand0

## `1.3.1`

- Updated Zowe Icon. Thanks @stepanzharychevbroadcom
- Address VSC tree expand behavior changes. Thanks @phaumer
- Refresh all action includes profiles. Thanks @jellypuno
- Consistent handling of renaming USS files. Thanks @stepanzharychevbroadcom
- Renaming datasets should update open tab. Thanks @stepanzharychevbroadcom
- USS delete function reinstated. Thanks @Colin-Stone
- Issue with uploadBinaryFile API not being correctly redirected. Thanks @Colin-Stone
- OnSave Upload trigger correction for USSFile . Thanks Alexandru-Dumitru

## `1.3.0`

- Dependency on ~/.zowe folder existing removed. Thanks @tjohnsonBCM
- Label changes for specific dataset functionality. Thanks @CForrest97
- Zowe Explorer to incorporate @zowe CLI implementation. Thanks @zFernand0
- Profiles manage other profile types apart from zosmf. Thanks @Colin-Stone
- Exploit imperative bundled keytar for secure credentials when standalone. Thanks @Colin-Stone

## `1.2.4`

- Fix to Credentials initialization to wait on promise. Thanks @Colin-Stone

## `1.2.3`

- Secure credentials backwards compatibility. Thanks @tjohnsonBCM

## `1.2.2`

- Fix requirement of ~/.zowe folder. Thanks @phaumer

## `1.2.1`

- Fix for automatic release of VSIX. Thanks @awharn
- Fixed creating data sets causes tree to lose expand behavior issue. Thanks @katelynienaber
- Fixed issue with undefined node. Thanks @Colin-Stone

## `1.2.0`

- Support CLI plugin extensibility. Thanks @phaumer
- Fixed Issue for filters after creating dataset. Thanks @phaumer
- Managing text/binary download choice. Thanks @stepanzharychevbroadcom
- Addressed 'Uploading zip file (binary)' silent failures. Thanks @stepanzharychevbroadcom
- Consistency updates for context menu. Thanks @sladyn98
- Automatically use Changelog contents in pipeline as release description. Thanks @awharn
- Provision of warning message after two failed login attempts. Thanks @jellypuno
- Consistency, added filter tip to convey ability to add multiple filters entries. Thanks @katelynienaber
- Tree view refresh when dataset member added or deleted. Thanks @katelynienaber
- Code improvement - Centralized error handling. Thanks @crawr
- Integration Script updates. Thanks @zFernand0
- Keytar (Secure credentials) compatibility support. Thanks @Colin-Stone
- Improved usability of MVS Command feature including 'Recall' function. Thanks @Colin-Stone
- Fixed issue where Job folder did not auto-expand. Thanks @Colin-Stone
- Use Progress indicator wrapper around longer running list functions. Thanks @Colin-Stone

## `1.1.0`

- Updates to Readme to include links to Theia Readme. Thanks @IgorCATech
- Fix for incorrect profile name in some favorites. Thanks @lauren-li
- Update dataset filters on dataset creation. Thanks @katelynienaber
- Include VSIX in Github release. Thanks @zFernand0
- Fix dataset delete fails silently bug. Thanks @Colin-Stone
- Fix to handle "Show Dataset Attributes" in Favorites. Thanks @katelynienaber
- Enhancements to profile creation. Thanks @jellypuno
- Theia specific QuickPick modifications. Thanks @phaumer
- Update incorrect profile message. Thanks @lauren-li
- Fix Copy and paste dataset menu duplication. Thanks @lauren-li

## `1.0.1`

- Remove duplicate commands #376. Thanks @lauren-li
- Update localization for v1.0.0 #374. Thanks @lauren-li
- Update keywords #383. @zFernand0
- Update package json files #391. @zFernand0
- Fixed adding sessions in Theia #382. Thanks @phaumer
- Add validation for undefined username and password + more cosmetic fix #378. Thanks @jellypuno
- Update incorrect profile message #387. Thanks @lauren-li

## `1.0.0`

- VSCode centric Connection settings. Thanks @crawr, @jellypuno
  - Credential prompting in profiles and favorite . Thanks @crawr, @jellypuno
- Dataset and Dataset member copy and renaming function. Thanks @CForrest97
- Theia support including documentation.
- Save improvements implementing improved Safe Save functionality as the default behavior. Thanks Alexandru-Dumitru
- Reliability and Resilience updates:
  - for default profiles
  - for deleting a dataset in use
  - testing improvements and coverage
  - rationalizing deliverables
  - performance improvements

## 0.29.0

- Provide ability to rename datasets. Thanks @CForrest97
- Fix URL parsing. @MarkAckert
- Fixed `AppSettings` error message. @jellypuno

## 0.28.0

- Provide ability to add new profiles in explorer. Thanks @crawr, @jellypuno
- Recognize migrated dataset context. Thanks @Colin-Stone
- Fix dataset delete fails silently bug. Thanks @Colin-Stone

## 0.27.0

- Name change to Zowe Explorer
- Enhancements to the History recall 'QuickPick' dialogs. Thanks @Colin-Stone
- Favorites are now sorted. Thanks @Colin-Stone

## 0.26.1

- Fix vulnerabilities related to brightside-core

## 0.26.0

- Added Persistence for profiles selection. Thanks @Colin-Stone
- Performance enhancements for Profile loading operations. Thanks @Colin-Stone
- Filter rewording. Thanks @Colin-Stone

## 0.25.0

- Add Edit to context menu for MVS and USS Tree. Thanks to Rodney-Wilson
- Restructured all search and filters dialogs to incorporate a recall/history function. Thanks @Colin-Stone
- Added Search Favorite for USS Favorites. Thanks @Colin-Stone
- Added Job and Search Favorite for Jobs. Thanks @Colin-Stone
- Provided support for specifying jobs by job id. Thanks @Colin-Stone
- Fixed issue with submitting datasets job link. Thanks @Colin-Stone
- Fixed label for Jobs Refresh All. Thanks @Colin-Stone
- Minor icon improvement to distinguish Favorites from LPAR's. Thanks @Colin-Stone
- Support copy path Thanks @lauren-li
- Progress Bar animation on opening large files. Thanks to Rodney-Wilson

## 0.24.1

- Fixed issue when saving USS files

## 0.24.0

- Updated Localization Documentation and Added Update Dictionary Script. Thanks to @evannwu20
- Show stepname or procstep alongside spool name. Thanks @crshnburn
- Add command to issue TSO command. Thanks @crshnburn
- Added icons for files and folders. Thanks to @Colin-Stone

## 0.23.2

- Fixed issue when saving datasets in Windows

## 0.23.1

- Refined dataset suffix solution by restricting to explicit names only

## 0.23.0

- Add support for localization. Thanks to @evannwu20
- Correctly determine if file is binary for saving. Thanks @crshnburn
- Fix Default profile error message with friendlier version. Thanks @lauren-li
- Context menu grouping for MVS and USS. Thanks @lauren-li
- Preference to Specify Temp Folder. Thanks to @adambattenburg
- Store local version of dataset with a suffix if appropriate to enable syntax highlighting. Thanks to @Colin-Stone

## 0.22.0

- Add ability to create directories or files on the root node. Thanks to @kristinochka
- Add ability to upload files through regular OS browse dialog on regular nodes and favorites. Thanks to @kristinochka
- Add USS File Refresh and USS Safe Save. Thanks to @adambattenburg
- Honor the file tag (binary or ascii) if not specified. Thanks to @Colin-Stone

## 0.21.0

- Added the Upload member to datasets. Thanks Kristina Mayo
- Addressed same file issue with Favorites in USS explorer. Thanks to Rodney-Wilson and Lauren-Li
- USS Favorites. Ensure file deletion synchronisation. Thanks to Rodney-Wilson and Lauren-Li

## 0.20.0

- Combined Spool files with Jobs in Jobs view. Thanks Colin Stone

## 0.19.1

- Fix error when files exist in the profiles folder (such as `.DS_Store` which is automatically generated on macOS)

## 0.19.0

- Added the rename USS files. Thanks Kristina Mayo

## 0.18.0

- Added the ability to submit JCL from physical sequential data sets

## 0.17.0

- Add Favorites to USS explorer. Thanks to Rodney-Wilson and Lauren-Li
- Add ability to obtain the raw JCL from a job on spool and resubmit. Thanks @crshnburn

## 0.16.3

- Fix behavior when the user cancels "quick pick" dialogs, including selecting profiles and deleting data sets.

## 0.16.2

- Add the stderr of the getDefaultProfile or getAllProfiles process to display in the error message to the user

## 0.16.1

- Attempt to fix an issue where saving data sets ceases to work without any error message

## 0.16.0

- Add the ability to display data set attributes by right clicking on a data set
- Add the ability to save all spool content by clicking a download icon next to the job. Thanks @crshnburn

## 0.15.1

- Add a delete session menu item for sessions in the jobs view. Thanks @crshnburn
- Prevent the delete menu item for USS files and directories appearing on the context menu for sessions. Thanks @crshnburn
- Fixed an issue where adding a profile to the USS explorer incorrectly referenced data sets

## 0.15.0

- The extension is now compatible with installations which use a secure credential management plugin for profiles in Zowe CLI

## 0.14.0

- All zowe views now part of single Zowe view container. Thanks Colin Stone

## 0.13.0

- Added the ability to list and view spool of z/OS Jobs. Thanks @crshnburn

## 0.12.0

- Added GIFs to README for USS use cases. Thanks Colin Stone
- Added the ability to toggle binary mode or text mode on USS files. Thanks @crshnburn

## 0.11.0

- Create and delete functionality for USS Files and directories added as menu items.

## 0.10.4

- Add additional log messages

## 0.10.3

- Use path.sep rather than "/".

## 0.10.2

- VSCode-USS-extension-for-zowe fixed general USS file name error. Thanks Colin Stone

## 0.10.1

- VSCode-USS-extension-for-zowe merged in. Thanks Colin Stone

## 0.9.1

- Fix documentation links in Readme. Thanks Brandon Jenkins

## 0.9.0

- Display an informational message when no data set patterns are found. Thanks @crshnburn

## 0.8.4

- Fixed an issue where the submit JCL function was looking for user profiles in the wrong directory

## 0.8.3

- Fixed an issue where labels did not correctly display the name of the Zowe CLI profile

## 0.8.2

- Fixed for compatibility with the current version of the Zowe CLI. If you are having issues retrieving user name or password using this extension, please update your zowe CLI to the latest available version, recreate your profiles, and update this extension. That should solve any issues you are having.

## 0.8.0

- Introduced capability to submit jobs from the editor. Thanks @crshnburn

## 0.7.0

- Updated for compatibility with Zowe CLI >=2.0.0. You must now have plain text profiles and Zowe CLI 2.0.0 or greater to use this extension. If you have previously created profiles, please update or recreate them with Zowe CLI.
- Log files now go to `~/.vscode/extensions/zowe.vscode-extension-for-zowe-x.x.x/logs`

## 0.6.5

- Fixed issue with platform-specific folder separator, added progress bar when saving

## 0.6.4

- Make favorites persistent after upgrading the extension

## 0.6.3

- Updates to README

## 0.6.2

- Updates to README

## 0.6.1

- Updates to README

## 0.5.0

- Initial release
