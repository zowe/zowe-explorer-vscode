//! "Root" module containing all related logic for the `setup` command.

use anyhow::bail;
use homedir::get_my_home;
use owo_colors::OwoColorize;
use std::{
    io::Write,
    path::PathBuf,
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
            println!("✔️  {} setup complete", pkg_mgr);
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
            println!("✔️  Installed fnm");
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
            println!("✔️  Found node {}", ver);
            activate_pkg_mgr(pkg_mgr)?;
        }
        Err(_) => {
            println!("\t❌ No Node.js installation found - installing...");
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
            println!("✔️  Using {} {}", pkg_mgr, ver);
        }
        Err(_) => {
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
