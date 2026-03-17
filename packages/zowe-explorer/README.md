# Zowe Explorer for Visual Studio Code

[![version](https://img.shields.io/visual-studio-marketplace/v/Zowe.vscode-extension-for-zowe.svg)](https://img.shields.io/visual-studio-marketplace/v/Zowe.vscode-extension-for-zowe.svg)
[![downloads](https://img.shields.io/visual-studio-marketplace/d/Zowe.vscode-extension-for-zowe.svg)](https://img.shields.io/visual-studio-marketplace/d/Zowe.vscode-extension-for-zowe.svg)
[![codecov](https://codecov.io/gh/zowe/zowe-explorer-vscode/branch/main/graph/badge.svg)](https://codecov.io/gh/zowe/zowe-explorer-vscode)
[![slack](https://img.shields.io/badge/chat-on%20Slack-blue)](https://slack.openmainframeproject.org/)

> All previous versions of Zowe Explorer for Visual Studio Code&trade; can be downloaded from [Zowe Explorer GitHub Releases](https://github.com/zowe/zowe-explorer-vscode/releases).

[Zowe Explorer for VS Code](https://github.com/zowe/community#zowe-explorer) provides access to mainframe resources in Visual Studio Code. Zowe Explorer provides a modern, familiar, user-friendly interface that enables mainframe developers and system programmers to:

- Manage data sets and USS files on a z/OS mainframe with browse, create, modify, rename, copy, and upload functionality
- Submit JCL and view job output
- Apply other VS Code extensions for things like syntax highlighting, debugging, and IntelliSense to improve the developer experience

<br>

> [Share an idea or open an issue in our Git repository](https://github.com/zowe/zowe-explorer-vscode/issues) to help improve Zowe Explorer or report an issue.

### Other ways to connect

- Join the **#zowe-explorer-vscode** channel on [Slack](https://openmainframeproject.slack.com/) to stay in touch with the Zowe community.
- To translate Zowe Explorer into your language, join our [POEditor project](https://poeditor.com/join/project/Siy3KCNFKk).
- For the complete Zowe Explorer documentation, see [Zowe Docs](https://docs.zowe.org/stable/user-guide/ze-install.html).

<details>
<summary><span style="font-size: 1.5em"><b>Addressing system requirements</b></span><hr></summary>

Before you use Zowe Explorer, ensure that you meet the following prerequisites:

### Client side requirements

#### Operating systems

- macOS

  Note: Only Mac operating system versions supported by Apple.

- Unix-like:
  - [CentOS](https://www.centos.org/) 8+
  - [RHEL](https://www.redhat.com/en/technologies/linux-platforms/enterprise-linux) 8+
  - [Ubuntu](https://ubuntu.com/) 20.04+
- Windows 10+

#### Integrated development environments

- [Red Hat CodeReady Workspaces](https://www.redhat.com/en/technologies/jboss-middleware/codeready-workspaces)

  Note: Secure credentials are not supported in Red Hat CodeReady Workspaces as the keyring is not unlocked by default. However, you can use the [Kubernetes Secrets plug-in for Zowe CLI or Zowe® Explorer for Kubernetes® Secrets](https://github.com/zowe/zowe-cli-secrets-for-kubernetes/blob/main/README.md) as an alternative, or you can create your own [Custom Credential Managers in Zowe Explorer and Zowe CLI](https://medium.com/zowe/custom-credential-managers-in-zowe-explorer-b37faeee4c29).

- [VS Code](https://code.visualstudio.com/) 1.90.0+

  Note: Only VS Code versions that bundle actively maintained versions of Node.js are supported.

### Server side requirements

- IBM z/OSMF is configured and running.
  - See [z/OSMF REST services for Zowe clients](../user-guide/systemrequirements-zosmf.md#zosmf-rest-services-for-zowe-clients) for a list of services that need configuration.
- Applicable plug-in services are configured and running on the mainframe.
  - Plug-ins communicate with various mainframe services. The services must be configured and running on the mainframe before issuing plug-in commands.
    - See [Zowe® Explorer for IBM® CICS® Transaction Server system requirements](./install-ze-extensions.md#zowe-explorer-for-ibm-cics-transaction-server-system-requirements).
    - See [Zowe® Explorer for IBM® z/OS® FTP system requirements](./install-ze-extensions.md#zowe-explorer-for-ibm-zos-ftp-system-requirements).

</details>

<details>
<summary><span style="font-size: 1.5em"><b>Getting started</b></span><hr></summary>

### Prerequisite tasks

- Use various services to communicate with system resources and extract system data on the mainframe:
  - z/OSMF
    - See [z/OSMF documentation](https://www.ibm.com/docs/en/zos/3.1.0?topic=guide-using-zosmf-rest-services) for more information.
  - FTP
    - This connection is available with the [Zowe Explorer FTP Extension](https://docs.zowe.org/stable/user-guide/ze-ftp-using-ze-ftp-ext).
    - See [FTP documentation](https://www.ibm.com/docs/en/zos/3.1.0?topic=applications-transferring-files-using-ftp) for more information.

  - There are multiple extensions that offer additional protocols and functionality. See the Explorer for Visual Studio Code Zowe V3 section in the [Zowe V2 and V3 Conformant Landscape](https://omp.landscape2.io/embed/embed.html?base-path=&classify=category&key=zowe-conformant&headers=true&category-header=false&category-in-subcategory=false&title-uppercase=false&title-alignment=left&title-font-family=sans-serif&title-font-size=13&style=shadowed&bg-color=%230033a1&fg-color=%23ffffff&item-modal=false&item-name=true&size=md&items-alignment=left&item-name-font-size=11) for a complete list of conformant extensions.

### Customizing extension settings

- Configure Zowe Explorer by changing the extension settings. For more information, see [Configuring Zowe Explorer](https://docs.zowe.org/stable/user-guide/ze-install-configuring-ze).

### Confirming your team configuration

Team configuration stores connection information to access the mainframe. Check that you have your team configuration in place.

- Your team configuration is in place when:
  - Selecting the **+** icon in the headers of the **DATA SETS**, **UNIX SYSTEM SERVICES**, or **JOBS** tree views presents options in the **Quick Pick** to edit your configuration file or, if available, use an existing profile.

- You do not have team configuration when:
  - A pop-up message displays advising that client configurations were not found.
  - A **Search** icon does not display in the headers of the **DATA SETS**, **UNIX SYSTEM SERVICES**, or **JOBS** tree views. Select the **+** icon to create team configuration.

If you are missing your team configuration files, `zowe.config.json` and `zowe.schema.json`, work with your administrator to set them up.

### Creating a team configuration file

A team configuration file stores connection information to mainframe services in profiles, making team configuration easy to maintain and share with others in your organization.

Team configuration should be created by an administrator or team lead who understands what connection information is needed and can efficiently manage it. When setting up team configuration, it is important to understand your team's requirements for use and the options available to ensure these are met.

Refer to Zowe Docs for documentation on understanding and implementing team configuration:

- [Team configuration](https://docs.zowe.org/stable/user-guide/cli-using-using-team-profiles) overview
- [Creating Zowe Explorer profiles](https://docs.zowe.org/stable/user-guide/ze-profiles)

**Note**: Team configuration can apply across three core components of the Zowe project: Zowe Explorer for VS Code, Zowe Explorer for IntelliJ IDEA, and Zowe CLI.

### Using profiles for the first time

The first time a team configuration profile is used, you are prompted for a user name and password for the profile's connection.

The term _password_ is used loosely to represent all supported authentication secrets, such as passphrases, passtickets, Multifactor Authentication (MFA) tokens, etc.

### Updating securely stored credentials

Secure fields in the team configuration file are handled by the Zowe Imperative dependency.

To update securely stored user names and passwords in Zowe Explorer:

1. Right click the applicable profile and select **Manage Profile**.
2. Select **Update Credentials** from the **Quick Pick**.

   You are prompted for the new credentials and these are saved to the secure credentials vault.

### Other authentication methods

Zowe Explorer for VS Code supports multiple authentication methods including basic authentication, multi-factor authentication, tokens, and certificates. See [Zowe Docs](https://docs.zowe.org/stable/user-guide/ze-authentication-methods) for more information about these other authentication methods.

### Keyboard shortcuts

- Restart Zowe Explorer
  - Windows: `ctrl`+`alt`+`z`
  - Mac: `⌘`+`⌥`+`z`

- Open Recent Member
  - Windows: `ctrl`+`alt`+`t`
  - Mac: `⌘`+`⌥`+`t`

- Search in all Loaded Items
  - Windows: `ctrl`+`alt`+`p`
  - Mac: `⌘`+`⌥`+`p`

</details>
<details>
<summary><span style="font-size: 1.5em"><b>Editing and uploading a data set member</b></span><hr></summary>

1. Expand the **DATA SETS** tree in the **Side Bar**.

2. Click on the **Search** icon next to a profile to search for a pattern that matches the data set that you want to view.

   Search results display under the profile in the **Side Bar**.

3. Open the data set with the member you want to edit.
4. Click on the member name to display it in an **Editor**.
5. Edit the document in the **Editor**.
6. Press the `Ctrl`+`S` or `Command`+`S` keys to save the changes.

   The changes are saved and the edited data set is uploaded to the mainframe.

   Note: If someone else has made changes to the data set member while you were editing, you can merge your changes before uploading to the mainframe. See [Preventing merge conflicts](#preventing-merge-conflicts) for more information.

</details>

<details>
<summary><span style="font-size: 1.5em"><b>Downloading spool content</b></span><hr></summary>

### Downloading spool files from a job

1. Expand the **JOBS** tree in the **Side Bar**.
2. Click on the **Search** icon next to a profile and enter search criteria.

   Search results display under the profile in the **Side Bar**.

3. Right-click on the desired job and select either:
   - **Download All** to download all the spool files to a folder on your local disk.
   - **Download All (Binary)** to download all the spool files in binary format on your local disk.

   The selected files are saved in a folder that is the job name in the specified location.

### Downloading a single spool file

1. Expand the **JOBS** tree in the **Side Bar**.
2. Click on the **Search** icon next to a profile and enter search criteria.

   Search results display under the profile in the **Side Bar**.

3. Expand the job containing the desired spool file.
4. Right-click on the spool file and select either:
   - **Download All** to download all the spool file contents to a folder on your local disk.
   - **Download All (Binary)** to download all the spool file contents in binary format on your local disk.

   The selected file is saved in the specified location.

</details>

<details>
<summary><span style="font-size: 1.5em"><b>Extending Zowe Explorer</b></span><hr></summary>

You can add new functionalities to Zowe Explorer by creating your own extension. For more information, see [Extensions for Zowe Explorer](https://github.com/zowe/zowe-explorer-vscode/wiki/Extending-Zowe-Explorer).

**Tip:** View an example of a Zowe Explorer extension in the [Zowe Explorer FTP extension documentation](https://github.com/zowe/zowe-explorer-vscode#available-documentation).

</details>
<details>
<summary><span style="font-size: 1.5em"><b>Known issues</b></span><hr></summary>

### Bidirectional languages

Files written in languages primarily read from right to left (Arabic, Hebrew, many Asian languages) can include portions of text that are written and read left to right, such as numbers.

These bidirectional (BiDi) languages are not currently supported in Visual Studio Code. (See [Issue #86667](https://github.com/microsoft/vscode/issues/86667) for more information.)

As a result, VS Code extensions like Zowe Explorer, Zowe Explorer CICS Extension, and Zowe Explorer FTP Extension are not able to support BiDi languages in files.

</details>
