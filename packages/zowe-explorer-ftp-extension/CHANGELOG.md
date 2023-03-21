All notable changes to the "vscode-extension-for-zowe" extension will be documented in this file.

## TBD Release

### New features and enhancements

### Bug fixes

## `2.7.0`

### New features and enhancements

- Updated the extension to use Zowe Explorer API's newer API for uploading content to USS for compatibility with the optimizations to copy/paste actions.

## `2.6.2`

### Bug fixes

- Updated dependencies for security audits.

## `2.6.0`

### New features and enhancements

- Updated UI/UX method calls to use standalone `Gui` module for better usability and maintainability. [#1967](https://github.com/zowe/vscode-extension-for-zowe/issues/1967)
- Updated dependencies for improved security.

### Bug fixes

- Removed TSLint (as it is deprecated), and replaced all TSLint rules with their ESLint equivalents. [#2030](https://github.com/zowe/vscode-extension-for-zowe/issues/2030)
- Removed extra files from the VSIX bundle to reduce download size by 12%. [#2042](https://github.com/zowe/vscode-extension-for-zowe/pull/2042)

## `2.5.0`

### Bug fixes

- Added logging in places where errors were being caught and ignored.
- Fixed all existing ESLint errors within the API logic.

## `2.4.1`

- Updated dependencies for improved security.

## `2.4.0`

- Added support for profile file encoding used for upload and download of MVS files. [#1942](https://github.com/zowe/vscode-extension-for-zowe/issues/1942)

## `2.3.0`

### Bug fixes

- Fixed for profile properties like "rejectUnauthorized" being ignored.

## `2.0.2`

- Bugfix: Fixed eTag related issue when saving USS files. [#1813](https://github.com/zowe/vscode-extension-for-zowe/pull/1813)

## `2.0.1`

- BugFix: Fixed eTag related issue when saving USS files. [#1732](https://github.com/zowe/vscode-extension-for-zowe/issues/1732)

## `2.0.0`

- Major: Introduced Team Profiles and more. See the prerelease items (if any) below for more details.

## `1.22.1`

- BugFix: Added a warning prompt so the user is aware some content may be truncated. [#1746](https://github.com/zowe/vscode-extension-for-zowe/pull/1746)

## `1.22.0`

- Added unit tests for the MVS and JES functionality [#1632](https://github.com/zowe/vscode-extension-for-zowe/pull/1632).

## `1.21.0`

- Added unit tests for the FTP USS functionality [#1582](https://github.com/zowe/vscode-extension-for-zowe/pull/1582) and [1596](https://github.com/zowe/vscode-extension-for-zowe/pull/1596). Thanks @tiantn and @JillieBeanSim
- Standardized the user interface and log messages with severity specifications using the Zowe Explorer API logger functions [#1518](https://github.com/zowe/vscode-extension-for-zowe/pull/1518). Thanks @katelynienaber

## `1.19.0`

- Added support for the validate profile and credential features [#1443](https://github.com/zowe/vscode-extension-for-zowe/pull/1443). Thanks @tiantn

## `1.16.1`

- Removed redundant entry from the `.vscodeignore` file in order to help generate the `extension.js` file for the VS Code Marketplace release

## `1.16.0`

- Added the function that closes the connection at the end of each FTP operation

## `1.15.0`

- Removed the installation pre-requisite of @zowe/zos-ftp-for-zowe-cli for the FTP Extension for Zowe Explorer

## `1.14.0`

- Added a range of jobs functionalities with zFTP profiles, including submit job, list job by jobID, list spool files, view spool file content, download spool files, and delete job.
- Added support for listing jobs with prefix `*` and owner `*`.

## `1.13.0`

- Added a range of data set functionalities including list datasets, list dataset members, edit datasets, upload members, rename datasets, delete datasets and more. For the complete list of added functionalities, see [PR-1219](https://github.com/zowe/vscode-extension-for-zowe/pull/1219).

## `1.11.1`

- Updated USS functionality to use the new zos-ftp-for-zowe-cli API.

## `1.5.0`

- Updated to API changes in Zowe Explorer 1.5.
- No need to click Refresh anymore after activation to see the ftp profiles.

## `1.3.1`

- Updates to support Zowe Explorer 1.3.1 with Zowe CLI 6.8.2.
- Updated to use @zowe/zos-ftp-for-zowe-cli" 1.0.1
- Renamed the repo to zowe-explorer-ftp-extension to prepare donation to Zowe.

## `1.2.0`

- First version showing FTP support for USS files
