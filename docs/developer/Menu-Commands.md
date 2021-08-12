# Adding Commands to Zowe Explorer Menus

This page contains developer guidance specific to adding commands in core Zowe Explorer. For more general guidance on how to add a command in VS Code, see the [VS Code Commands Extension Guide](https://code.visualstudio.com/api/extension-guides/command).

## Contents

- [Defining a new command](#defining-a-new-command)
- [Contributing menu items](#contributing-menu-items)
- [Menu group naming conventions](#menu-group-naming-conventions)

## Defining a new command

In order to add a command to a core Zowe Explorer menu, the command must first be defined in `packages/zowe-explorer/package.json`, under [`contributes.commands`](https://code.visualstudio.com/api/references/contribution-points#contributes.commands). The following conventions should be used when defining the respective command properties:

- **`command`** property: For each Zowe Explorer view in which a command can be used (i.e. Data Sets, USS, or Jobs view), one of the prefixes in the table below should be added to the front of the `command` property to indicate what Zowe Explorer view the command applies to.

  | Prefix                | Applicable view | Example usage           |
  | --------------------- | --------------- | ----------------------- |
  | `zowe.ds.<command>`   | Data Sets       | `zowe.ds.addFavorite`   |
  | `zowe.uss.<command>`  | USS             | `zowe.uss.addFavorite`  |
  | `zowe.jobs.<command>` | Jobs            | `zowe.jobs.addFavorite` |

- **`title`** property: Be sure to localize the command's title. This can be done by following the steps for adding a new string to the `package.json` file in the [Developer's ReadMe](https://github.com/zowe/vscode-extension-for-zowe/blob/master/docs/Developer's%20ReadMe.md#adding-strings).

  - **Tip:** When choosing the command's key name, consider prefixing it with `ds.`, `uss.`, or `jobs.` to indicate if the key is for the Data Sets, USS, or Jobs view, respectively. (For example, the key `%uss.addFavorite%` is used for the `addFavorite` command in the USS view.) If the command is more related to profiles than to a specific view, consider prefixing the key name with `profile.`.

- **`category`** property: The value of this should be "Zowe Explorer".

**Note:** If the command being added is not designed to work from the Command Palette, be sure to add an entry for the command in the `contributes.menus.commandPalette` section of `packages/zowe-explorer/package.json`, and specify `"when": "never"`. Otherwise, the command will appear in the Command Palette by default, and may cause errors or other unexpected behavior. (For more details, see VS Code's documentation on [specifying command visibility in the Command Palette](https://code.visualstudio.com/api/references/contribution-points#Context-specific-visibility-of-Command-Palette-menu-items).)

## Contributing menu items

Context menus appear when the user right-clicks on an item (for example, a data set or profile). For Zowe Explorer, commands are most commonly added to the menus that appear in its three tree views (Data Sets, USS, and Jobs). To add a command into these views, create an entry for the [defined command](#defining-a-new-command) in the `contributes.menus.view/item/context` section of `packages/zowe-explorer/package.json`.

- If adding a command to a Zowe Explorer context menu, be sure to assign a value to the `group` property of the entry. This helps provide visual separation between different command categories in the UI. You can see examples of context menu groups in the current menu items in Zowe Explorer's `package.json`. Follow the steps below when assigning an entry's `group` property:

  1. First, check the `package.json` to see if there is an existing context menu group that the new command can intuitively be categorized under (from an end-user's perspective).
  1. If the new command does not fit under any existing context menu groups, create a new context menu group by assigning the `group` property a new value that follows [Zowe Explorer's menu group naming conventions](#menu-group-naming-conventions).

For general technical details on grouping context menu items, see the [VS Code documentation](https://code.visualstudio.com/api/references/contribution-points#Sorting-of-groups).

## Menu group naming conventions

The prefix `0##_zowe_` is reserved for use with core Zowe Explorer command groups (per the Zowe Explorer extender conformance criteria). Group names for Zowe Explorer are formatted as follows: `0##_zowe_<view><groupSpecifier>`. For example, commands related to creating items in Zowe Explorer's Data Sets view are in the group named `001_zowe_dsCreate`.

A breakdown of this naming convention is described below.

- `0##` represents a number from 000 - 099. Command groups are organized alphabetically in VS Code, and this numbering helps Zowe Explorer's context menu groups stay in a predefined order that makes sense in the user interface (UI).
- `_zowe_`is constant between command group names. This is used to help ensure that Zowe Explorer's command groups stay together when displayed in the UI.
- `<view>` represents which of Zowe Explorer's views the command group applies to.
  - `ds`: Use this to specify a command group for the Data Sets view.
  - `uss`: Use this to specify a command group for the USS view.
  - `jobs`: Use this to specify a command group for the Jobs view.
- `<groupSpecifier>` is a short name describing of what types functional commands the group contains. See below for the current group specifiers used by Zowe Explorer, as well as some examples for each:
  - `Workspace`: Commands related to workspace manipulation.
    - Examples: Add/Remove favorites
  - `MainframeInteraction`: Commands related to interacting with the mainframe in general.
    - Examples: Search, Issue command, Download from mainframe, Download spool
  - `Create`: Commands related to creation of files or folders.
    - Examples: Create data set, Upload data set member, Create/Upload file or directory
    - This category also includes commands related to copying and pasting files.
  - `Modification`: Commands related to modification of files or folders. (Not for profiles.)
    - Examples: Rename/Delete data set or file
  - `SystemSpecific`: Commands specific to the Data Sets, USS, or Jobs view.
    - Examples: Toggle binary (USS), Copy path (USS), Issue stop command (Jobs)
  - `ProfileAuthentication`: Commands related to authentication of profiles.
    - Examples: Login, Logout, Enable/Disable validation
  - `ProfileModification`: Commands related to modification of profiles.
    - Examples: Update profile, Hide profile, Delete profile
