mod cmd;

use anyhow::bail;
use owo_colors::OwoColorize;
use std::process::{Command, Stdio};
use tokio::io::{stdin, stdout, AsyncReadExt, AsyncWriteExt};
use tokio_util::codec::{FramedRead, LinesCodec};

pub use cmd::handle_cmd;

pub fn activate_pkg_mgr(pkg_mgr: &String) {
    match Command::new("corepack").arg("enable").arg(pkg_mgr).output() {
        Ok(_) => {
            println!("✔️  {} setup complete", pkg_mgr);
        }
        Err(_) => {
            println!("💿 Installing Node.js...");
        }
    }
}

pub fn install_node() {
    match std::env::consts::OS {
        "windows" => {
            match Command::new("winget")
                .arg("install")
                .arg("Schniz.fnm")
                .output()
            {
                Ok(_) => {}
                Err(_) => {}
            }
        }
        _ => match Command::new("curl -fsSL https://fnm.vercel.app/install | bash").output() {
            Ok(_) => {}
            Err(_) => {}
        },
    }
}

pub async fn setup_node_with_pkg_mgr(pkg_mgr: &String) -> anyhow::Result<()> {
    match Command::new("node")
        .arg("--version")
        .stderr(Stdio::null())
        .output()
    {
        Ok(out) => {
            let ver = String::from_utf8(out.stdout)?.replace("\n", "");
            println!("✔️  Found node {}", ver);
            activate_pkg_mgr(&pkg_mgr);
        }
        Err(_) => {}
    }

    Ok(())
}

pub async fn setup_pkg_mgr() -> anyhow::Result<String> {
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

            let mut stdin = stdin();
            let mut line = String::new();
            stdin.read_to_string(&mut line).await?;

            match line.as_str() {
                "y" | "Y" | "yes" => {
                    setup_node_with_pkg_mgr(&pkg_mgr).await?;
                }
                _ => {
                    bail!("User cancelled setup.");
                }
            }
        }
    }

    Ok(pkg_mgr)
}
