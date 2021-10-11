# Version 1 to Version 2 Changes Affecting Zowe Explorer Extenders

In the move from Zowe Explorer version 1 to version 2, several changes were implemented to make Zowe Explorer more consistent and follow best practices and standards. Some of these changes affect how Zowe Explorer extenders interact with Zowe Explorer and its API. These are listed below with guidance for how extenders can update their Zowe Explorer extensions to continue working with Zowe Explorer version 2.

## Zowe Explorer View IDs

Zowe Explorer's view IDs have been updated to improve the consistency of the formatting. The following chart shows the updated view IDs:

| View           | Version 1 View ID   | Version 2 View ID    |
| -------------- | ------------------- | -------------------- |
| Data Sets view | `zowe.explorer`     | `zowe.ds.explorer`   |
| USS view       | `zowe.uss.explorer` | `zowe.uss.explorer`  |
| Jobs view      | `zowe.jobs`         | `zowe.jobs.explorer` |

## Migration of old settings to new standardized settings in Zowe Explorer

### Overview of new standardized name settings

The following table describes the changes from old to new standardized names for Zowe Explorer configurations. These changes were made to conform to VS Code's [configuration schema](https://code.visualstudio.com/api/references/contribution-points#Configuration-schema):

| Version 1 Setting Name          | Version 2 Setting Name                     |
| ------------------------------- | ------------------------------------------ |
| `Zowe-Default-Datasets-Binary`  | `zowe.ds.default.binary`                   |
| `Zowe-Default-Datasets-C`       | `zowe.ds.default.c`                        |
| `Zowe-Default-Datasets-Classic` | `zowe.ds.default.classic`                  |
| `Zowe-Default-Datasets-PDS`     | `zowe.ds.default.pds`                      |
| `Zowe-Default-Datasets-PS`      | `zowe.ds.default.ps`                       |
| `Zowe-Temp-Folder-Location`     | `zowe.files.temporaryDownloadsFolder.path` |
| `Zowe Security: Credential Key` | `zowe.security.credentialPlugin`           |
| `Zowe Commands: History`        | `zowe.commands.history`                    |
| `Zowe Commands: Always Edit`    | `zowe.commands.alwaysEdit`                 |
| `Zowe-Automatic-Validation`     | `zowe.automaticProfileValidation`          |
| `Zowe-DS-Persistent`            | `zowe.ds.history`                          |
| `Zowe-USS-Persistent`           | `zowe.uss.history`                         |
| `Zowe-Jobs-Persistent`          | `zowe.jobs.history`                        |

### Feature Overview

- Migration of old Zowe settings is performed upon activation of the extension automatically and is run only once since the migration has no need to be performed multiple times.

- A change of scope for all history based settings have been made as well, these settings have been changed from the **window** scope to the **application** scope. The affected settings would be the following:
  - `zowe.ds.history` (Zowe-DS-Persistent)
  - `zowe.uss.history` (Zowe-USS-Persistent)
  - `zowe.jobs.history` (Zowe-Jobs-Persistent)
  - `zowe.commands.history` (Zowe Commands: History)

### What Will Happen To My Old Setting Configurations?

- The old settings will be migrated to the new settings as long as they are present in their old configuration names and were not under the default settings whether they were stored under the user, workspace, or both settings in VS Code.

### What To Do With My Old Settings?

- Upon loading up VS Code Zowe Explorer will performed an automated migration of the old user settings to the new standardized settings. After this is completed, the older settings will appear greyed out meaning they can be manually removed since they will no longer be of use.
