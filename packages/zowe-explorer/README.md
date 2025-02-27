# Zowe Explorer for Visual Studio Code

[![version](https://img.shields.io/visual-studio-marketplace/v/Zowe.vscode-extension-for-zowe.svg)](https://img.shields.io/visual-studio-marketplace/v/Zowe.vscode-extension-for-zowe.svg)
[![downloads](https://img.shields.io/visual-studio-marketplace/d/Zowe.vscode-extension-for-zowe.svg)](https://img.shields.io/visual-studio-marketplace/d/Zowe.vscode-extension-for-zowe.svg)
[![codecov](https://codecov.io/gh/zowe/zowe-explorer-vscode/branch/main/graph/badge.svg)](https://codecov.io/gh/zowe/zowe-explorer-vscode)
[![slack](https://img.shields.io/badge/chat-on%20Slack-blue)](https://slack.openmainframeproject.org/)

> All previous versions of Zowe Explorer for Visual Studio Code&trade; can be downloaded from [Zowe Explorer GitHub Releases](https://github.com/zowe/zowe-explorer-vscode/releases).

## Introduction

[Zowe Explorer for Visual Studio Code](https://github.com/zowe/community#zowe-explorer) provides access to mainframe resources in VS Code. Zowe Explorer provides an intuitive, modern development experience that enables mainframe developers and system programmers to:

- Manage data sets and USS files on a z/OS mainframe with browse, create, modify, rename, copy, and upload functionality
- Submit JCL and view job output
- Apply other VS Code extensions for things like syntax highlighting, debugging, and IntelliSense to improve the developer experience

Zowe Explorer for VS Code is a Zowe&trade; component that focuses on modernizing the mainframe experience. [Zowe](https://www.zowe.org/) is hosted by the [Open Mainframe Project&trade;](https://www.openmainframeproject.org/), a [Linux Foundation&trade;](https://www.linuxfoundation.org/) initiative.

## Contents

- [Prerequisites tasks](#prerequisite-tasks)
- [Getting started](#getting-started)
- [Usage tips](#usage-tips)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Extending Zowe Explorer](#extending-zowe-explorer)
- [Known issues](#known-issues)
- [More information](#more-information)

## Prerequisite tasks

Zowe clients like Zowe Explorer for VS Code use z/OSMF Representational State Transfer (REST) APIs to work with system resources and extract system data. Ensure that the following  z/OSMF REST services are configured and available.

- TSO/E address space services
- z/OS data set and file REST interface
- z/OS jobs REST interface

For more information, see [z/OSMF REST services for Zowe clients](https://docs.zowe.org/stable/user-guide/systemrequirements-zosmf.html#zosmf-rest-services-for-zowe-clients).

## Getting started

Configure Zowe Explorer for VS Code, create a [team configuration file](#create-a-team-configuration-file) to connect to mainframe services, and manage secure credentials to get started using Zowe Explorer.

### Configuring Zowe Explorer for VS Code

Configure Zowe Explorer for VS Code by changing the extension settings. For more information, see [Configuring Zowe Explorer](https://docs.zowe.org/stable/user-guide/ze-install-configuring-ze).

### Create a team configuration file

A team configuration file stores connection information to mainframe services in *profiles* that are easy to maintain and share with others in your organization.

**Note**: Team configuration files can be used across two core components of the Zowe project, Zowe Explorer for VS Code and Zowe CLI.

1. Navigate to the **Side Bar**.
2. Hover over the **DATA SETS**, **USS**, or **JOBS** tree view header.
3. Click the **+** icon.
4. Select **Create a New Team Configuration File**.
5. If no workspace is open, a global configuration file is created. If a workspace is open, chose either a global configuration file or a project-level configuration file.
6. Edit the configuration file to include the host and other connection information for a mainframe service, and save.

      Your team configuration file appears either in your `.zowe` folder if you chose the global configuration file option, or in your workspace directory if you chose the project-level configuration file option. The notification message that displays in VS Code after configuration file creation includes the path of the created file.

      You can now use all the functionalities of the extension.

### Using profiles for the first time

The first time team configuration profiles are used, you are prompted for a user name and password for the profile's connection.

The term *password* is used loosely to represent all supported authentication secrets, such as passphrases, passtickets, Multifactor Authentication (MFA) tokens, etc.

### Profile validation

Zowe Explorer for VS Code includes a back-end profile validation feature that helps to ensure that the specified connection to z/OS is successfully established and your profile is ready for use. If the API connection is valid, the profile is active and can be used.

If the connection fails, Zowe Explorer displays an error message advising that the profile is inactive and to take troubleshooting steps.

This feature is automatically enabled by default. You can disable the feature by right-clicking on your profile and selecting the **Manage Profile** option and then **Disable Validation for Profile** from the **Quick Pick**.

Enable or disable the validation feature for all profiles in the VS Code settings:

1. In VS Code, navigate to **Settings**.
1. Navigate to Zowe Explorer settings.
1. Check the **Automatic Profile Validation** checkbox to enable the automatic validation of profiles option. Uncheck to disable.
1. Restart VS Code.

### Editing team configuration file

Edit your team configuration file to add, remove, or update a profile and its connection information.

1. Navigate to the **Side Bar**.
2. Hover over the **DATA SETS**, **USS**, or **JOBS** tree view header.
3. Click the **+** icon.
4. If team configuration is in place, the **Edit Team Configuration File** option displays in the **Quick Pick**.

   If only a global- or project-level configuration is in place, the file opens to be edited. If both a global and project level configuration are in place, the user must select which file to edit.

### Updating securely stored credentials

Secure fields in the team configuration file are handled by the Zowe Imperative dependency.

To update securely stored user names and passwords in Zowe Explorer:

1. Right click the profile and select **Manage Profile**.
2. Select **Update Credentials** from the **Quick Pick**.

    You are prompted for the new credentials and these are saved to the secure credentials vault.

## Other authentication methods

Zowe Explorer for VS Code supports multiple authentication methods including basic authentication, multi-factor authentication, tokens, and certificates.

### Using Single Sign-On

As a Zowe user, you can use a base profile stored in a team configuration file to access multiple services through Single Sign-On.

In Zowe Explorer, a base profile enables you to authenticate your credentials with one method, the Zowe API Mediation Layer (API ML), to access multiple services. For more information, see [profile types](https://docs.zowe.org/stable/user-guide/cli-using-using-team-profiles#zowe-cli-profile-types).

To log into the API ML authentication service with an existing base profile:

1. Right-click on the profiles you want to connect through with the API ML.
2. Select the **Manage Profile** option from the context menu.
3. In the **Quick Pick**, select **Log in to Authentication Service**.
4. In the following **Quick Pick** menu, select the appropriate option for authenticating to the API ML.
5. Answer the proceeding prompts for information.

    If the request is successful, the token is used for authentication until the logout action is taken or the token expires.

For more information, see [Integrating with API Mediation Layer](https://docs.zowe.org/stable/user-guide/cli-using-integrating-apiml).

If you are done working with Zowe Explorer and want to prevent further use of a token, you can request the server to invalidate your session token. Use the **Log out from Authentication Service** feature to invalidate the token:

1. Open Zowe Explorer.
2. Right-click your profile.
3. Select the **Manage Profile** option.
4. In the **Quick Pick**, select the **Log out from Authentication Service** option.

    Your token has been successfully invalidated.

### Multi-factor authentication (MFA) support

Zowe Explorer supports the use of MFA through the Zowe API Mediation Layer (API ML).

To use MFA authentication with Zowe Explorer, log into API ML:

1. Right click on a profile.
2. Select the **Manage Profile** option.
3. Select **Log in to Authentication Service** from the **Quick Pick**.
4. When prompted, select the credential method you want to use.

    Zowe Explorer logs you in to the authentication service for your selected profile.

For more information regarding MFA support in Zowe's documentation on [integrating with API Mediation Layer](https://docs.zowe.org/stable/user-guide/cli-using-integrating-apiml/).

## Usage tips

Make the best use of Zowe Explorer for VS Code with these [usage tips](https://docs.zowe.org/stable/user-guide/ze-usage-tips).

See Zowe Docs for a complete list of use cases explaining how to work with [data sets](https://docs.zowe.org/stable/user-guide/ze-working-with-data-sets), [USS files](https://docs.zowe.org/stable/user-guide/ze-working-with-uss-files), and [jobs](https://docs.zowe.org/stable/user-guide/ze-working-with-jobs) in Zowe Explorer for VS Code.

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

You can add new functionalities to Zowe Explorer by creating your own extension. For more information, see [Extensions for Zowe Explorer](https://github.com/zowe/zowe-explorer-vscode/wiki/Extending-Zowe-Explorer).

**Tip:** View an example of a Zowe Explorer extension in the [Zowe Explorer FTP extension documentation](https://github.com/zowe/zowe-explorer-vscode#available-documentation).

## Known issues

### Bidirectional languages

Files written in languages primarily read from right to left (Arabic, Hebrew, many Asian languages) can include portions of text that are written and read left to right, such as numbers.

These bidirectional (BiDi) languages are not currently supported in Visual Studio Code. (See [Issue #86667](https://github.com/microsoft/vscode/issues/86667) for more information.)

As a result, VS Code extensions like Zowe Explorer, Zowe Explorer CICS Extension, and Zowe Explorer FTP Extension are not able to support BiDi languages in files.

## More information

- For the complete Zowe Explorer documentation, see [Zowe Docs](https://docs.zowe.org/stable/user-guide/ze-install.html).
- Join the **#zowe-explorer-vscode** channel on [Slack](https://openmainframeproject.slack.com/) to stay in touch with the Zowe community.
- To translate Zowe Explorer into your language, join our [POEditor project](https://poeditor.com/join/project/Siy3KCNFKk).
