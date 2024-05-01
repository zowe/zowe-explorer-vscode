pub fn setup_pkg_mgr() -> anyhow::Result<()> {
    let pkg_mgr = crate::pm::detect_pkg_mgr()?;

    // check if the package manager actually exists
    match crate::pm::pkg_mgr(pkg_mgr).arg("--version").status() {}
}
