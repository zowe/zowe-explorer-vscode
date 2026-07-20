//! Command module for handling `setup` commands.

use std::process::{Command, Stdio};

use super::setup_pkg_mgr;
use anyhow::bail;
use owo_colors::OwoColorize;

/// Handles the logic for the `zedc setup` command.  
/// Forwards commands to the appropriate command handler for sub-commands.
///
/// # Arguments
/// * `reference` - (optional) A reference to checkout using Git before performing the setup.
pub async fn handle_cmd(reference: Option<String>) -> anyhow::Result<()> {
    let text = crate::output::text_enabled();
    if text {
        println!("{}\n", "zedc setup".bold());
    }

    // Locate the Zowe Explorer repo (relative to the current path) before continuing.
    let ze_dir = crate::util::find_dir_match(&["package.json"])?;
    if ze_dir.is_none() {
        bail!("Could not find a repo folder containing package.json.");
    }
    let ze_dir = ze_dir.unwrap();

    if let Some(r) = reference {
        // Check if any changes are present before switching branches.
        match Command::new("git")
            .arg("diff")
            .arg("--quiet")
            .current_dir(&ze_dir)
            .status()
        {
            Ok(s) => {
                if s.code().unwrap() != 0 {
                    bail!("There are changes in your working tree. Please commit or discard them before continuing.");
                }
            }
            Err(_) => todo!(),
        }
        match Command::new("git")
            .arg("checkout")
            .arg(&r)
            .current_dir(&ze_dir)
            .output()
        {
            Ok(_o) => {
                if text {
                    println!("🔀 Switched to Git ref '{}'", r);
                }
            }
            Err(_) => {
                if text {
                    println!(
                        "⚠️ {}",
                        format!(
                            "Could not checkout Git ref '{}', using current working tree",
                            r
                        )
                        .italic()
                    )
                }
            }
        }
    }

    // Clean `node_modules` between calls to the `setup` command.
    super::clean_node_modules(&ze_dir).await?;

    // Run the install command for the corresponding package manager to grab dependencies.
    let setup_pkg_mgr = setup_pkg_mgr(ze_dir).await?;
    let pkg_mgr_name = setup_pkg_mgr.as_str();
    let mut pm = crate::pm::pkg_mgr(pkg_mgr_name);
    if pkg_mgr_name != "yarn" {
        pm.arg("install");
    }
    if !text {
        pm.stdout(Stdio::null()).stderr(Stdio::null());
    }
    match pm.status() {
        Ok(status) if status.success() => {
            if text {
                println!("✔️  Setup complete");
            }
        }
        Ok(_) => {
            bail!("{} install exited with a non-zero status", pkg_mgr_name);
        }
        Err(e) => {
            if text {
                println!("{:?}", e);
                println!(
                    "❌ Failed to run {} - ensure it has been installed and try again.",
                    pkg_mgr_name
                );
            }
            bail!("Error when using the package manager");
        }
    }

    Ok(())
}
