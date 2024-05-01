use anyhow::bail;
use owo_colors::OwoColorize;
use std::path::Path;

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
    let resolved_paths = resolve_paths(files);
    if resolved_paths.is_empty() {
        println!(
            "{}",
            "At least one .vsix or .tgz file is required for this command.".red()
        );
        bail!("At least one .vsix or .tgz file is required for this command.");
    }
    println!("✔️ {} file(s) found!", resolved_paths.len());
    Ok(())
}

pub fn resolve_paths(files: Vec<String>) -> Vec<String> {
    println!("🔍 Locating VSIX files...");
    files
        .iter()
        .filter_map(|f| match std::fs::canonicalize(f) {
            Ok(p) => Some(p.to_str().unwrap().to_owned()),
            Err(e) => {
                println!("\t❌ {}", format!("skipping {}: {}", f, e).italic());
                None
            }
        })
        .collect::<Vec<_>>()
}
