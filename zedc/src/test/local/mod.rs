//! Module for handling the `test local` sub-command.

/// Downloads VS Code, resolves artifacts from the given file paths, installs them in VS Code and opens it.
/// 
/// # Arguments
/// * `vsc_version` - (optional) The VS Code version to download (default: `latest`)
/// * `files` - A `Vec` of relative file paths pointing to extensions to install
pub async fn setup(vsc_version: Option<String>, files: Vec<String>) -> anyhow::Result<()> {
    let vsc_bin = crate::code::download_vscode(vsc_version).await?;
    let resolved_paths = super::fs::resolve_paths(files);
    super::fs::install_from_paths(vsc_bin, resolved_paths).await?;

    Ok(())
}
