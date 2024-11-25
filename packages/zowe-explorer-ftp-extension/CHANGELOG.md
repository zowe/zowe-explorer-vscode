All notable changes to the "zowe-explorer-ftp-extension" extension will be documented in this file.

## TBD Release

### New features and enhancements

- Updated Zowe SDKs to `8.8.2` for technical currency. [#3296](https://github.com/zowe/zowe-explorer-vscode/pull/3296)

### Bug fixes

## `3.0.3`

### Bug fixes

- Fixed issue where the MVS API `putContents` function did not support PDS members when the member was not specified in the data set name. [#3305](https://github.com/zowe/zowe-explorer-vscode/issues/3305)

## `3.0.2`

## `3.0.1`

### Bug fixes

- Fixed bug where the `getContents` MVS and USS APIs failed to return whenever a local file path was provided. [#3199](https://github.com/zowe/zowe-explorer-vscode/issues/3199)

## `3.0.0`

### New features and enhancements

- Renamed extension to `IBM z/OS FTP for Zowe Explorer`. [#2990](https://github.com/zowe/zowe-explorer-vscode/issues/2990)
- Updated the FTP plug-in dependency to `3.0.0` for Zowe V3 support. [#2783](https://github.com/zowe/vscode-extension-for-zowe/pull/2783).
- Updated from `@zowe/cli` package dependency to individual Zowe `8.0.0` SDK packages for Zowe V3 support. [#2719](https://github.com/zowe/vscode-extension-for-zowe/issues/2719)
- Updated Zowe Explorer API dependency to `3.0.0` for Zowe V3 support and addressed breaking changes. Check the [list](https://github.com/zowe/zowe-explorer-vscode/wiki/v3-Changes-for-Users-and-Extenders) of APIs that were removed.
- Updated VS Code engine support to `1.79.0` and higher.
- Updated VS Code activation event to `onStartupFinished`. [#1910](https://github.com/zowe/vscode-extension-for-zowe/issues/1910)
- Removal of Zowe V1 profile support. [#2072](https://github.com/zowe/vscode-extension-for-zowe/issues/2072)
- Migrated to new package manager PNPM from Yarn.
- Migrated to webpack V5 [#2214](https://github.com/zowe/vscode-extension-for-zowe/issues/2214)
- Added `madge` dependency for support to track circular dependencies. [#2148](https://github.com/zowe/vscode-extension-for-zowe/issues/2148)
- Replaced `ts-loader` dependency with `esbuild-loader` to improve build speed for developers. [#2909](https://github.com/zowe/zowe-explorer-vscode/pull/2909)
- Added support for streams to the `getContents` and `putContents` functions (`FtpMvsApi` and `FtpUssApi` interfaces) with the following API: `uploadFromBuffer`.
- Removed pop-up notification of successful registration with Zowe Explorer and log the success message. [#2862](https://github.com/zowe/zowe-explorer-vscode/issues/2862)
- **Breaking:** updated the `FtpMvsApi.putContents` function to throw an error when an e-tag conflict is found to establish consistency with the `FtpUssApi.putContents` function which has always thrown an error for this scenario.
- **Breaking:** Removed the deprecated `FtpUssApi.putContents` function in favor of the `FtpUssApi.putContent` function.

### Bug fixes

- Changed the hashing algorithm for e-tag generation from `sha1` to `sha256` to avoid collisions. [#2890](https://github.com/zowe/zowe-explorer-vscode/pull/2890)
- Fix Windows-specific hangs when saving members that contain JCL via the FTP extension. Thanks @tiantn & @std4lqi. [#2533](https://github.com/zowe/vscode-extension-for-zowe/issues/2533)
- Removed outdated vscode-nls webpack plug-in [#2253](https://github.com/zowe/vscode-extension-for-zowe/issues/2253)
- Fixed ECONNRESET error when trying to upload or create an empty data set member. [#2350](https://github.com/zowe/vscode-extension-for-zowe/issues/2350)
- Updated Zowe SDKs to `8.8.2` for technical currency. [#3296](https://github.com/zowe/zowe-explorer-vscode/pull/3296)
- Updated additional dependencies for technical currency purposes.

## `3.0.0-next.202409251932`

### Bug fixes

- Removed popup notification of successful registration with Zowe Explorer and log the success instead. [#2862](https://github.com/zowe/zowe-explorer-vscode/issues/2862)

## `3.0.0-next.202409132122`

## `3.0.0-next.202409091409`

### Bug fixes

- Update Zowe SDKs to `8.0.0-next.202408301809` for technical currency.
- Update z/OS FTP Plug-in for Zowe CLI dependency to `3.0.0-next.202407311518`.

## `3.0.0-next.202408301858`

### New features and enhancements

- Replaced `ts-loader` with `esbuild-loader` to improve build speed for developers. [#2909](https://github.com/zowe/zowe-explorer-vscode/pull/2909)

### Bug fixes

- Changed the hashing algorithm for e-tag generation from `sha1` to `sha256` to avoid collisions. [#2890](https://github.com/zowe/zowe-explorer-vscode/pull/2890)
- Updated the FTP plugin dependency to `3.0.0-next.202403191358` for technical currency [#2783](https://github.com/zowe/vscode-extension-for-zowe/pull/2783).
- Renamed extension to `IBM z/OS FTP for Zowe Explorer`. [#2990](https://github.com/zowe/zowe-explorer-vscode/issues/2990)
- Update Zowe SDKs to `8.0.0-next.202408291544` for technical currency. [#3057](https://github.com/zowe/zowe-explorer-vscode/pull/3057)

## `3.0.0-next.202404242037`

### New features and enhancements

- Changed the type for the options parameter in the `getContents` function (`MainframeInteraction.IUss` and `MainframeInteraction.IMvs` interfaces) from `zosfiles.IDownloadOptions` to `zosfiles.IDownloadSingleOptions`. [#2207](https://github.com/zowe/zowe-explorer-vscode/issues/2207)
- Added support for streams to the `getContents` and `putContents` functions (`FtpMvsApi` and `FtpUssApi` interfaces).
- **Breaking:** updated the `FtpMvsApi.putContents` function to throw an error when an e-tag conflict is found.
  - This establishes consistency with the `FtpUssApi.putContents` function which has always thrown an error for this scenario.
- **Breaking:** Removed the deprecated `FtpUssApi.putContents` function in favor of the `FtpUssApi.putContent` function.
  - The `putContents` function was deprecated in v2 in favor of the replacement function that offers the same capabilities, as well as the feature to upload from a buffer.

### Bug fixes

- Updated the SDK dependencies to `8.0.0-next.202403041352` for technical currency [#2754](https://github.com/zowe/vscode-extension-for-zowe/pull/2754).

## `3.0.0-next.202403051607`

### New features and enhancements

- Added the following API: `uploadFromBuffer`
  - This API will be used for uploading contents in v3 instead of `putContent(s)`.
- Migrated from `@zowe/cli` package to individual Zowe SDK packages. [#2719](https://github.com/zowe/vscode-extension-for-zowe/issues/2719)

## `3.0.0-next.202402142205`

### Bug fixes

- Fix Windows-specific hangs when saving members that contain JCL via the FTP extension. Thanks @tiantn & @std4lqi. [#2533](https://github.com/zowe/vscode-extension-for-zowe/issues/2533)
- Updated dependencies for technical currency purposes.

## `3.0.0-next.202402071248`

### New features and enhancements

- Adapted to new API changes from grouping of common methods into singleton classes [#2109](https://github.com/zowe/vscode-extension-for-zowe/issues/2109)
- Migrated to webpack v5 [#2214](https://github.com/zowe/vscode-extension-for-zowe/issues/2214)

## `3.0.0-next.202401241448`

### Bug fixes

- Removed outdated vscode-nls webpack plugin [#2253](https://github.com/zowe/vscode-extension-for-zowe/issues/2253)

## `3.0.0-next.202401121747`

### Bug fixes

- Update dependencies for technical currency purposes.

## `3.0.0-next.202311171754`

## `3.0.0-next.202311171523`

### New features and enhancements

- Support VS Code engine 1.79.0 and higher.

## `3.0.0-next.202309121526`

### New features and enhancements

- Removal of support for Zowe Explorer APIs that have been removed. Check the [list](https://github.com/zowe/vscode-extension-for-zowe/tree/next/docs/early-access/v3/Extenders.md) of APIs that were removed.
- Updated activation event to `onStartupFinished`. [#1910](https://github.com/zowe/vscode-extension-for-zowe/issues/1910)
- Added `madge` script in `package.json` to track circular dependencies. [#2148](https://github.com/zowe/vscode-extension-for-zowe/issues/2148)
- Migrated to new package manager PNPM from Yarn.

### Bug fixes

- Fixed ECONNRESET error when trying to upload or create an empty data set member. [#2350](https://github.com/zowe/vscode-extension-for-zowe/issues/2350)
- Update Zowe SDKs to `8.0.0-next.202407051717` for technical currency. [#2918](https://github.com/zowe/zowe-explorer-vscode/issues/2918)

## `2.18.0`

### Bug fixes

- Renamed extension to `IBM z/OS FTP for Zowe Explorer`. [#2990](https://github.com/zowe/zowe-explorer-vscode/issues/2990)

## `2.17.0`

## `2.16.3`

## `2.16.2`

### Bug fixes

- Update dependencies for technical currency purposes.

## `2.16.1`

## `2.16.0`

### Bug fixes

- Fix issue with zFTP spool files not listing properly for active jobs. [#2832](https://github.com/zowe/zowe-explorer-vscode/issues/2832)
- Changed the hashing algorithm for e-tag generation from `sha1` to `sha256` to avoid collisions. [#2890](https://github.com/zowe/zowe-explorer-vscode/pull/2890)

## `2.15.4`

## `2.15.3`

## `2.15.2`

## `2.15.1`

## `2.15.0`

## `2.14.1`

### Bug fixes

- Fix Windows-specific hangs when saving members that contain JCL via the FTP extension. Thanks @tiantn & @std4lqi. [#2533](https://github.com/zowe/vscode-extension-for-zowe/issues/2533)
- Update transitive dependencies for technical currency.

## `2.14.0`

## `2.13.1`

### Bug fixes

- Update dependencies for technical currency purposes.

## `2.13.0`

## `2.12.2`

## `2.12.1`

### Bug fixes

- Fixed issue where temporary files for e-tag comparison were not deleted after use.
- Fixed issue where another connection attempt was made inside `putContents` (in `getContentsTag`) even though a connection was already active.

## `2.12.0`

### Bug fixes

- Fixed ECONNRESET error when trying to upload or create an empty data set member. [#2350](https://github.com/zowe/vscode-extension-for-zowe/issues/2350)

## `2.11.2`

### Bug fixes

- Update Zowe Explorer API dependency to pick up latest fixes for Zowe Secrets. [#2512](https://github.com/zowe/vscode-extension-for-zowe/issues/2512)

## `2.11.1`

## `2.11.0`

### Bug fixes

- Bump `@zowe/zowe-explorer-api` to pick up latest, including `@zowe/secrets-for-zowe-sdk` 7.18.4 to handle install errors gracefully and to allow running without MSVC redistributables.

## `2.10.0`

### New features and enhancements

- Enhance throw error in zowe ftp extension. [#2143](https://github.com/zowe/vscode-extension-for-zowe/issues/2143)
- Removed `keytar` from list of external Webpack modules. Its usage has been replaced with the `keyring` module from [`@zowe/secrets-for-zowe-sdk`](https://github.com/zowe/zowe-cli/tree/master/packages/secrets). [#2358](https://github.com/zowe/vscode-extension-for-zowe/issues/2358) [#2348](https://github.com/zowe/vscode-extension-for-zowe/issues/2348)

### Bug fixes

- Added missing `owner` and `group` attributes for the returned FTP response in `FtpUssApi.fileList`. [#2254](https://github.com/zowe/vscode-extension-for-zowe/issues/2254)

## `2.9.2`

## `2.9.1`

### Bug fixes

- Updated dependencies for security audits.

## `2.9.0`

### Bug fixes

- Fixed an issue with mismatch etag, correcting error message sent to Zowe Explorer to trigger diff editor. [#2277](https://github.com/zowe/vscode-extension-for-zowe/issues/2277)
- Renamed instances of "dataset" to "data set" for consistency across Zowe Explorer.
- Fixed an issue with prompting for credentials by correcting the 401 error when throwing an auth error. [#2334](https://github.com/zowe/vscode-extension-for-zowe/issues/2334)

## `2.8.1`

### Bug fixes

- Updated dependencies for security audits.

## `2.8.0`

### New features and enhancements

- Updated linter rules and addressed linter errors. [#2184](https://github.com/zowe/vscode-extension-for-zowe/issues/2184)
- Added support for new setting `zowe.files.logsFolder.path` that can be used to override Zowe Explorer logs folder. [#2186](https://github.com/zowe/vscode-extension-for-zowe/issues/2186)

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
