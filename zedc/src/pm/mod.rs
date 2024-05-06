use std::{path::PathBuf, process::Command};

mod cmd;
pub use cmd::handle_cmd;

pub fn npm() -> Command {
    pkg_mgr("npm")
}

pub fn corepack() -> Command {
    pkg_mgr("corepack")
}

pub fn detect_pkg_mgr(ze_dir: &PathBuf) -> anyhow::Result<String> {
    if ze_dir.join("pnpm-lock.yaml").exists() {
        return Ok("pnpm".to_owned());
    }

    if ze_dir.join("yarn.lock").exists() {
        return Ok("yarn".to_owned());
    }

    // fallback to yarn; v3 branch has only-allow which will redirect to pnpm
    Ok("yarn".to_owned())
}

pub fn pkg_mgr(name: &str) -> Command {
    #[cfg(windows)]
    return Command::new(format!("{}.cmd", name));
    #[cfg(not(windows))]
    return Command::new(name);
}
