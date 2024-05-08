//! "Root" module containing all related logic for the `pkg-manager` command.

use std::{path::Path, process::Command};

mod cmd;
pub use cmd::handle_cmd;

/// Returns the appropriate file name for `npm` on the current machine.
pub fn npm() -> Command {
    pkg_mgr("npm")
}

/// Returns the appropriate file name for `corepack` on the current machine.
pub fn corepack() -> Command {
    pkg_mgr("corepack")
}

/// Detects and returns the name of the package manager used for the current branch.
pub fn detect_pkg_mgr(ze_dir: &Path) -> anyhow::Result<String> {
    if ze_dir.join("pnpm-lock.yaml").exists() {
        return Ok("pnpm".to_owned());
    }

    if ze_dir.join("yarn.lock").exists() {
        return Ok("yarn".to_owned());
    }

    // fallback to `yarn`; ZE v3 branch uses `only-allow`, which will redirect commands to `pnpm`
    Ok("yarn".to_owned())
}

/// Returns the appropriate file name for the given package manager on the current machine.
///
/// # Arguments
/// * `name` - The name of the package manager (`npm, pnpm, yarn`)
pub fn pkg_mgr(name: &str) -> Command {
    #[cfg(windows)]
    return Command::new(format!("{}.cmd", name));
    #[cfg(not(windows))]
    return Command::new(name);
}
