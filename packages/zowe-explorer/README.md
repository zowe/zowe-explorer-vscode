# Zowe Explorer

[![version](https://img.shields.io/visual-studio-marketplace/v/Zowe.vscode-extension-for-zowe.svg)](https://img.shields.io/visual-studio-marketplace/v/Zowe.vscode-extension-for-zowe.svg)
[![downloads](https://img.shields.io/visual-studio-marketplace/d/Zowe.vscode-extension-for-zowe.svg)](https://img.shields.io/visual-studio-marketplace/d/Zowe.vscode-extension-for-zowe.svg)
[![codecov](https://codecov.io/gh/zowe/zowe-explorer-vscode/branch/main/graph/badge.svg)](https://codecov.io/gh/zowe/zowe-explorer-vscode)
[![slack](https://img.shields.io/badge/chat-on%20Slack-blue)](https://slack.openmainframeproject.org/)

> ## v3 Pre-release is now available in our [Github Releases](https://github.com/zowe/zowe-explorer-vscode/releases) with the removal of v1 profile support. Keep an eye on [changes affecting users and extenders](https://github.com/zowe/zowe-explorer-vscode/wiki/v3-Changes-for-Users-and-Extenders) for the full list of changes

## Introduction

[Zowe Explorer](https://github.com/zowe/community#zowe-explorer) is a sub-project of Zowe, focusing on modernizing the mainframe experience. [Zowe](https://www.zowe.org/) is a project hosted by the [Open Mainframe Project](https://www.openmainframeproject.org/), a [Linux Foundation](https://www.linuxfoundation.org/) project.

The Zowe Explorer extension modernizes the way developers and system administrators interact with z/OS mainframes by:

- Enabling the ability to create, modify, rename, copy, and upload data sets directly to a z/OS mainframe.
- Enabling the ability to create, modify, rename, and upload z/OS UNIX files directly to a z/OS mainframe.
- Enabling the ability to view, poll, and download job spool files on the z/OS mainframe.
- Built in support for Zowe CLI `zosmf` compatible profiles by default.
- Support for token-based authentication with the API Mediation Layer to access z/OSMF APIs.

## Contents

- [Sample use cases](#sample-use-cases)
- [Prerequisites tasks](#prerequisite-tasks)
- [Getting started](#getting-started)
- [Usage tips](#usage-tips)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Extending Zowe Explorer](#extending-zowe-explorer)
- [Known Issues](#known-issues)
- [More information](#more-information)

## Sample use cases

Review the following use cases and their procedures to understand how to work with data sets in Zowe Explorer. For the complete list of features including USS and jobs, see [Zowe Explorer Sample Use Cases](https://docs.zowe.org/stable/user-guide/ze-usage/#sample-use-cases).

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
- [Submit a JCL](#submit-a-jcl): You can submit a jcl from a chose data set.
- [Allocate Like](#allocate-like): Create a copy of a chosen data set with the same parameters.

## Prerequisite tasks

- Configure TSO/E address space services, z/OS data set, file REST interface, and z/OS jobs REST interface. For more information, see [z/OS Requirements](https://docs.zowe.org/stable/user-guide/systemrequirements-zosmf.html#z-os-requirements).
- Create a Zowe Explorer profile.

## Getting started

This section includes steps for the tasks you need to complete to get started using Zowe Explorer.

Configure Zowe Explorer, create a [team configuration file](#create-a-team-configuration-file) for profile management, review the [sample use cases](#sample-use-cases) to familiarize yourself with the capabilities of Zowe Explorer, and you are ready to use Zowe Explorer.

### Configuring Zowe Explorer

You can configure Zowe Explorer by changing the extension settings. For more information, see [Configuring Zowe Explorer](https://docs.zowe.org/stable/user-guide/ze-install#configuring-zowe-explorer).

When environment conditions do not support the Zowe CLI built-in Credential Manager, see [Modifying the Secure Credentials Enabled Setting](https://docs.zowe.org/stable/user-guide/ze-install#modifying-the-secure-credentials-enabled-setting).

### Multifactor authentication support (MFA)

Zowe Explorer supports the use of MFA tokens for authentication. When using zOSMF profiles it is required to connect through the Zowe API Mediation Layer (API ML). Suggested use case for MFA authentication using Zowe Explorer is by logging into the API ML via the right-click login action in Zowe Explorer and when prompted for password enter the MFA token in place of user password, the API will return a JSON token (JWT) that will be used for further authentication.

You can find more information regarding MFA support in Zowe's documentation on [integrating with API Mediation Layer](https://docs.zowe.org/stable/user-guide/cli-using-integrating-apiml/).

### Create a team configuration file

1. Navigate to the **Side Bar**.
1. Hover over **DATA SETS**, **USS**, or **JOBS**.
1. Click the **+** icon.
1. Select **Create a New Team Configuration File**.
1. If no workspace is open, a global configuration file is created. If a workspace is open, chose either a global configuration file or a project-level configuration file.
1. Edit the config file to include the host and other connection information, and save.

Your team configuration file appears either in your .zowe folder if you chose the global configuration file option, or in your workspace directory if you chose the project-level configuration file option. The notification message that shows in VS Code after config file creation includes the path of the created file.

You can now use all the functionalities of the extension.

### Using profiles for the first time

The first time profiles are used you will be prompted for user name and password for the profile's connection. The term password is used loosely to represent all supported authentication secrets like passphrases, passtickets, Multifactor Authentication (MFA) tokens, etc.

### Updating securely stored credentials

Secure fields in the team configuration file are handled by the Zowe Imperative dependency. To update securely stored user names and passwords in Zowe Explorer, the user can right click the profile and select **Manage Profile**, then **Update Credentials** from the drop down list. This prompts the user for the new credentials and the secure credentials vault is updated.

### Editing team configuration file

1. Navigate to the **Side Bar**.
1. Hover over **DATA SETS**, **USS**, or **JOBS**.
1. Click the **+** icon.
1. If team configuration file is in place, the **Edit Team Configuration File** option displays.
   ![Edit Team Configuration File](/docs/images/ZE-edit-config.png)
   <br /><br />
1. If only a global or project level config is in place, it opens to be edited. If both a global and project level config are in place, the user must select which file to edit.
   ![Edit Config Location Option](/docs/images/ZE-edit-options.png)
   <br /><br />

### Profile validation

Zowe Explorer includes the profile validation feature that helps to ensure that the specified connection to z/OS is successfully established and your profile is ready for use. If the API connection is valid, the profile is active and can be used.

By default, this feature is automatically enabled. You can disable the feature by right-clicking on your profile and selecting the **Disable Validation for Profile** option. Alternatively, you can enable or disable the feature for all profiles in the VS Code settings

1. In VS Code, navigate to **Settings**.
1. Navigate to Zowe Explorer settings.
1. Check the **Automatic Profile Validation** checkbox to enable the automatic validation of profiles option. Uncheck to disable.
1. Restart VS Code.

### Use base profile and token with existing profiles

As a Zowe user, you can leverage the base profile functionality to access multiple services through Single Sign-on. Base profiles enable you to authenticate using the Zowe API Mediation Layer (API ML). You can use base profiles with more than one service profile. For more information, see [Base Profiles](https://docs.zowe.org/stable/user-guide/cli-using-using-profiles/#base-profiles).

Zowe Explorer has a right click action for profiles to log in and log out of the authentication service for existing base profiles.

1. Open VS Code and select the **Zowe Explorer** icon in the **Side Bar**.
1. Hover over **DATA SETS**, **USS**, or **JOBS**.
1. Click the **+** icon.
1. Select the profile you use with your base profile for token authentication. The profile will appear in the tree.
1. Right-click the profile and select **Manage Profile**.
1. Select the **Log in to Authentication Service** option from the drop down list, then enter basic credentials to request the token. If the request is successful, the token will be used for authentication until the logout action is taken or the token expires.

For more information, see [Integrating with API Mediation Layer](https://docs.zowe.org/stable/user-guide/cli-using-integrating-apiml).

If you do not want to store your token, you can request the server to end your session token. Use the **Log out from Authentication Service** feature to invalidate the token:

1. Open Zowe Explorer.
1. Hover over **DATA SETS**, **USS**, or **JOBS**.
1. Click the **+** icon.
1. Right-click your profile and select **Manage Profile**.
1. Select the **Log out from Authentication Service** option.

Your token has been successfully invalidated.

## Usage tips

- Use the **Add to Favorite** feature to permanently store chosen data sets, USS files, and jobs in the **Favorites** folder. Right-click on a data set, USS file or jobs and select **Add Favorite**.

- **Syntax Highlighting:** Zowe Explorer supports syntax highlighting for data sets. You can search for and install such extensions in VS Code Marketplace.

- **Update a profile**: Right-click a profile, select the **Manage Profile** option then select **Edit Profile** option from drop down list, and modify the information inside the profile.

- **Delete a profile**: Right-click a profile, select the **Manage Profile** option then select **Delete Profile** option from drop down list, which opens the `zowe.config.json` file for the user to delete the profile manually:

  ![Delete a V2 profile](/docs/images/ZE-v2-delete-profile.gif)

- **Hide a profile**: You can hide a profile from the profile tree by right-clicking the profile and selecting the **Manage Profile** and then select **Hide Profile** option from the drop down menu. Finally, if the profile is in multiple trees, choose whether the to hide from all trees or just the tree the action was started in. To unhide the profile, click the **+** button and select the profile from the quick pick list.

- **Open recent members**: Zowe Explorer lets you open a list of members you worked on earlier. You can access the list by pressing `Ctrl`+`Alt`+`R` (Windows) or `Command`+`Option`+`R` (Mac).

For the comprehensive Zowe Explorer documentation that also includes information about USS and Jobs interactions, see [the Zowe Explorer documentation](https://docs.zowe.org/stable/user-guide/ze-install.html) in Zowe Docs.

## Keyboard Shortcuts

- Restart Zowe Explorer

  - Windows: `ctrl`+`alt`+`z`
  - Mac: `⌘`+`⌥`+`z`

- Open Recent Member

  - Windows: `ctrl`+`alt`+`r`
  - Mac: `⌘`+`⌥`+`r`

- Search in all Loaded Items
  - Windows: `ctrl`+`alt`+`p`
  - Mac: `⌘`+`⌥`+`p`

## Extending Zowe Explorer

You can add new functionalities to Zowe Explorer by creating your own extension. For more information, see [Extensions for Zowe Explorer](https://github.com/zowe/zowe-explorer-vscode/blob/main/docs/README-Extending.md).

**Tip:** View an example of a Zowe Explorer extension: [Zowe Explorer FTP extension documentation](https://github.com/zowe/zowe-explorer-vscode#available-documentation).

## Known Issues

### Bidirectional languages

Files written in languages primarily read from right to left (Arabic, Hebrew, many Asian languages) can include portions of text that are written and read left to right, such as numbers.

These bidirectional (BiDi) languages are not currently supported in Visual Studio Code. (See [Issue #86667](https://github.com/microsoft/vscode/issues/86667) for more information.)

As a result, VS Code extensions like Zowe Explorer, Zowe Explorer CICS Extension, and Zowe Explorer FTP Extension are not able to support BiDi languages in files.

## More information

- For the complete Zowe Explorer documentation, see [Zowe Docs](https://docs.zowe.org/stable/user-guide/ze-install.html).
- Join the **#zowe-explorer** channel on [Slack](https://openmainframeproject.slack.com/) to stay in touch with the Zowe community.
- To translate Zowe Explorer into your language, join our [POEditor project](https://poeditor.com/join/project/Siy3KCNFKk).

## Sample use cases extended

### View data sets and use multiple filters

1. Navigate to the **Side Bar**.
1. Open the **DATA SETS** bar.
1. Hover over the profile that you want to apply the filter to.
1. Click the **Search** icon.
1. Enter a pattern you want to create a filter for.
   The data sets that match your pattern(s) are displayed in the **Side Bar**.

**Tip:** To provide multiple filters, separate entries with a comma. You can append or postpend any filter with an \* to apply wildcard searching. You cannot enter an \* as the entire pattern.

![View Data Set](/docs/images/ZE-multiple-search.gif?raw=true "View Data Set")
<br /><br />

[Back to sample list](#sample-use-cases)

---

### View data sets with member filters

1. Navigate to the **Side Bar**.
1. Open the **DATA SETS** bar.
1. Hover over the profile that you want to apply the filter to.
1. Click the **Search** icon.
1. Enter a search pattern in the `HLQ.ZZZ.SSS(MEMBERNAME)` format to filter for and display the specified member in the tree.

![View Data Set With Member Pattern](/docs/images/ZE-member-filter-search.gif?raw=true "View Data Set With Member Pattern")

**Note:** You cannot favorite a data set or member that includes a member filter search pattern.
<br /><br />

[Back to sample list](#sample-use-cases)

---

### Refresh the list of data sets

1. Navigate to the **Side Bar**.
1. Click **Refresh All** button (circular arrow icon) on the right of the **DATA SETS** explorer bar.

[Back to sample list](#sample-use-cases)

---

### Rename data sets

1. Navigate to the **Side Bar**.
1. Open the **DATA SETS** bar.
1. Select a data set you want to rename.
1. Right-click the data set and select the **Rename Data Set** option.
1. Enter the new name of the data set.

![Rename Data Set](/docs/images/ZE-rename.gif?raw=true "Rename Data Set")
<br /><br />

[Back to sample list](#sample-use-cases)

---

### Copy data set members

1. Navigate to the **Side Bar**.
1. Open the **DATA SETS** bar.
1. Select a data set member you want to copy.
1. Right-click the member and select the **Copy Member** option.
1. Right-click a data set that you want to paste the member to and select the **Paste Member** option.
1. Enter the name of the copied member.

![Copy Data Set](/docs/images/ZE-copy-member.gif?raw=true "Copy Data Set")
<br /><br />

[Back to sample list](#sample-use-cases)

---

### Edit and upload a data set member

1. Navigate to the **Side Bar**.
1. Open the **DATA SETS** bar.
1. Open a profile.
1. Select the data set member you want to edit.

   **Note:** To view the members of a data set, click the data to expand the tree.

   The data set member is displayed in the text editor window of VS Code.

1. Edit the document.
1. Navigate back to the data set member in the explorer tree, and press `Ctrl`+`S` or `Command`+`S` (macOS) to upload the member.

   Your data set member is uploaded.

**Note:** If someone else has made changes to the data set member while you were editing it, you can merge your conflicts before uploading the member to the mainframe.

![Edit](/docs/images/ZE-edit-upload.gif?raw=true "Edit")
<br /><br />

[Back to sample list](#sample-use-cases)

---

### Use the save option to prevent merge conflicts

1. Navigate to the **Side Bar**.
1. Open the **DATA SETS** bar.
1. Open a member of a data set you want to edit.
1. Edit the selected member.
1. Press `Ctrl`+`S` or `Command`+`S` (macOS) to save the changes.

   If the original content in your local version no longer matches the same file in the mainframe, a warning message displays advising the user to compare both versions.

1. If necessary, use the editor tool bar to resolve any merge conflicts.

![Save](/docs/images/ZE-safe-save.gif?raw=true "Save")
<br /><br />

[Back to sample list](#sample-use-cases)

---

### Create a new data set and add a member

1. Navigate to the **Side Bar**.
1. Open the **DATA SETS** bar.
1. Right-click on the profile where you want to create a data set and select **Create New Data Set**.
1. Enter a name for your data set.
1. From the drop-down menu, select the data set type that you want to create.
1. Select **+Allocate Data Set** to create the data set.
1. Right-click your newly-created data set and select **Create New Member**.
1. Enter a name for your new data set member and press the `Enter` key.
   The member is created and opened in the workspace.

[Back to sample list](#sample-use-cases)

---

### Create data sets and specify the parameters

1. Navigate to the **Side Bar**.
1. Open the **DATA SETS** bar.
1. Right-click the profile you want to create a data set with and select **Create New Data Set**.
1. Enter a name for your data set and press `Enter`.
1. From the drop-down menu, select the data set type that you want to create and press `Enter`.
1. Select **Edit Attributes** in the drop-down menu and press the `Enter` key.
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

1. Select the attribute you want to edit, provide the value in the **Command Palette**, and press the `Enter` key.
1. (Optional) Edit the parameters of your data set.
1. Select the **+ Allocate Data Set** option to create the data set.

   The data set has been created successfully.

   ![Parameters](/docs/images/ZE-set-params.gif?raw=true "Parameters")
   <br /><br />

[Back to sample list](#sample-use-cases)

---

### Delete data sets and data set members

1. Navigate to the **Side Bar**.
1. Open the **DATA SETS** bar.
1. Select one or more data sets and/or data set members.

   **Tip:** Hold the `Ctrl`/`Cmd` key while clicking data sets or data set members to select more than one item for deletion.

1. Press the `Delete` key on your keyboard.

   Alternatively, right-click on the item and select the **Delete Data Set** or **Delete Member** option.

1. Confirm the deletion by clicking **Delete** in the drop-down menu.

   ![Delete Data Sets and Members](/docs/images/ZE-delete-ds.gif?raw=true "Delete Data Sets and Members")
   <br /><br />

[Back to sample list](#sample-use-cases)

---

### View and access multiple profiles simultaneously

1. Navigate to the **Side Bar**.
1. Open the **DATA SETS** bar.
1. Click the **+** icon on the right of the **DATA SET** bar.
1. Select a profile from the drop-down menu in the **Command Palette**. This adds the profile to the **Side Bar**, from where you can search for data sets.

![Add Profile](/docs/images/ze-access-multiple-profiles-simultaneously.gif?raw=true "Add Profile")

[Back to sample list](#sample-use-cases)

---

### Submit a JCL

1. Navigate to the **Side Bar**.
1. Open the **DATA SETS** bar.
1. Select the data set or data set member you want to submit.
1. Right-click the data set or member and select the **Submit Job** option.
1. If the extension setting **"Jobs: Confirm Submission"** matches the job that you are trying to submit, you will be presented with a submission confirmation dialog.
   - Click **Submit** within the dialog to confirm submission, or click **Cancel** to cancel the operation.
   - Otherwise, the job has been submitted.
1. Once the job has been submitted, click on the hyperlink within the notification pop-up to view the submission (if desired).

![Submit a JCL](/docs/images/ZE-submit-jcl.gif?raw=true "Submit a JCL")

[Back to sample list](#sample-use-cases)

---

### Allocate Like

1. Navigate to the **Side Bar**.
1. Open the **DATA SETS** bar.
1. Right-click a data set and select the **Allocate Like (New Data Set with Same Attributes)** option.
1. Enter a new data set name.

![Allocate Like](/docs/images/ZE-allocate.gif?raw=true "Allocate Like")

[Back to sample list](#sample-use-cases)
