//! Module for test functions that interact with the filesystem.

use crate::code::code_binary;
use anyhow::bail;
use owo_colors::OwoColorize;
use std::{
    ffi::OsStr,
    path::Path,
    process::{Command, Stdio},
};

/// (WIP) Installs a copy of Zowe CLI for use during testing.
///
/// # Arguments
/// * `version` - The version of Zowe CLI to install from `npm`
pub fn install_cli(version: String) -> anyhow::Result<()> {
    let nm_path = Path::new("./node_modules");
    if nm_path.exists() {
        std::fs::remove_dir_all(nm_path)?;
    }
    std::fs::create_dir(nm_path)?;
    let _ = match crate::pm::npm()
        .args(["install", "-g", "--no-save", "--prefix", "./node_modules"])
        .arg(format!("@zowe/cli@{}", version))
        .status()
    {
        Ok(s) => s,
        Err(e) => {
            println!("❌ Could not install Zowe CLI, error: {}", e);
            bail!(e)
        }
    };

    println!("✔️  Installed Zowe CLI");
    Ok(())
}

/// Installs the given list of .vsix files using the given VS Code binary.
///
/// # Arguments
/// * `vsc_bin` - A path to the VS Code binary
/// * `files` - A `Vec` of file paths that correspond to extension files (`.vsix`)
pub async fn install_from_paths(vsc_bin: String, files: Vec<String>) -> anyhow::Result<()> {
    if files.is_empty() {
        bail!("No valid .vsix files provided.".red());
    }

    // Install the given extensions using the VS Code CLI.
    let vsc_bin_path = Path::new(&vsc_bin);
    println!("\n⌛ Installing extensions...");
    let mut cmd = Command::new(vsc_bin_path);
    for file in files.iter() {
        cmd.args(["--install-extension", file]);
    }

    if let Err(e) = cmd.stdout(Stdio::null()).spawn() {
        bail!(e);
    }

    // Launch VS Code after installing the given extensions.
    let vsc_dir = match std::env::consts::OS {
        "macos" => vsc_bin_path.ancestors().nth(6).unwrap(),
        _ => vsc_bin_path.parent().unwrap().parent().unwrap()
    };
    let sandbox_dir = vsc_dir.parent().unwrap().join("sandbox");
    let sandbox_str = sandbox_dir.to_str().unwrap();
    let zowe_dir = sandbox_dir.join(".zowe");
    tokio::fs::create_dir_all(&zowe_dir).await?;
    let vsc = vsc_dir.join(code_binary());

    if std::env::consts::OS == "macos" {
        match Command::new("open")
            .args([vsc.to_str().unwrap(), "--args", "--disable-updates", sandbox_str])
            .env("ZOWE_CLI_HOME", zowe_dir.to_str().unwrap())
            .stdout(Stdio::null())
            .spawn() {
                Ok(_s) => {
                    println!("🚀 Launched VS Code");
                    Ok(())
                }
                Err(_) => todo!(),
            }
    } else {
        match Command::new(vsc)
            .arg("")
            .arg(sandbox_str)
            .env("ZOWE_CLI_HOME", zowe_dir.to_str().unwrap())
            .stdout(Stdio::null())
            .spawn()
        {
            Ok(_s) => {
                println!("🚀 Launched VS Code");
                Ok(())
            }
            Err(_) => todo!(),
        }
    }
}

/// Resolves absolute file paths given a list of relative paths.
///
/// # Arguments
/// * `files` - A `Vec` of relative file paths to resolve on the local filesystem.
pub fn resolve_paths(files: Vec<String>) -> Vec<String> {
    println!("\n🔍 Resolving files...");
    files
        .iter()
        .filter_map(|f| match std::fs::canonicalize(f) {
            Ok(p) => match p.extension().unwrap_or(OsStr::new("")).to_str().unwrap() {
                "vsix" => {
                    println!("  ✔️  {}", f.bold());
                    Some(p.to_str().unwrap().to_owned())
                }
                _ => {
                    println!(
                        "  ❌ {}",
                        format!("{}: invalid extension format", f).italic()
                    );
                    None
                }
            },
            Err(e) => {
                println!("  ❌ {}", format!("{}: {}", f, e).italic());
                None
            }
        })
        .collect::<Vec<_>>()
}
