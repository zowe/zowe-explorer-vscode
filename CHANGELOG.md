# Change Log

All notable changes to the "vscode-extension-for-zowe" extension will be documented in this file.

## 0.25.0

- Add Edit to context menu for MVS and USS Tree. Thanks to Rodney-Wilson 
- Restructured all search and filters dialogs to incorporate a recall/history function. @Colin-Stone
- Added Search Favorite for USS Favorites. @Colin-Stone
- Added Job and Search Favorite for Jobs. @Colin-Stone
- Provided support for specifying jobs by job id. @Colin-Stone
- Fixed issue with submitting datasets job link. @Colin-Stone
- Fixed label for Jobs Refresh All. @Colin-Stone
- Minor icon improvement to distinguish Favorites from LPAR's. @Colin-Stone
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

- Combined Spool files with Jobs in Jobs view. Colin Stone

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
