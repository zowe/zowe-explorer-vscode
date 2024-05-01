mod fs;

pub fn setup(vsc_version: Option<String>, files: Vec<String>) -> anyhow::Result<()> {
    let dir = crate::code::download_vscode(vsc_version)?;
    fs::install_from_paths(dir, files);

    Ok(())
}
