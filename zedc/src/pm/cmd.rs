//! Command module for handling `pkg-manager` commands.

use super::{detect_pkg_mgr, pkg_mgr};
use crate::util::find_dir_match;
use anyhow::bail;

/// Handles the logic for the `zedc pkg-manager [pm]` command.  
/// Forwards commands to the appropriate package manager for the current branch.
///
/// # Arguments
/// * `args` - Vector of arguments to pass to the package manager
pub fn handle_cmd(args: Vec<String>) -> anyhow::Result<String> {
    let ze_dir = match find_dir_match(&["package.json"]) {
        Ok(d) => match d {
            Some(d) => d,
            None => bail!("Could not find a repo folder containing package.json."),
        },
        Err(_) => bail!("Could not find a repo folder containing package.json."),
    };

    match pkg_mgr(detect_pkg_mgr(&ze_dir)?.as_str())
        .args(args)
        .current_dir(&ze_dir)
        .output()
    {
        Ok(str) => Ok(String::from_utf8_lossy(&str.stdout).to_string()),
        Err(e) => bail!(e),
    }
}
