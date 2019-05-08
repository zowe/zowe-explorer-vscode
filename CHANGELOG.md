# Change Log
All notable changes to the "vscode-extension-for-zowe" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## 0.15.1
 - Add a delete session menu item for sessions in the jobs view. Thanks @crshnburn
 - Prevent the delete menu item for USS files and directories appearing on the context menu for sessions. Thanks @crshnburn
 - Fixed an issue where adding a profile to the USS explorer incorrectly referenced data sets 
## 0.15.0
 - The extension is now compatible with installations which use a secure credential management plugin
   for profiles in Zowe CLI
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
- Fixed for compatibility with the current version of the Zowe CLI. If you are having issues retrieving user name or password using this extension,
please update your zowe CLI to the latest available version, recreate your profiles, and update this extension. That should solve any issues you are having.

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
