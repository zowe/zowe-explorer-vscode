# Change Log

All notable changes to the "zowe-explorer-api" extension will be documented in this file.

## TBD Release

### New features and enhancements

### Bug fixes

- Fixed credentials being updated for wrong v1 profile if multiple profiles had different types but same name.

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
