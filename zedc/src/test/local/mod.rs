pub async fn setup(vsc_version: Option<String>, files: Vec<String>) -> anyhow::Result<()> {
    let vsc_bin = crate::code::download_vscode(vsc_version).await?;
    let resolved_paths = super::fs::resolve_paths(files);
    super::fs::install_from_paths(vsc_bin, resolved_paths).await?;

    Ok(())
}
