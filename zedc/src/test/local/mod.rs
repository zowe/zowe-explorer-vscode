mod fs;

pub use fs::install_cli;

pub async fn setup(vsc_version: Option<String>, files: Vec<String>) -> anyhow::Result<()> {
    let dir = crate::code::download_vscode(vsc_version).await?;
    let resolved_paths = fs::resolve_paths(files);
    fs::install_from_paths(dir, resolved_paths)?;

    Ok(())
}
