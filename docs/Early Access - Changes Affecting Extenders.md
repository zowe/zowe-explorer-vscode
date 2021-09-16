# Version 1 to Version 2 Changes Affecting Zowe Explorer Extenders

In the move from Zowe Explorer version 1 to version 2, several changes were implemented to make Zowe Explorer more consistent and follow best practices and standards. Some of these changes affect how Zowe Explorer extenders interact with Zowe Explorer and its API. These are listed below with guidance for how extenders can update their Zowe Explorer extensions to continue working with Zowe Explorer version 2.

## Zowe Explorer View IDs

Zowe Explorer's view IDs have been updated to improve the consistency of the formatting. The following chart shows the updated view IDs:

| View           | Version 1 View ID   | Version 2 View ID    |
| -------------- | ------------------- | -------------------- |
| Data Sets view | `zowe.explorer`     | `zowe.ds.explorer`   |
| USS view       | `zowe.uss.explorer` | `zowe.uss.explorer`  |
| Jobs view      | `zowe.jobs`         | `zowe.jobs.explorer` |
