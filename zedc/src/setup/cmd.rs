use std::{path::Path, process::Command};

use super::setup_pkg_mgr;
use anyhow::bail;
use owo_colors::OwoColorize;

pub async fn handle_cmd(reference: Option<String>) -> anyhow::Result<()> {
    println!("{}\n", "zedc setup".bold());
    match reference {
        Some(r) => match Command::new("git").arg("checkout").arg(&r).output() {
            Ok(o) => println!("🔀 Switched to Git ref '{}'", r),
            Err(_) => {
                println!("⚠️ {}", format!("Could not checkout Git ref '{}', using current working tree", r).italic());
            }
        },
        None => (),
    }

    if Path::new("./node_modules/.pnpm").exists() {
        println!("🧹 Cleaning node_modules...");
        tokio::fs::remove_dir_all("./node_modules").await?;
        let _ = tokio::fs::remove_dir_all("./packages/*/node_modules").await;
    }

    let setup_pkg_mgr = setup_pkg_mgr().await?;
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
