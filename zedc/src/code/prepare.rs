pub fn download_vscode(version: Option<String>) -> anyhow::Result<String> {
    let _version = match version {
        Some(ver) => ver,
        None => "latest".to_owned(),
    };

    // todo: fetch version from VS Code servers
    Ok("".to_owned())
}
