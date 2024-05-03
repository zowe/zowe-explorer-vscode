use anyhow::bail;
use owo_colors::OwoColorize;
use std::{ffi::OsStr, path::Path};

pub fn install_cli(version: String) -> anyhow::Result<()> {
    let nm_path = Path::new("./node_modules");
    if nm_path.exists() {
        std::fs::remove_dir_all(nm_path)?;
    }
    std::fs::create_dir(nm_path)?;
    let _ = match crate::pm::npm()
        .arg("install")
        .arg("-g")
        .arg("--no-save")
        .arg("--prefix ./node_modules")
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

pub fn install_from_paths(_vsc_dir: String, files: Vec<String>) -> anyhow::Result<()> {
    if files.is_empty() {
        println!(
            "\n{}\n{}",
            "No valid files provided.".red(),
            "Supported formats:\n.vsix, .tar.gz, .tgz"
        );
        bail!("At least one .vsix, .tar.gz, or .tgz file is required for this command.");
    }
    Ok(())
}

pub fn resolve_paths(files: Vec<String>) -> Vec<String> {
    println!("\n{} {}", "🔍", "Resolving files...");
    files
        .iter()
        .filter_map(|f| match std::fs::canonicalize(f) {
            Ok(p) => match p.extension().unwrap_or(OsStr::new("")).to_str().unwrap() {
                "gz" | "tgz" | "vsix" => {
                    println!("  ✔️  {}", f.bold());
                    Some(p.to_str().unwrap().to_owned())
                }
                _ => {
                    println!("  ❌ {}", format!("{}: invalid extension", f).italic());
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
