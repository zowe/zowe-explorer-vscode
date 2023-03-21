# Change Log

All notable changes to the "vscode-extension-for-zowe" extension will be documented in this file.

## TBD Release

### New features and enhancements

### Bug fixes

- Added back fix that was accidentally removed between updates: Resolved an issue where VSCode did not provide all context menu options for a profile node after a multi-select operation. [#2108](https://github.com/zowe/vscode-extension-for-zowe/pull/2108)
- Fixed issue where "Paste" option is shown for a multi-select operation in the "Data Sets" pane.

## `2.7.0`

### New features and enhancements

- Added Job search query label to the session in the Jobs tree. [#2062](https://github.com/zowe/vscode-extension-for-zowe/pull/2064)
- Added feature to copy datasets (pds, sequential, members across pds) with multi-select capabilities. [#1150](https://github.com/zowe/vscode-extension-for-zowe/issues/1550)

### Bug fixes

- Fixed issue where job search queries were not working properly when favorited. [#2122](https://github.com/zowe/vscode-extension-for-zowe/issues/2122)
- Fixed issues where document changes may fail to upload if the environment has a slow filesystem or mainframe connection, or when VS Code exits during an upload operation. [#1948](https://github.com/zowe/vscode-extension-for-zowe/issues/1948)
- Fixed custom credential manager in `~/.zowe/settings/imperative.json` file being overwritten with invalid JSON. [#2187](https://github.com/zowe/vscode-extension-for-zowe/issues/2187)

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
