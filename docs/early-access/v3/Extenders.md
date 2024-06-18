# Version 3.0.0 Changes Affecting Zowe Explorer Extenders

## No longer supported

- Removed support for v1 Profiles
- Updated supported VS Code engine to 1.79.0
- Drop support for Theia IDE
- Moved Data Set Templates, formerly in `zowe.ds.history` that has moved to internal storage. With the request to have data set templates shareable via workspace it will now migrate existing to `zowe.ds.templates` when other history items are moved.

## Removal of deprecated APIs from Extensibility API for Zowe Explorer

- Logger type `MessageSeverityEnum` removed in favor of `MessageSeverity`.
- `IUss.putContents` removed in favor of `IUss.putContent`.
- `IJes.getJobsByOwnerAndPrefix` removed in favor of `IJes.getJobsByParameters`.
- `ICommand.issueTsoCommand` removed in favor of `ICommand.issueTsoCommandWithParms`.
- `ZoweVsCodeExtension.showVsCodeMessage` removed in favor of `Gui.showMessage`.
- `ZoweVsCodeExtension.inputBox` removed in favor of `Gui.showInputBox`.
- `ZoweVsCodeExtension.promptCredentials` removed in favor of `ZoweVsCodeExtension.updateCredentials`.
- Changed ZoweExplorerExtender.initForZowe `profileTypeConfigurations: imperative.ICommandProfileTypeConfiguration[]` to a required argument
- Changed IApiExplorerExtenders.initForZowe `profileTypeConfigurations: imperative.ICommandProfileTypeConfiguration[]` to a required argument
- Changed `ICommon`, `IMvs`, `IUss`, `IJes` interfaces to be grouped in `MainframeInteraction` namespace.
- Renamed `WebviewOptions` interface to `GuiWebviewOptions` and moved to `GuiOptions` namespace.
- Moved `GuiMessageOptions` interface to `GuiOptions` namespace.
- Moved all types to the `Types` interface, these types include:
  - IZoweNodeType
  - IZoweUSSNodeType
  - `NodeInteraction` renamed to `ZoweNodeInteraction`
  - IApiRegisterClient
  - WebviewUris
  - FileAttributes
  - PollRequest
  - DatasetStats
  - KeytarModule
  - DataSetAllocTemplate
  - Appender
  - LogJsConfig
- Moved `MessageSeverity` enum to it's own class.
- Moved `IUrlValidator`, `IProfileValidation`, `IValidationSetting`, `ValidProfileEnum` and `EvenTypes` to `Validation` namespace.
- Moved `getZoweDir` and `getFullPath` to `FileManagement` class.
- Renamed `IUrlValidator` to `IValidationUrl`.
- Renamed `IProfileValidation` to `IValidationProfile`.
- Renamed `ValidProfileEnum` to `ValidationType`.
- Wrapped `ZosmfApiCommon`, `ZosmfUssApi`, `ZosmfMvsApi`, `ZosmfJesApi` and `ZosmfCommandApi` inside `ZoweExplorerZosmf` namespace.
- Renamed `ZosmfApiCommon` to `CommonApi`.
- Renamed `ZosmfUssApi` to `UssApi`.
- Renamed `ZosmfMvsApi` to `MvsApi`.
- Renamed `ZosmfJesApi` to `JesApi`.
- Renamed `ZosmfCommandApi` to `CommandApi`.
- Renamed `ZoweExplorerTreeApi` to `IZoweExplorerTreeApi`.
- Moved `NodeAction` enum to its own class `ZoweTreeNodeActions`.
- Renamed `NodeAction` enum to `ZoweTreeNodeActions`.
- Wrapped all content sorting related content to be contained in `Sorting` namespace, such as:
  - DataSetSortOpts
  - SortDirection
  - DatasetFilterOpts
  - DatasetFilter
  - NodeSort
  - JobSortOpts
- Renamed `files` class to `FileManagement`.
- Renamed `IPromptCredentials` into `PromptCredentials`.
- Wrapped `IPromptCredentialsCommonOptions`, `IPromptCredentialsOptions` and `IPromptUserPassOptions` in `PromptCredentialsOptions` namespace.
- Renamed `IPromptCredentialsCommonOptions` to `CommonOptions`.
- Renamed `IPromptcredentialsOptions` to `ComplexOptions`.
- Renamed `IPromptUserPassOptions` to `UserPassOptions`.
- Removed `ProfilesCache.getSchema()`, `ProfilesCache.getCliProfileManager()`, `ProfilesCache.saveProfile()` & `ProfilesCache.deleteProfileOnDisk()` v1 Profiles manipulation endpoints.
- `refreshAndReopen` function on the `IZoweTreeNode` interface - use the `reopen` function instead.
- `copyUssFile` function on the `IZoweTreeNode` interface - use the `pasteUssTree` function instead.

## Removed or renamed VS Code commands

- `zowe.jobs.zosJobsOpenSpool` - use `vscode.open` with a spool URI instead
- `zowe.ds.ZoweNode.openPS` - use `vscode.open` with a data set URI instead
- `zowe.uss.ZoweUSSNode.open` - use `vscode.open` with a USS URI instead
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

## New APIs Added

- `ICommand.issueUnixCommand` added for issuing Unix Commands
- Optional `ICommand.sshProfileRequired` API returning a boolean value for extenders that would like to use the ssh profile for issuing UNIX commands via Zowe Explorer.
- `ProfilesCache.convertV1ProfToConfig()` added for migrating v1 profiles to a global team configuration file.
- Marked `getJobsByParameters` as a required function for the `MainframeInteraction.IJes` interface.
- Added the `uploadFromBuffer` required function to the `MainframeInteraction.IMvs` and `MainframeInteraction.IUss` interfaces. This function will be used in v3 to upload contents of data sets and USS files to the mainframe.
- Added optional function `move` to the `MainframeInteraction.IUss` interface to move USS folders/files from one path to another.
- Added the `buildUniqueSpoolName` function to build spool names for Zowe resource URIs and VS Code editor tabs.
- Added the `isNodeInEditor` function to determine whether a tree node's resource URI is open in the editor.
