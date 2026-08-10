//! "Root" module containing all related logic for the `setup` command.

use anyhow::{bail, Context};
use homedir::get_my_home;
use owo_colors::OwoColorize;
use std::{
    io::Write,
    path::{Path, PathBuf},
    process::{Command, Stdio},
};
use tokio::{fs::OpenOptions, io::AsyncWriteExt};

mod cmd;
pub use cmd::handle_cmd;

/// Activates the given package manager using `corepack`.
///
/// # Arguments
/// * `pkg_mgr` - The name of the package manager to activate (`pnpm, yarn`)
pub fn activate_pkg_mgr(pkg_mgr: &String) -> anyhow::Result<()> {
    match crate::pm::corepack().arg("enable").arg(pkg_mgr).output() {
        Ok(_) => {
            if crate::output::text_enabled() {
                println!("✔️  {} setup complete", pkg_mgr);
            }
        }
        Err(_) => {
            bail!(
                "❌ Error activating {} using corepack. Please open a new shell and try again."
                    .red()
            );
        }
    }

    Ok(())
}

/// Installs Node.js using `cargo` and `fnm`.
pub async fn install_node() -> anyhow::Result<()> {
    match Command::new("cargo")
        .args(["install", "fnm"])
        .stdout(Stdio::null())
        .status()
    {
        Ok(_) => {
            if crate::output::text_enabled() {
                println!("✔️  Installed fnm");
            }
            // TODO: Look into updating this - would like to avoid updating shell profiles if needed
            let mut bashrc = OpenOptions::new()
                .create(true)
                .append(true)
                .write(true)
                .open(get_my_home().unwrap().unwrap_or("~".into()).join(".bashrc"))
                .await?;
            bashrc.write_all(b"eval \"$(fnm env --use-on-cd)\"").await?;
            if let Err(_e) = Command::new("fnm").arg("install").arg("18").status() {
                bail!("'fnm install 18' failed");
            }
        }
        Err(_) => {
            bail!("zedc setup requires Rust in order to install Node.js.\nPlease install it before continuing.".red());
        }
    };

    Ok(())
}

/// Setup function that looks for the presence of Node.js with the `node --version` command.
/// * If present, it attempts to activate the given package manager using `corepack`
/// * If not present, it attempts to install Node.js using `cargo` and `fnm`
///
/// # Arguments
/// * `pkg_mgr` - The package manager to setup
pub async fn setup_node_with_pkg_mgr(pkg_mgr: &String) -> anyhow::Result<()> {
    match Command::new("node")
        .arg("--version")
        .stderr(Stdio::null())
        .output()
    {
        Ok(out) => {
            let mut ver = String::from_utf8(out.stdout)?;
            crate::util::trim_newline(&mut ver);
            if crate::output::text_enabled() {
                println!("✔️  Found node {}", ver);
            }
            activate_pkg_mgr(pkg_mgr)?;
        }
        Err(_) => {
            if crate::output::text_enabled() {
                println!("\t❌ No Node.js installation found - installing...");
            }
            install_node().await?;
            activate_pkg_mgr(pkg_mgr)?;
        }
    }

    Ok(())
}

/// Setup initialization function for Node.js and the current package manager.
///
/// # Arguments
/// * `ze_dir` - The path to the Zowe Explorer repo
pub async fn setup_pkg_mgr(ze_dir: PathBuf) -> anyhow::Result<String> {
    let pkg_mgr = crate::pm::detect_pkg_mgr(&ze_dir)?;

    // Check if the package manager exists
    match crate::pm::pkg_mgr(&pkg_mgr)
        .arg("--version")
        .stderr(Stdio::null())
        .output()
    {
        Ok(out) => {
            let mut ver = String::from_utf8(out.stdout)?;
            crate::util::trim_newline(&mut ver);
            if crate::output::text_enabled() {
                println!("✔️  Using {} {}", pkg_mgr, ver);
            }
        }
        Err(_) => {
            if crate::output::json_enabled() {
                bail!(
                    "{} was not found. Run `zedc setup` without `--json` to install it.",
                    pkg_mgr
                );
            }
            // Package manager was not found, prompt for installation
            print!(
                "❌ {} was not found. Would you like to install it? (y/N) ",
                pkg_mgr.bold()
            );
            std::io::stdout().flush()?;
            let mut line = String::new();
            std::io::stdin()
                .read_line(&mut line)
                .expect("Unable to read user input");
            crate::util::trim_newline(&mut line);
            line = line.trim().to_owned();

            match line.as_str() {
                "y" | "Y" | "yes" => {
                    setup_node_with_pkg_mgr(&pkg_mgr).await?;
                }
                _ => {
                    bail!("User cancelled setup.");
                }
            }
        }
    }

    Ok(pkg_mgr)
}

/// Removes root and package-level `node_modules` folders before a fresh dependency install.
pub async fn clean_node_modules(ze_dir: &Path) -> anyhow::Result<()> {
    let mut dirs = Vec::new();
    let root_node_modules = ze_dir.join("node_modules");
    if tokio::fs::try_exists(&root_node_modules).await? {
        dirs.push(root_node_modules);
    }

    let packages_dir = ze_dir.join("packages");
    if tokio::fs::try_exists(&packages_dir).await? {
        let mut entries = tokio::fs::read_dir(&packages_dir)
            .await
            .with_context(|| format!("Failed to read {}", packages_dir.display()))?;
        while let Some(entry) = entries.next_entry().await? {
            if entry.file_type().await?.is_dir() {
                let node_modules = entry.path().join("node_modules");
                if tokio::fs::try_exists(&node_modules).await? {
                    dirs.push(node_modules);
                }
            }
        }
    }

    if dirs.is_empty() {
        return Ok(());
    }

    if crate::output::text_enabled() {
        println!("🧹 Cleaning node_modules...");
    }
    for dir in dirs {
        tokio::fs::remove_dir_all(&dir)
            .await
            .with_context(|| format!("Failed to remove {}", dir.display()))?;
    }

    Ok(())
}
