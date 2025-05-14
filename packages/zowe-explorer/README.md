# Zowe Explorer for Visual Studio Code

[![version](https://img.shields.io/visual-studio-marketplace/v/Zowe.vscode-extension-for-zowe.svg)](https://img.shields.io/visual-studio-marketplace/v/Zowe.vscode-extension-for-zowe.svg)
[![downloads](https://img.shields.io/visual-studio-marketplace/d/Zowe.vscode-extension-for-zowe.svg)](https://img.shields.io/visual-studio-marketplace/d/Zowe.vscode-extension-for-zowe.svg)
[![codecov](https://codecov.io/gh/zowe/zowe-explorer-vscode/branch/main/graph/badge.svg)](https://codecov.io/gh/zowe/zowe-explorer-vscode)
[![slack](https://img.shields.io/badge/chat-on%20Slack-blue)](https://slack.openmainframeproject.org/)

> All previous versions of Zowe Explorer for Visual Studio Code&trade; can be downloaded from [Zowe Explorer GitHub Releases](https://github.com/zowe/zowe-explorer-vscode/releases).

## Introduction

[Zowe Explorer for VS Code](https://github.com/zowe/community#zowe-explorer) provides access to mainframe resources in Visual Studio Code. Zowe Explorer provides a modern, familiar, user-friendly interface that enables mainframe developers and system programmers to:

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

Use various services to communicate with system resources and extract system data on the mainframe:

- z/OSMF
   - See [z/OSMF documentation](https://www.ibm.com/docs/en/zos/3.1.0?topic=guide-using-zosmf-rest-services) for more information.
- FTP
   - This connection is available with the [Zowe Explorer FTP Extension](https://docs.zowe.org/stable/user-guide/ze-ftp-using-ze-ftp-ext).
   - See [FTP documentation](https://www.ibm.com/docs/en/zos/3.1.0?topic=applications-transferring-files-using-ftp) for more information.


There are multiple extensions that offer additional protocols and functionality. See the Explorer for Visual Studio Code Zowe V3 section in the [Zowe V2 and V3 Conformant Landscape](https://omp.landscape2.io/embed/embed.html?base-path=&classify=category&key=zowe-conformant&headers=true&category-header=false&category-in-subcategory=false&title-uppercase=false&title-alignment=left&title-font-family=sans-serif&title-font-size=13&style=shadowed&bg-color=%230033a1&fg-color=%23ffffff&item-modal=false&item-name=true&size=md&items-alignment=left&item-name-font-size=11) for a complete list of conformant extensions.

## Getting started

Configure Zowe Explorer for VS Code and confirm you are able to access the mainframe with your _team configuration_.

### Configuring Zowe Explorer for VS Code

Configure Zowe Explorer for VS Code by changing the extension settings. For more information, see [Configuring Zowe Explorer](https://docs.zowe.org/stable/user-guide/ze-install-configuring-ze).

### Confirming your team configuration

Team configuration stores connection information to access the mainframe. Check that you have your team configuration in place.

If you are missing your team configuration files, `zowe.config.json` and `zowe.schema.json`, work with your administrator to set them up.

- Your team configuration is in place when:
   - Selecting the **+** icon in the headers of the **DATA SETS**, **UNIX SYSTEM SERVICES**, or **JOBS** tree views presents options in the **Quick Pick** to edit your configuration file or, if available, use an existing profile.

- You do not have team configuration when:
   - A pop-up message displays advising that client configurations were not found.
   - A **Search** icon does not display in the headers of the **DATA SETS**, **UNIX SYSTEM SERVICES**, or **JOBS** tree views. Select the **+** icon to create team configuration. 

### Creating a team configuration file

A team configuration file stores connection information to mainframe services in *profiles*, making team configuration easy to maintain and share with others in your organization.

Team configuration should be created by an administrator or team lead who understands what connection information is needed and can efficiently manage it. When setting up team configuration, it is important to understand your team's requirements for use and the options available to ensure these are met.

Refer to Zowe Docs for documentation on understanding and implementing team configuration:

- [Team configuration](https://docs.zowe.org/stable/user-guide/cli-using-using-team-profiles) overview
- [Creating Zowe Explorer profiles](https://docs.zowe.org/stable/user-guide/ze-profiles)

**Note**: Team configuration can apply across three core components of the Zowe project, Zowe Explorer for VS Code, Zowe Explorer for IntelliJ IDEA, and Zowe CLI.

### Using profiles for the first time

The first time a team configuration profile is used, you are prompted for a user name and password for the profile's connection.

The term _password_ is used loosely to represent all supported authentication secrets, such as passphrases, passtickets, Multifactor Authentication (MFA) tokens, etc.

### Updating securely stored credentials

Secure fields in the team configuration file are handled by the Zowe Imperative dependency.

To update securely stored user names and passwords in Zowe Explorer:

1. Right click the profile and select **Manage Profile**.
2. Select **Update Credentials** from the **Quick Pick**.

   You are prompted for the new credentials and these are saved to the secure credentials vault.

## Other authentication methods

Zowe Explorer for VS Code supports multiple authentication methods including basic authentication, multi-factor authentication, tokens, and certificates. See [Zowe Docs](https://docs.zowe.org/stable/user-guide/ze-authentication-methods) for more information about these other authentication methods.

## Usage tips

Make the best use of Zowe Explorer for VS Code with these [usage tips](https://docs.zowe.org/stable/user-guide/ze-usage-tips).

See Zowe Docs for a complete list of use cases explaining how to work with [data sets](https://docs.zowe.org/stable/user-guide/ze-working-with-data-sets), [USS files](https://docs.zowe.org/stable/user-guide/ze-working-with-uss-files), and [jobs](https://docs.zowe.org/stable/user-guide/ze-working-with-jobs) in Zowe Explorer for VS Code.

## Keyboard Shortcuts

- Restart Zowe Explorer

  - Windows: `ctrl`+`alt`+`z`
  - Mac: `⌘`+`⌥`+`z`

- Open Recent Member

  - Windows: `ctrl`+`alt`+`t`
  - Mac: `⌘`+`⌥`+`t`

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
