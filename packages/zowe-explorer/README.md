# Zowe Explorer

[![version](https://vsmarketplacebadge.apphb.com/version-short/Zowe.vscode-extension-for-zowe.png)](https://vsmarketplacebadge.apphb.com/version-short/Zowe.vscode-extension-for-zowe.png)
[![downloads](https://vsmarketplacebadge.apphb.com/downloads-short/Zowe.vscode-extension-for-zowe.png)](https://vsmarketplacebadge.apphb.com/downloads-short/Zowe.vscode-extension-for-zowe.png)
[![codecov](https://codecov.io/gh/zowe/vscode-extension-for-zowe/branch/master/graph/badge.svg)](https://codecov.io/gh/zowe/vscode-extension-for-zowe)
[![slack](https://img.shields.io/badge/chat-on%20Slack-blue)](https://slack.openmainframeproject.org/)

[Zowe Explorer](https://github.com/zowe/community#zowe-explorer) is a sub-project of Zowe, focusing on modernizing mainframe experience. [Zowe](https://www.zowe.org/) is a project hosted by the [Open Mainframe Project](https://www.openmainframeproject.org/), a [Linux Foundation](https://www.linuxfoundation.org/) project.

The Zowe Explorer extension modernizes the way developers and system administrators interact with z/OS mainframes by:

- Enabling you to create, modify, rename, copy, and upload data sets directly to a z/OS mainframe.
- Enabling you to create, modify, rename, and upload USS files directly to a z/OS mainframe.
- Providing a more streamlined way to access data sets, uss files and jobs.
- Letting you create, edit, and delete Zowe CLI `zosmf` compatible profiles.
- Letting you use the Secure Credential Store plug-in to store your credentials securely in the settings.
- Letting you leverage the API Mediation Layer token-based authentication to access z/OSMF.

More information:

- For the complete Zowe Explorer documentation, see [Zowe Docs](https://docs.zowe.org/stable/user-guide/ze-install.html).
- Join the **#zowe-explorer** channel on [Slack](https://openmainframeproject.slack.com/) to stay in touch with the Zowe community.

## Contents

- [What's new in Zowe Explorer 1.11.0](#whats-new-in-zowe-explorer-1.11.0)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Sample Use Cases](#sample-use-cases)
- [Credentials Security](#credentials-security)
- [Usage Tips](#usage-tips)
- [Extending Zowe Explorer](#extending-zowe-explorer)

## What's new in Zowe Explorer 1.11.0

New features:

- Added login and logout functions for base profiles. You can now log in to API Mediation Layer and generate a token for your base profile.

Bug Fixes:

- Fixed the empty profile folders in Favorites issue.
- Fixed the initialization error that occurred when base profiles were used while being logged out from API ML.
- Fixed the issue preventing the tree refresh function from updating extender profiles.
- Fixed the issue causing jobs retrieval failure when using profiles with tokens.

For more information, see [Changelog](https://marketplace.visualstudio.com/items/Zowe.vscode-extension-for-zowe/changelog).

## Prerequisites

- Install [Node.js](https://nodejs.org/en/download/) v8.0 or later.
- Configure TSO/E address space services, z/OS data set, file REST interface and z/OS jobs REST interface. For more information, see [z/OS Requirements](https://docs.zowe.org/stable/user-guide/systemrequirements-zosmf.html#z-os-requirements).
- Create a Zowe Explorer profile.

## Getting Started

Create a profile, review the sample use cases to familiarize yourself with the capabilities of Zowe Explorer, and you are ready to use Zowe Explorer.

### Create Profile

1. Navigate to the explorer tree.
2. Hover over **DATA SETS**, **USS**, or **JOBS**.
3. Click the **+** icon.
4. Select **Create a New Connection to z/OS**. The user name and password fields are optional before you started to use a profile.
5. Follow the instructions, and enter all required information to complete the profile creation.

![New Connection](../../docs/images/ZE-newProfiles.gif?raw=true "New Connection")
<br /><br />

You can now use all the functionalities of the extension.

### Use Base Profile and Token with Existing Profiles

Leverage existing base profiles with a token to access z/OSMF via the API Mediation Layer.

Before using the base profile functionality, ensure that you have [Zowe CLI](https://docs.zowe.org/stable/user-guide/cli-installcli.html) v1.13.0 or higher installed.

**Follow these steps:**

1. Open Zowe CLI and run the following command: `zowe auth login apiml`
2. Follow the instructions to complete the login.  
   A local base profile is created that contains your token.  
   **Note:** For more information about the process, see [Token Management](https://docs.zowe.org/stable/user-guide/cli-usingcli.html#how-token-management-works).

3. Run Zowe Explorer and click the **+** icon.

4. Select the profile you use with your base profile with the token.

   The profile appears in the tree and you can now use this profile to access z/OSMF via the API Mediation Layer.

For more information, see [Integrating with API Mediation Layer](https://docs.zowe.org/stable/user-guide/cli-usingcli.html#integrating-with-api-mediation-layer).

#### Log in to the Authentication Service

Use the Log in to the **Authentication Service** feature to regenerate a new token for your base profile.

**Follow these steps:**

1. Open Zowe Explorer.
2. Right-click your profile.
3. Select the **Log in to Authentication Service** option.

   You are prompted to enter your username and password.

The token is stored in the default base profile .yaml file.

If you do not want to store your token, you can request the server to end your session token. Use the **Log out from Authentication Service** feature to invalidate the token.

**Follow these steps:**

1. Open Zowe Explorer.
2. Right-click your profile.
3. Select the **Log out from Authentication Service** option.

Your token has been successfully invalidated.

## Sample Use Cases

Review the following use cases to understand how to work with data sets in Zowe Explorer. For the complete list of features including USS and jobs, see [Zowe Explorer Sample Use Cases](https://docs.zowe.org/stable/user-guide/ze-usage.html#sample-use-cases).

- [View data sets and use multiple filters](#view-data-sets-and-use-multiple-filters): View multiple data sets simultaneously and apply filters to show specified data sets.
- [Refresh the data set list](#refresh-the-list-of-data-sets): Refresh the list of pre-filtered data sets.
- [Rename data sets](#rename-data-sets): Rename specified data sets.
- [Copy data sets](#copy-data-sets): Copy specified data sets and members.
- [Download, edit, and upload existing PDS members](#download-edit-and-upload-existing-pds-members): You can instantly pull data sets and data set members from the mainframe, edit them, and upload back.
- [Prevent merge conflicts](#use-the-save-option-to-prevent-merge-conflicts): The save option includes a **compare** mechanism letting you resolve potential merge conflicts.
- [Create data sets and data set members](#create-a-new-pds-and-a-pds-member): Create a new data set and data set members.
- [Delete data set member and a data set](#delete-a-pds-member-and-pds): Delete a chosen data set member or an entire data set.
- [View and access multiple profiles simultaneously](#view-and-access-multiple-profiles-simultaneously): Work with data sets from multiple profiles.
- [Allocate Like](#allocate-like): Create a copy of a chosen data set with the same parameters.

### View data sets and use multiple filters

1. Navigate to the explorer tree.
2. Open the **DATA SETS** bar.
3. Hover over the profile that you want to apply the filter to.
4. Click the **magnifying glass** icon.
5. Enter a pattern you want to create a filter for.
   The data sets that match your pattern(s) are displayed in the explorer tree.

**Tip:** To provide multiple filters, separate entries with a comma. You can append or postpend any filter with an \*, which indicates wildcard searching. You cannot enter an \* as the entire pattern.

![View Data Set](../../docs/images/ZE-multiple-search.gif?raw=true "View Data Set")
<br /><br />

### Refresh the list of data sets

1. Navigate to the explorer tree.
2. Click **Refresh All** button (circular arrow icon) on the right of the **DATA SETS** explorer bar.

### Rename data sets

1. Navigate to the explorer tree.
2. Open the **DATA SETS** bar.
3. Select a data set you want to rename.
4. Right-click the data set and select the **Rename Data Set** option.
5. Change the name of the data set.

![Rename Data Set](../../docs/images/ZE-rename.gif?raw=true "Rename Data Set")
<br /><br />

### Copy data sets

1. Navigate to the explorer tree.
2. Open the **DATA SETS** bar.
3. Select a member you want to copy.
4. Right-click the member and select the **Copy Data Set** option.
5. Right-click the data set where the member belongs and select the **Paste Data Set** option.
6. Enter the name of the copied member.

![Copy Data Set](../../docs/images/ZE-copy.gif?raw=true "Copy Data Set")
<br /><br />

### Download, edit, and upload existing PDS members

1. Navigate to the explorer tree.
2. Open the **DATA SETS** bar.
3. Open a profile.
4. Click the PDS member (or PS) that you want to download.

   **Note:** To view the members of a PDS, click the PDS to expand the tree.

   The PDS member is displayed in the text editor window of VSC.

5. Edit the document.
6. Navigate back to the PDS member (or PS) in the explorer tree, and click the **Save** button.

Your PDS member (or PS) is uploaded.

**Note:** If someone else has made changes to the PDS member (or PS) while you were editing it, you can merge your conflicts before uploading to the mainframe.

![Edit](../../docs/images/ZE-download-edit.gif?raw=true "Edit")
<br /><br />

### Use the save option to prevent merge conflicts

1. Navigate to the explorer tree.
2. Open the **DATA SETS** bar.
3. Open a member of a data set you want to edit.
4. Edit a data set.
5. Press Ctrl+S or Command+S (OSx) to save you changes.
6. (Optional) Resolve merge conflicts if necessary.

![Save](../../docs/images/ZE-safe-save.gif?raw=true "Save")
<br /><br />

### Create a new PDS and a PDS member

1. Navigate to the explorer tree.
2. Open the **DATA SETS** bar.
3. Click the **Create New Data Set** button to create a PDS.
4. From the drop-down menu, select the type of PDS that you want to create.
5. Enter a name for the PDS.
   The PDS is created.
6. To create a member, right-click the PDS and select **Create New Member**.
7. Enter a name for the member.
   The member is created.

![Create](../../docs/images/ZE-cre-pds-member.gif?raw=true "Create")
<br /><br />

### Delete a PDS member and PDS

1. Navigate to the explorer tree.
2. Open the **DATA SETS** bar.
3. Open the profile and PDS containing the member.
4. Right-click on the PDS member that you want to delete and select **Delete Member**.
5. Confirm the deletion by clicking **Yes** on the drop-down menu.

   **Note:** Alternatively, you can select 'No' to cancel the deletion.

6. To delete a PDS, right-click the PDS and click **Delete PDS**, then confirm the deletion.

   **Note:** You can delete a PDS before you delete its members.

![Delete](../../docs/images/ZE-del-pds-member.gif?raw=true "Delete")
<br /><br />

### View and access multiple profiles simultaneously

1. Navigate to the explorer tree.
2. Open the **DATA SETS** bar.
3. Click the **Add Profile** button on the right of the **DATA SET** explorer bar.
4. Select the profile that you want to add to the view as illustrated by the following screen.

![Add Profile](../../docs/images/ZE-mult-profiles.gif?raw=true "Add Profile")

### Allocate Like

1. Navigate to the explorer tree.
2. Open the **DATA SETS** bar.
3. Right-click the data set and select the **Allocate Like (New File with Same Attributes)** option.
4. Enter the new data set name.

![Allocate Like](../../docs/images/ZE-allocate-like.gif?raw=true "Allocate Like")

## Credentials Security

Store your credentials securely with the Secure Credentials Store (SCS) plug-in.

1. Navigate to the VSCode settings.
2. Open Zowe Explorer Settings.
3. Add the `Zowe-Plugin` value to the **Zowe Security** entry field.
4. Restart VSCode.

For more information about SCS, see [Secure Credential Store Plug-in for Zowe Explorer](https://docs.zowe.org/stable/user-guide/ze-profiles.html#enabling-secure-credential-store-with-zowe-explorer).

## Usage tips

- Use the **Add Favorite** feature to permanently store chosen data sets, USS files, and jobs in the **Favorites** folder. Right-click on a data set, USS file or jobs and select **Add Favorite**.

- **Syntax Highlighting:** Zowe Explorer supports syntax highlighting for data sets. Fox example, you can use such extensions as [COBOL Language Support](https://marketplace.visualstudio.com/items?itemName=broadcomMFD.cobol-language-support) or [HLASM Language Support](https://marketplace.visualstudio.com/items?itemName=broadcomMFD.hlasm-language-support).

- **Edit a profile**: Click the **pencil** icon next to the **magnifying glass** icon in the explorer tree, and modify the information inside your profile.

- **Delete a profile**: Right-click a chosen profile and select **Delete Profile** to permanently delete the profile. The functionality deletes a profile from your `.zowe` folder.

- **Hide a profile**: You can hide a profile from the profile tree by right-clicking the profile and selecting the **Hide Profile** option. To add the profile back, click the **+** button and select the profile from the quick pick list.

- **Associate profiles**: You can create a secondary association by right-clicking the profile and selecting the **Associate profiles** icon. For more information, see [the Associate profiles section](https://docs.zowe.org/stable/user-guide/ze-profiles.html#associate-profile) in Zowe Docs.

For information how to configure Zowe Explorer, see [Zowe Explorer Configuration guidelines](https://docs.zowe.org/stable/user-guide/ze-install.html#configuration).

## Extending Zowe Explorer

You can add new functionalities to Zowe Explorer by creating your own extension. For more information, see [Extensions for Zowe Explorer](https://github.com/zowe/vscode-extension-for-zowe/blob/master/docs/README-Extending.md).

**Tip:** View an example of a Zowe Explorer extension — [Zowe Explorer FTP extension documentation](https://github.com/zowe/zowe-explorer-ftp-extension#zowe-explorer-ftp-extension).
