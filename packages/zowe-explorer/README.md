# Zowe Explorer

[![downloads](https://img.shields.io/visual-studio-marketplace/d/Zowe.vscode-extension-for-zowe.svg)](https://img.shields.io/visual-studio-marketplace/d/Zowe.vscode-extension-for-zowe.svg)
[![codecov](https://codecov.io/gh/zowe/zowe-explorer-vscode/branch/v1-lts/graph/badge.svg)](https://codecov.io/gh/zowe/zowe-explorer-vscode)
[![slack](https://img.shields.io/badge/chat-on%20Slack-blue)](https://slack.openmainframeproject.org/)

[Zowe Explorer](https://github.com/zowe/community#zowe-explorer) is a sub-project of Zowe, focusing on modernizing mainframe experience. [Zowe](https://www.zowe.org/) is a project hosted by the [Open Mainframe Project](https://www.openmainframeproject.org/), a [Linux Foundation](https://www.linuxfoundation.org/) project.

The Zowe Explorer extension modernizes the way developers and system administrators interact with z/OS mainframes by:

- Enabling you to create, modify, rename, copy, and upload data sets directly to a z/OS mainframe.
- Enabling you to create, modify, rename, and upload USS files directly to a z/OS mainframe.
- Providing a more streamlined way to access data sets, uss files, and jobs.
- Letting you create, edit, and delete Zowe CLI `zosmf` compatible profiles.
- Letting you use the Secure Credential Store plug-in to store your credentials securely in the settings.
- Letting you leverage the API Mediation Layer token-based authentication to access z/OSMF.

More information:

- For the complete Zowe Explorer documentation, see [Zowe Docs](https://docs.zowe.org/stable/user-guide/ze-install.html).
- Join the **#zowe-explorer** channel on [Slack](https://openmainframeproject.slack.com/) to stay in touch with the Zowe community.

## Contents

- [What's new in Zowe Explorer 1.22.0](#whats-new-in-zowe-explorer-1210)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Sample Use Cases](#sample-use-cases)
- [Credentials Security](#credentials-security)
- [Usage Tips](#usage-tips)
- [Extending Zowe Explorer](#extending-zowe-explorer)

## What's new in Zowe Explorer 1.22.0

> Zowe Explorer is compatible only with Theia 1.18.0 or higher.
> Zowe Explorer could experience possible unexpected behaviors with the latest Theia releases.

**Added**:

- Added extensible Login and Logout capabilities for Zowe extenders to utilize for token based authentication.
- Added an Eclipse Public License file. Users can view the license file in the root directory of the Zowe Explorer repository.

**Changed**:

- Changed the Supported Node.js version to v12 or higher. We no longer support running the product on earlier versions (10.x and earlier) of Node.js.
- Changed the dependencies of `copy-props`, `nanoid`, and `markdown-it` to improve security alerting.
- A work around was developed to help developers debug Zowe Explorer VS Code extension on Theia. For more information, see [Work around for debugging in Theia](https://github.com/zowe/vscode-extension-for-zowe/pull/1576).

**Fixed**:

- Fixed the Zowe Explorer deployment script by updating it to use vsce (Visual Studio Code Extension Manager) version 1.103.1 to help ensure that it is compatible with Node v12 [#1608](https://github.com/zowe/vscode-extension-for-zowe/pull/1608).
- Fixed the Theia input box issue that caused entered values to be validated incorrectly.

## Prerequisites

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

![New Connection](/docs/images/ZE-newProfiles.gif?raw=true "New Connection")
<br /><br />

You can now use all the functionalities of the extension.

#### Profile Validation

Zowe Explorer includes the profile validation feature that helps to ensure that the specified connection to z/OS is successfully established and your profile is ready for use. If a profile is valid, the profile is active and can be used. By default, the feature is automatically enabled. You can disable the feature by right-clicking on your profile and selecting the **Disable Validation for Profile** option. Alternatively, you can enable or disable the feature for all profiles in the VS Code settings.

Follow these steps:

1. Navigate to the VS Code settings.
2. Open Zowe Explorer Settings.
3. Enable or disable the automatic validation of profiles option.
4. Restart VS Code.

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
- [Copy data set members](#copy-data-set-members): Copy specified data set members.
- [Edit and upload a data set member](#edit-and-upload-a-data-set-member): You can instantly pull data sets and data set members from the mainframe, edit them, and upload back.
- [Prevent merge conflicts](#use-the-save-option-to-prevent-merge-conflicts): The save option includes a **compare** mechanism letting you resolve potential merge conflicts.
- [Create data sets and data set members](#create-a-new-data-set-and-add-a-member): Create a new data set and data set members.
- [Create data sets and specify the parameters](#create-data-sets-and-specify-the-parameters): Create a new data set and specify parameter values.
- [Delete data sets and data set members](#delete-data-sets-and-data-set-members): Delete one or more data sets and data set members.
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

![View Data Set](/docs/images/ZE-multiple-search.gif?raw=true "View Data Set")
<br /><br />

### View data sets with member filters

1. Navigate to the explorer tree.
2. Open the **DATA SETS** bar.
3. Click the **magnifying glass** icon.
4. Enter a search patterm in the `HLQ.ZZZ.SSS(MEMBERNAME)` format to filter out and display the specified member in the tree.

![View Data Set With Member Pattern](/docs/images/ZE-member-filter-search.gif?raw=true "View Data Set With Member Pattern")

**Note:** You cannot favorite a data set or member that includes a member filter search pattern.
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

![Rename Data Set](/docs/images/ZE-rename.gif?raw=true "Rename Data Set")
<br /><br />

### Copy data set members

1. Navigate to the explorer tree.
2. Open the **DATA SETS** bar.
3. Select a data set member you want to copy.
4. Right-click the member and select the **Copy Member** option.
5. Right-click a data set that you want to paste the member to and select the **Paste Member** option.
6. Enter the name of the copied member.

![Copy Data Set](/docs/images/ZE-copy-member.gif?raw=true "Copy Data Set")
<br /><br />

### Edit and upload a data set member

1. Navigate to the explorer tree.
2. Open the **DATA SETS** bar.
3. Open a profile.
4. Select the data set member you want to edit.

   **Note:** To view the members of a data set, click the data to expand the tree.

   The data set member is displayed in the text editor window of VS Code.

5. Edit the document.
6. Navigate back to the data set member in the explorer tree, and press Ctrl+S or Command+S (OSx) to upload the member.

Your data set member is uploaded.

**Note:** If someone else has made changes to the data set member while you were editing it, you can merge your conflicts before uploading the member to the mainframe.

![Edit](/docs/images/ZE-edit-upload.gif?raw=true "Edit")
<br /><br />

### Use the save option to prevent merge conflicts

1. Navigate to the explorer tree.
2. Open the **DATA SETS** bar.
3. Open a member of a data set you want to edit.
4. Edit a data set.
5. Press Ctrl+S or Command+S (OSx) to save you changes.
6. (Optional) Resolve merge conflicts if necessary.

![Save](/docs/images/ZE-safe-save.gif?raw=true "Save")
<br /><br />

### Create a new data set and add a member

1. Navigate to the explorer tree.
2. Open the **DATA SETS** bar.
3. Right + click on the profile where you want to create a data set and select **Create New Data Set**.
4. Enter a name for your data set.
5. From the drop-down menu, select the data set type that you want to create.
6. Select **+Allocate Data Set** to create your data set.
7. Right-click your newly-created data set and select **Create New Member**.
8. Enter a name for your new data set member and click **Enter**.
   The member is created and opened in the workspace.

### Create data sets and specify the parameters

1. Navigate to the explorer tree.
2. Open the **DATA SETS** bar.
3. Right-click the profile you want to create a data set with and select **Create New Data Set**.
4. Enter a name for your data set.
5. From the drop-down menu, select the data set type that you want to create.
6. Select **Edit Attributes** in the drop-down menu.

   The attributes list for the data set appears. You can edit the following attributes:

   - Allocation Unit

   - Average Block Length

   - Block Size

   - Data Class

   - Device Type

   - Directory Block

   - Data Set Type

   - Management Class

   - Data Set Name

   - Data Set Organization

   - Primary Space

   - Record Format

   - Record Length

   - Secondary Space

   - Size

   - Storage Class

   - Volume Serial

7. Select the attribute you want to edit, provide the value in the command palette, and click **Enter**.
8. (Optional) Edit the parameters of your data set.
9. Select the **+ Allocate Data Set** option to create the data set.
   You successfully created a data set.

   ![Parameters](/docs/images/ZE-set-params.gif?raw=true "Parameters")
   <br /><br />

### Delete data sets and data set members

1. Navigate to the explorer tree.
2. Open the **DATA SETS** bar.
3. Select one or more data sets and/or data set members.

   **Tip:** Hold **Ctrl/Cmd** key while clicking data sets or data set members to select more than one item for deletion.

4. Press the **Delete** key on your keyboard.

   Alternatively, right-click on the item and select the **Delete Data Set** or **Delete Member** option.

5. Confirm the deletion by clicking **Delete** in the drop-down menu.

   ![Delete Data Sets and Members](/docs/images/ZE-delete-ds.gif?raw=true "Delete Data Sets and Members")
   <br /><br />

### View and access multiple profiles simultaneously

1. Navigate to the explorer tree.
2. Open the **DATA SETS** bar.
3. Click the **+** icon (Add Profile) on the right of the **DATA SET** explorer bar.
4. Select the profile that you want to add to the view as illustrated by the following screen.

![Add Profile](/docs/images/ZE-mult-profiles.gif?raw=true "Add Profile")

### Allocate Like

1. Navigate to the explorer tree.
2. Open the **DATA SETS** bar.
3. Right-click the data set and select the **Allocate Like (New Data Set with Same Attributes)** option.
4. Enter a new data set name.

![Allocate Like](/docs/images/ZE-allocate.gif?raw=true "Allocate Like")

## Credentials Security

Store your credentials securely with the Secure Credentials Store (SCS) plug-in.

1. Navigate to the VS Code settings.
2. Open Zowe Explorer Settings.
3. Add the `Zowe-Plugin` value to the **Zowe Security** entry field.
4. Restart VS Code.

For more information about SCS, see [Secure Credential Store Plug-in for Zowe Explorer](https://docs.zowe.org/stable/user-guide/ze-profiles.html#enabling-secure-credential-store-with-zowe-explorer).

## Usage tips

- Use the **Add to Favorite** feature to permanently store chosen data sets, USS files, and jobs in the **Favorites** folder. Right-click on a data set, USS file or jobs and select **Add Favorite**.

- **Syntax Highlighting:** Zowe Explorer supports syntax highlighting for data sets. You can search for and install such extensions in VS Code Marketplace.

- **Update a profile**: Right-click a chosen profile, select **Update Profile** option, and modify the information inside the profile.

- **Delete a profile**: Right-click a chosen profile and select **Delete Profile** to permanently delete the profile. The functionality deletes the profile from your `.zowe` folder.

- **Hide a profile**: You can hide a profile from the profile tree by right-clicking the profile and selecting the **Hide Profile** option. To add the profile back, click the **+** button and select the profile from the quick pick list.

- **Associate profiles**: You can create a secondary association by right-clicking the profile and selecting the **Associate profiles** option. For more information, see [the Associate profiles section](https://docs.zowe.org/stable/user-guide/ze-profiles.html#associate-profile) in Zowe Docs.

  > **Note**: The Associate Profile functionality is deprecated and will be removed in Zowe Explorer V2 that is slated for February 2022. For more information, see the Release Timeline section on the [Download Zowe](https://www.zowe.org/download.html#timeline) page on the Zowe site. Use the base profile feature instead of **associate profile**.

- **Open recent members**: Zowe Explorer lets you open a list of members you worked on earlier. You can access the list by pressing Ctrl+Alt+R (Windows) or Command+Option+R (Mac).

For the comprehensive Zowe Explorer documentation that also includes information about USS and Jobs interactions, see [the Zowe Explorer documentation](https://docs.zowe.org/stable/user-guide/ze-install.html) in Zowe Docs.

## Extending Zowe Explorer

You can add new functionalities to Zowe Explorer by creating your own extension. For more information, see [Extensions for Zowe Explorer](https://github.com/zowe/vscode-extension-for-zowe/blob/master/docs/README-Extending.md).

**Tip:** View an example of a Zowe Explorer extension — [Zowe Explorer FTP extension documentation](https://github.com/zowe/zowe-explorer-ftp-extension#zowe-explorer-ftp-extension).
