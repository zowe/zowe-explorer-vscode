use std::{path::Path, process::Command};

use super::setup_pkg_mgr;
use anyhow::bail;
use owo_colors::OwoColorize;

pub async fn handle_cmd(reference: Option<String>) -> anyhow::Result<()> {
    println!("{}\n", "zedc setup".bold());
    let ze_dir = crate::util::find_dir_match(&["package.json"])?;
    if ze_dir.is_none() {
        bail!("Could not find a repo folder containing package.json.");
    }
    let ze_dir = ze_dir.unwrap();
    match reference {
        Some(r) => {
            // Check if any changes are present before switching branches
            match Command::new("git")
                .arg("diff")
                .arg("--quiet")
                .current_dir(&ze_dir)
                .status()
            {
                Ok(s) => {
                    if s.code().unwrap() == 1 {
                        println!("{}", "There are changes in your working tree. Please commit or discard them before continuing.".red());
                        return Ok(());
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
                Ok(o) => println!("🔀 Switched to Git ref '{}'", r),
                Err(_) => {
                    println!(
                        "⚠️ {}",
                        format!(
                            "Could not checkout Git ref '{}', using current working tree",
                            r
                        )
                        .italic()
                    );
                }
            }
        }
        None => (),
    }

    let node_modules_dir = ze_dir.join("node_modules");
    if node_modules_dir.exists() {
        println!("🧹 Cleaning node_modules...");
        match tokio::fs::remove_dir_all(node_modules_dir).await {
            _ => {}
        };
        match tokio::fs::remove_dir_all(ze_dir.join("packages").join("*").join("node_modules"))
            .await
        {
            _ => {}
        };
    }

    let setup_pkg_mgr = setup_pkg_mgr(ze_dir).await?;
    let pkg_mgr_name = setup_pkg_mgr.as_str();
    let mut pm = crate::pm::pkg_mgr(pkg_mgr_name);
    if pkg_mgr_name != "yarn" {
        pm.arg("install");
    }
    match pm.status() {
        Ok(_) => {
            println!("✔️  Setup complete");
        }
        Err(e) => {
            println!("{:?}", e);
            println!(
                "❌ Failed to run {} - ensure it has been installed and try again.",
                pkg_mgr_name
            );
            bail!("Error when using the package manager");
        }
    }

    Ok(())
}
