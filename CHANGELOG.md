# Change Log

All notable changes to the "vscode-extension-for-zowe" extension will be documented in this file.

## '1.8.0'

- Webpack working with localization and logging. Thanks @lauren-li
- Allow extenders to load their saved profile sessions upon their activation. Thanks @lauren-li
- Provide a re-validation for invalid profiles automatically. Thanks @JillieBeanSim
- Bug fix related to saving USS files. Thanks @JillieBeanSim.
- Bug fix related to the deletion of datasets. Thanks @katelynienaber

## `1.7.1`

- Fix USS save operation. Thanks @JillieBeanSim
- Add validation information message. Thanks @JillieBeanSim
- Restructure Readme. Thanks @IgorCATech

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
