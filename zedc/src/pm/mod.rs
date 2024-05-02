use std::{path::Path, process::Command};

use anyhow::bail;

pub fn npm() -> Command {
    pkg_mgr("npm")
}

pub fn detect_pkg_mgr() -> anyhow::Result<String> {
    let cur_dir = Path::new("../");
    if cur_dir.join("pnpm-lock.yaml").exists() {
        return Ok("pnpm".to_owned());
    }

    if cur_dir.join("yarn.lock").exists() {
        return Ok("yarn".to_owned());
    }

    bail!("Unable to detect package manager.")
}

pub fn pkg_mgr(name: &str) -> Command {
    #[cfg(windows)]
    return Command::new(format!("{}.cmd", name));
    #[cfg(not(windows))]
    return Command::new(name);
}
