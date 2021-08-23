# Migration of old settings to new standardized settings in Zowe Explorer

## Feature Overview

- Migration of old Zowe settings is performed upon activation of the extension automatically and is run only once since the migration has no need to be performed multiple times.

- A change of scope for all history based settings have been made as well, these settings have been changed from the **window** scope to the **application** scope. The affected settings would be the following:
  - `zowe.ds.history` (Zowe-DS-Persistent)
  - `zowe.uss.history` (Zowe-USS-Persistent)
  - `zowe.jobs.history` (Zowe-Jobs-Persistent)
  - `zowe.commands.history` (Zowe Commands: History)

## What Will Happen To My Old Setting Configurations?

- The old settings will be migrated to the new settings as long as they are present in their old configuration names and were not under the default settings whether they were stored under the user, workspace, or both settings in VSCode.

## What To Do With My Old Settings?

- Upon loading up vscode Zowe Explorer will performed an automated migration of the old user settings to the new standardized settings. After this is completed, the older settings will appear greyed out meaning they can be manually removed since they will no longer be of use.
