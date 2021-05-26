# Adding Commands to Zowe Explorer Menus

This page contains developer guidance specific to adding commands in core Zowe Explorer. For more general guidance on how to add a command in VS Code, see the [VS Code Commands Extension Guide](https://code.visualstudio.com/api/extension-guides/command).

## Contents

- [Defining a new command](#defining-a-new-command)
- [Contributing context menu items](#contributing-context-menu-items)

## Defining a new commmand

In order to add a command to a core Zowe Explorer menu, the command must first be defined in `packages/zowe-explorer/package.json`, under [`contributes.commands`](https://code.visualstudio.com/api/references/contribution-points#contributes.commands). The following conventions should be used when defining the respective command properties:

- `command` property: If the command is specific to one of Zowe Explorer's views (i.e. Data Sets, USS, or Jobs view), one of the prefixes in the table below should be added at the front of this property's value to indicate what Zowe Explorer view the command applies to.

  | Prefix                | Applicable view | Example usage           |
  | --------------------- | --------------- | ----------------------- |
  | `zowe.<command>`      | Data Sets       | `zowe.addFavorite`      |
  | `zowe.uss.<command>`  | USS             | `zowe.uss.addFavorite`  |
  | `zowe.jobs.<command>` | Jobs            | `zowe.jobs.addFavorite` |

- `title` property: Be sure to localize the command title's value. This can be done by following the steps below:

  1. Create a concise, descriptive key for the title string and wrap it in `%` on each side. Consider prefixing the key name with `mvs.`, `uss.`, or `jobs.` to indicate if the key is for the Data Sets, USS, or Jobs view, respectively. (For example, the key `%uss.addFavorite%` is used for the `addFavorite` command in the USS view.) If the command is more related to profiles than a specific view, consider prefixing the key name with `profile.`.
  1. in `package.nls.json`, define the user-facing string for the key. (For example: `"uss.addFavorite": "Add to Favorites"`.)

  - More details on localization can be found in the [Developer's ReadMe](https://github.com/zowe/vscode-extension-for-zowe/blob/master/docs/Developer's%20ReadMe.md#adding-strings).

- `category` property: The value of this should be "Zowe Explorer".

## Contributing context menu items

Context menus appear when the user right-clicks on an item (for example, a data set or profile). Commands can be added into the context menus by creating an entry for a [defined command](#defining-a-new-command) in the `menus contributes.menus.view/item/context` section of `packages/zowe-explorer/package.json`.

- If adding a command to a Zowe Explorer context menu, be sure to assign a value to the `group` property of the entry. This helps provide visual separation between different command categories in the UI. You can see examples of context menu groups in the current menu items in Zowe Explorer's `package.json`. Follow the steps below when assigning an entry's `group` property:

  1. First, check the `package.json` to see if there is an existing context menu group that the new command can intuitively be categorized under (from an end-user's perspective).
  1. If the new command does not fit under any existing context menu groups, create a new context menu group by assigning the `group` property a new value that follows [Zowe Explorer's context menu group naming convention](#zowe-explorer-context-menu-group-naming-convention).

For general technical details on grouping context menu items, see the following VS Code documentation:

- [Sorting context menu groups](https://code.visualstudio.com/api/references/contribution-points#Sorting-of-groups)
- [Sorting commands within a context menu group](https://code.visualstudio.com/api/references/contribution-points#Sorting-inside-groups)

### Zowe Explorer context menu group naming convention

The prefix `##_zowe_` is reserved for use with core Zowe Explorer command groups. Group names for Zowe Explorer are formatted as follows: `##_zowe_<view><groupSpecifier>`. For example, commands related to creating items in Zowe Explorer's Data Sets view are in the group named `01_zowe_mvsCreate`.

A breakdown of this naming convention is described below.

- `##` represents a number from 00 - 99. Command groups are organized alphabetically in VS Code, and this numbering helps Zowe Explorer's context menu groups stay in a predefined order that makes sense in the user interface (UI).
- `_zowe_`is constant between command group names. This is used to help ensure that Zowe Explorer's command groups stay together when displayed in the UI.
- `<view>` represents which of Zowe Explorer's views the command group applies to.
  - `mvs`: Use this to specify a command group for the Data Sets view.
  - `uss`: Use this to specify a command group for the USS view.
  - `jobs`: Use this to specify a command group for the Jobs view.
- `<groupSpecifier>` is a short name describing of what types functional commands the group contains. See below for the current group specifiers used by Zowe Explorer, as well as some examples for each:
  - `Workspace`: Commands related to workspace manipulation.
    - Examples: Add/Remove favorites
  - `MainframeInteraction`: Commands related to interacting with the mainframe in general.
    - Examples: Search, Issue command, Download from mainframe, Download spool
  - `Create`: Commands related to creation of files or folders.
    - Examples: Create data set, Upload data set member, Create/Upload file or directory
  - `MvsHsmCommands`: Commands for HSM commands for data sets.
    - Examples: Migrate/Recall data sets
  - `CutCopyPaste`: Commands related to cutting, copying, and pasting of files or paths.
    - Examples: Copy member/data set, Copy path, Paste
  - `Modification`: Commands related to modification of files or folders. (Not for profiles.)
    - Examples: Rename/Delete data set or file
  - `SystemSpecific`: Commands specific to the Data Sets, USS, or Jobs view.
    - Examples: Toggle binary (USS), Issue stop command (Jobs)
  - `ProfileAuthentication`: Commands related to authentication of profiles.
    - Examples: Login, Logout, Enable/Disable validation
  - `ProfileModification`: Commands related to modification of profiles.
    - Examples: Update profile, Hide profile, Delete profile
