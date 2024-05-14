# Zowe Explorer Development CLI

A lightweight CLI that can be used to facilitate Zowe Explorer development and testing.

## Requirements

- `cmake, gcc`
- Git Bash
- Rust
- Windows, macOS or Linux

## Installation

- Build using Cargo: `cargo build --release`
- Copy the `zedc` binary from the `target/release` folder into its own folder
- Add the folder for `zedc` to your `PATH` environment variable.

## Command overview

To view all available commands and arguments, run the command `zedc <command_name>` to view the built-in help. You can also run `zedc` to display all available top-level commands.

- `setup`
  - checkout a Git ref (optional)
  - clean `node_modules`
  - install the dependencies using the correct package manager
- `pm`
  - forwards commands to the package manager for the current branch
- `test` - test a local VSIX or an artifact from GitHub using a Git ref
  - extracts a portable version of VS Code
  - installs the given dependencies
  - opens VS Code with `ZOWE_CLI_HOME` set to the sandboxed directory (so it doesn't affect your global configuration)
  - caches VS Code versions so that existing versions are not re-downloaded
