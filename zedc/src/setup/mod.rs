mod cmd;

use owo_colors::OwoColorize;
use std::process::Stdio;

pub use cmd::handle_cmd;
pub fn setup_pkg_mgr() -> anyhow::Result<()> {
    println!("{}\n", "zedc setup".bold());
    let pkg_mgr = crate::pm::detect_pkg_mgr()?;

    // check if the package manager actually exists
    match crate::pm::pkg_mgr(&pkg_mgr)
        .arg("--version")
        .stderr(Stdio::null())
        .output()
    {
        Ok(out) => {
            let ver = String::from_utf8(out.stdout)?.replace("\n", "");
            println!("✔️  Using {} {}", pkg_mgr, ver);
        }
        Err(_) => {
            println!(
                "❌ {} was not found. Would you like to install it? (y/N)",
                pkg_mgr.bold()
            );
        }
    }

    Ok(())
}
