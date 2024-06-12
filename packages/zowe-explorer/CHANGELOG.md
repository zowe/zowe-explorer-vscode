# Change Log

All notable changes to the "vscode-extension-for-zowe" extension will be documented in this file.

## TBD Release

### Bug fixes

- Update dependencies for technical currency purposes. [#2934](https://github.com/zowe/zowe-explorer-vscode/pull/2934)

## `1.22.7`

### Bug fixes

- Update dependencies for technical currency purposes.

## `1.22.6`

### Bug fixes

- Update dependencies for technical currency purposes.

## `1.22.5`

### New features and enhancements

- Replaced `keytar` dependency with `keyring` module from [`@zowe/secrets-for-zowe-sdk`](https://github.com/zowe/zowe-cli/tree/master/packages/secrets). [#2358](https://github.com/zowe/vscode-extension-for-zowe/issues/2358)

### Bug fixes

## `1.22.3`

- Updated dependencies for improved security.

## `1.22.2`

- Updated dependencies for improved security.

## `1.22.0`

### New features and enhancements

- Added: Extensible Login and Logout capabilities for Zowe extenders to utilize for token based authentication. [#1606](https://github.com/zowe/vscode-extension-for-zowe/pull/1606) and [#1255](https://github.com/zowe/vscode-extension-for-zowe/issues/1255).
- Added: Eclipse Public License file. Users can view the license file in the root directory of the Zowe Explorer repository [#1626](https://github.com/zowe/vscode-extension-for-zowe/pull/1626).
- Updated: Supported Node.js version was changed to v12 or higher. We no longer support running the product on earlier versions (10.x and earlier) of Node.js [#1640](https://github.com/zowe/vscode-extension-for-zowe/pull/1640).
- Updated: Security updates for `copy-props`, `nanoid`, and `markdown-it` dependencies were changed to improve security alerting [#1638](https://github.com/zowe/vscode-extension-for-zowe/pull/1638), [#1636](https://github.com/zowe/vscode-extension-for-zowe/pull/1636), and [#1649](https://github.com/zowe/vscode-extension-for-zowe/pull/1649).
- Updated: A work around was developed to help developers debug Zowe Explorer VS Code extension on Theia. For more information, see **Work around for debugging in Theia** [#1576](https://github.com/zowe/vscode-extension-for-zowe/pull/1576).

### Bug fixes

- The Zowe Explorer deployment script was updated to use vsce (Visual Studio Code Extension Manager) version 1.103.1 to help ensure that it is compatible with Node v12 [#1608](https://github.com/zowe/vscode-extension-for-zowe/pull/1608).
- Fixed the Theia input box issue that caused entered values to be validated incorrectly [#1580](https://github.com/zowe/vscode-extension-for-zowe/pull/1580).

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
- Added the Prerequisites section to the Zowe Explorer Extension for FTP ReadMe [#1246](https://github.com/zowe/vscode-extension-for-zowe/pull/1246). Thanks @lauren-li
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
