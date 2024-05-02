use super::setup_pkg_mgr;

pub fn handle_cmd(reference: Option<String>) -> anyhow::Result<()> {
    match reference {
        Some(_r) => {}
        None => {}
    }

    setup_pkg_mgr()?;

    Ok(())
}
