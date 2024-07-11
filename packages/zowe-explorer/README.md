# Zowe™ Explorer

[![version](https://img.shields.io/visual-studio-marketplace/v/Zowe.vscode-extension-for-zowe.svg)](https://img.shields.io/visual-studio-marketplace/v/Zowe.vscode-extension-for-zowe.svg)
[![downloads](https://img.shields.io/visual-studio-marketplace/d/Zowe.vscode-extension-for-zowe.svg)](https://img.shields.io/visual-studio-marketplace/d/Zowe.vscode-extension-for-zowe.svg)
[![codecov](https://codecov.io/gh/zowe/zowe-explorer-vscode/branch/main/graph/badge.svg)](https://codecov.io/gh/zowe/zowe-explorer-vscode)
[![slack](https://img.shields.io/badge/chat-on%20Slack-blue)](https://slack.openmainframeproject.org/)

> ## v3 Pre-release is now available in our [Github Releases](https://github.com/zowe/zowe-explorer-vscode/releases) with the removal of v1 profile support. Keep an eye on [changes affecting users and extenders](https://github.com/zowe/zowe-explorer-vscode/wiki/v3-Changes-for-Users-and-Extenders) for the full list of changes

## Introduction

[Zowe Explorer](https://docs.zowe.org/stable/user-guide/ze-install), part of the [Zowe](https://www.zowe.org/) project, is an open-source Visual Studio Code extension that provides a modern interface for mainframe developers to interact with data sets, USS files, and jobs on z/OS. 

Zowe is a member of the [Open Mainframe Project™](https://www.openmainframeproject.org/) governed by the [Linux Foundation™](https://www.linuxfoundation.org/).

Zowe Explorer gives users the ability to:
- Create, modify, rename, copy, and upload data sets and USS files directly to a z/OS mainframe.
- Submit JCL, list jobs, and view spool output.
- View resources from multiple LPARs in a single VS Code window.
- Create, read, and manage [Zowe CLI](https://docs.zowe.org/stable/user-guide/cli-using-usingcli)-compatible connection configurations.
- Access z/OSMF through the [Zowe API Mediation Layer](https://docs.zowe.org/stable/user-guide/cli-using-integrating-apiml/). 

For more information on working with z/OS data sets, USS files, and jobs in Zowe Explorer, refer to [Using Zowe Explorer](https://docs.zowe.org/stable/user-guide/ze-usage).

## Contents

- [Prerequisite tasks](#prerequisite-tasks)
- [Getting started](#getting-started)
- [Usage tips](#usage-tips)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Extending Zowe Explorer](#extending-zowe-explorer)
- [Known Issues](#known-issues)
- [More information](#more-information)

> Zowe Explorer is compatible only with Theia 1.18.0 or higher. We recommend using a [Theia community release](https://theia-ide.org/releases/) as Zowe Explorer could experience possible unexpected behaviors with the latest Theia releases.

## Prerequisite tasks

- Configure TSO/E address space services, z/OS data set, file REST interface, and z/OS jobs REST interface. For more information, see [z/OS Requirements](https://docs.zowe.org/stable/user-guide/systemrequirements-zosmf.html#z-os-requirements).

## Getting started

This section includes steps for the tasks you need to complete to get started using Zowe Explorer.

Configure Zowe Explorer, create a [team configuration file](#create-a-team-configuration-file) or a [v1 profile (deprecated)](#create-a-v1-profile) for profile manangement, review the [sample use cases](#sample-use-cases) to familiarize yourself with the capabilities of Zowe Explorer, and you are ready to use Zowe Explorer.

### Configuring Zowe Explorer

You can configure Zowe Explorer by changing the extension settings. For more information, see [Configuring Zowe Explorer](https://docs.zowe.org/stable/user-guide/ze-install#configuring-zowe-explorer).

When environment conditions do not support the Zowe CLI built-in Credential Manager, see [Modifying the Secure Credentials Enabled Setting](https://docs.zowe.org/stable/user-guide/ze-install#modifying-the-secure-credentials-enabled-setting).

### Multifactor authentication support (MFA)

Zowe Explorer supports the use of MFA tokens for authentication. To use MFA when using zOSMF profiles, it is required to connect through the Zowe API Mediation Layer (API ML). The suggested use case for MFA authentication using Zowe Explorer is to log into the API ML via the right-click login action in Zowe Explorer and, when prompted for password, enter the MFA token in place of the password. Then the API will return a JSON token (JWT) that will be used for further authentication.

You can find more information regarding MFA support in Zowe's documentation on [integrating with API Mediation Layer](https://docs.zowe.org/stable/user-guide/cli-using-integrating-apiml/).

### Create a team configuration file

1. Navigate to the **Side Bar**.
2. Hover over **DATA SETS**, **USS**, or **JOBS**.
3. Click the **+** icon.
4. Select **Create a New Team Configuration File**.
5. If no workspace is open, a global configuration file is created. If a workspace is open, chose either a global configuration file or a project-level configuration file.
6. Edit the config file to include the host and other connection information, and save.

Your team configuration file appears either in your .zowe folder, if you chose the global configuration file option, or in your workspace directory if you chose the project-level configuration file option. The notification message that is shown in VS Code after creating the config file includes the path of the created file.

### Create a v1 profile

> v1 profiles are deprecated and planned to be removed in Zowe Explorer v3.0.0.

**Note:** If a team configuration file is in place, v1 profile creation and use will not be available.

1. Navigate to the **Side Bar**.
2. Hover over **DATA SETS**, **USS**, or **JOBS**.
3. Click the **+** icon.
4. Select **Create a New Connection to z/OS**. The user name and password fields are optional.
5. Follow the instructions, and enter all required information to complete the profile creation.

![New Connection](/docs/images/ZE-newProfiles.gif "New Connection")
<br /><br />

You can now use all the functionalities of the extension.

### Using profiles for the first time

The first time profiles are used, you will be prompted for user name and password for the profile's connection. The term password is used loosely to represent all supported authentication secrets like passphrases, passtickets, multi-factor authentication (MFA) tokens, etc.

### Updating securely stored credentials

To update securely stored user names and passwords in Zowe Explorer, the user can right click the profile and select **Manage Profile**, then **Update Credentials** from the drop down list. This prompts the user for the new credentials and the secure credentials vault is updated.

### Editing the team configuration file

1. Navigate to the **Side Bar**.
2. Hover over **DATA SETS**, **USS**, or **JOBS**.
3. Click the **+** icon.
4. If a team configuration file is in place, the **Edit Team Configuration File** option is displayed.
   ![Edit Team Configuration File](/docs/images/ZE-edit-config.png)
   <br /><br />
5. If only a global or project level config is in place, it opens to be edited. If both a global and project level config are in place, the user must select which file to edit.
   ![Edit Config Location Option](/docs/images/ZE-edit-options.png)
   <br /><br />

### Profile validation

**Note:** The following information applies to Zowe CLI V1 profiles (one yaml file for each user profile) and Zowe CLI team profiles (Zowe CLI V2).

Zowe Explorer includes a profile validation feature that helps to ensure that the specified connection to z/OS is successfully established and your profile is ready for use. If a profile is successfully validated, the profile becomes active and can be used.

By default, this feature is automatically enabled. You can disable profile validation by right-clicking on your profile and selecting the **Disable Validation for Profile** option. Alternatively, you can enable or disable validation for all profiles in the VS Code settings:

1. In VS Code, navigate to **Settings**.
2. Navigate to Zowe Explorer settings.
3. Check the **Automatic Profile Validation** checkbox to enable the automatic validation of profiles option. Uncheck to disable.
4. Restart VS Code.

### Use base profile and token with existing profiles

As a Zowe user, you can leverage base profile functionality to access multiple services through Single Sign-on. Base profiles enable you to authenticate using the Zowe API Mediation Layer (API ML). You can use base profiles with more than one service profile. For more information, see [Base Profiles](https://docs.zowe.org/stable/user-guide/cli-using-using-profiles-v1/#base-profiles).

**Note:** Before using the base profile functionality with v1 profiles, ensure that you have [Zowe CLI](https://docs.zowe.org/stable/user-guide/cli-installcli.html) v6.0.0 or higher installed.

1. Zowe Explorer has a right click action for profiles to log in and log out of the authentication service for existing Base profiles. If a v1 Base profile hasn't been created, open a terminal and run the following Zowe CLI command: `zowe auth login apiml`.
2. Follow the instructions to complete the login.
   A local base profile is created that contains your token.

   **Note:** For more information about the process, see [Token Management](https://docs.zowe.org/stable/user-guide/cli-using-integrating-apiml/#how-token-management-works).

3. Open VS Code and select the **Zowe Explorer** icon in the **Side Bar**.

4. Hover over **DATA SETS**, **USS**, or **JOBS**.

5. Click the **+** icon.

6. Select the profile you use with your base profile with the token.

   The profile appears in the tree and you can now use this profile to access z/OSMF via the API Mediation Layer.

For more information, see [Integrating with API Mediation Layer](https://docs.zowe.org/stable/user-guide/cli-using-integrating-apiml).

#### Log in to the Authentication Service

If the token for your base profile is no longer valid, you can log in again to get a new token with the **Log in to Authentication Service** feature.

**Notes:**

- The feature is only available for base profiles.
- The feature supports only API Mediation Layer at the moment. Other extenders may use a different authentication service.

1. Open VS Code and select the Zowe Explorer icon in the **Side Bar**.
2. Right-click your profile and select **Manage Profile**.
3. Select the **Log in to Authentication Service** option from the drop down list.

   You are prompted to enter your username and password.

The token is stored in the corresponding base profile file, YAML file for v1 Profiles, or the team configuration file.

If you do not want to store your token, you can request the server to end your session token. Use the **Log out from Authentication Service** feature to invalidate the token:

1. Open Zowe Explorer.
2. Hover over **DATA SETS**, **USS**, or **JOBS**.
3. Click the **+** icon.
4. Right-click your profile and select **Manage Profile**..
5. Select the **Log out from Authentication Service** option from the drop down list.

Your token has been successfully invalidated.

## Usage tips

- Use the **Add to Favorite** feature to permanently store chosen data sets, USS files, and jobs in the **Favorites** folder. Right-click on a data set, USS file or jobs and select **Add Favorite**.

- **Syntax Highlighting:** Zowe Explorer supports syntax highlighting for data sets. You can search for and install such extensions in VS Code Marketplace.

- **Update a profile**: Right-click a profile, select the **Manage Profile** option then select **Edit Profile** option from drop down list, and modify the information inside the profile.

- **Delete a profile**: For Zowe V1 profiles, right-click a profile and select the **Manage Profile** then select **Delete Profile** option from the drop down list to permanently delete the profile and delete the profile from your `.zowe` folder.

  For Zowe V2 profiles, the **Delete Profile** option opens the `zowe.config.json` file for the user to delete the profile manually:

  ![Delete a V2 profile](/docs/images/ZE-v2-delete-profile.gif "Delete a V2 profile")

- **Hide a profile**: You can hide a profile from the profile tree by right-clicking the profile and selecting the **Manage Profile** and then select **Hide Profile** option from the drop down menu. Finally, if the profile is in multiple trees, choose whether the to hide from all trees or just the tree the action was started in. To unhide the profile, click the **+** button and select the profile from the quick pick list.

- **Open recent members**: Zowe Explorer lets you open a list of members you worked on earlier. You can access the list by pressing `Ctrl`+`Alt`+`R` (Windows) or `Command`+`Option`+`R` (Mac).

For the comprehensive Zowe Explorer documentation that also includes information about USS and Jobs interactions, see [the Zowe Explorer documentation](https://docs.zowe.org/stable/user-guide/ze-install.html) in Zowe Docs.

## Keyboard shortcuts

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

You can add new functionality to Zowe Explorer by creating your own extension. For more information, see [Extending Zowe Explorer](https://github.com/zowe/zowe-explorer-vscode/wiki/Extending-Zowe-Explorer).

**Tip:** View an example of a Zowe Explorer extension: [Zowe Explorer FTP extension documentation](https://github.com/zowe/zowe-explorer-vscode/tree/main/packages/zowe-explorer-ftp-extension).

## Known issues

### Bidirectional languages

Files written in languages primarily read from right to left (Arabic, Hebrew, many Asian languages) can include portions of text that are written and read left to right, such as numbers.

These bidirectional (BiDi) languages are not currently supported in Visual Studio Code. (See [Issue #86667](https://github.com/microsoft/vscode/issues/86667) for more information.)

As a result, VS Code extensions like Zowe Explorer, Zowe Explorer CICS Extension, and Zowe Explorer FTP Extension are not able to support BiDi languages in files.

## More information

- For the complete Zowe Explorer documentation, see [Zowe Docs](https://docs.zowe.org/stable/user-guide/ze-install.html).
- Join the **#zowe-explorer** channel on [Slack](https://openmainframeproject.slack.com/) to stay in touch with the Zowe community.
