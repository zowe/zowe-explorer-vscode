# Change Log

All notable changes to the "zowe-explorer-api" extension will be documented in this file.

## TBD Release

### New features and enhancements

- Added optional `getTag` function to `ZoweExplorerAPI.IUss` for getting the tag of a file on USS.
- Added new API {ZE Extender MetaData} to allow extenders to have the metadata of registered extenders to aid in team configuration file creation from a view that isn't Zowe Explorer's. [#2394](https://github.com/zowe/vscode-extension-for-zowe/issues/2394)
- Add `sort` and `filter` optional variables for storing sort/filter options alongside tree nodes. [#2420](https://github.com/zowe/vscode-extension-for-zowe/issues/2420)
- Add `stats` optional variable for storing dataset stats (such as user, modified date, etc.)
- Add option enums and types for sorting, filtering and sort direction in tree nodes. [#2420](https://github.com/zowe/vscode-extension-for-zowe/issues/2420)

### Bug fixes

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

### New features and enhancements

### Bug fixes

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
