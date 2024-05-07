mod cmd;

use anyhow::bail;
use homedir::get_my_home;
use owo_colors::OwoColorize;
use std::{
    io::Write,
    path::PathBuf,
    process::{Command, Stdio},
};
use tokio::{fs::OpenOptions, io::AsyncWriteExt};

pub use cmd::handle_cmd;

pub fn activate_pkg_mgr(pkg_mgr: &String) {
    match crate::pm::corepack().arg("enable").arg(pkg_mgr).output() {
        Ok(_) => {
            println!("✔️  {} setup complete", pkg_mgr);
        }
        Err(_) => {
            println!("💿 Installing Node.js...");
        }
    }
}

pub async fn install_node() -> anyhow::Result<()> {
    match std::env::consts::OS {
        _ => {
            match Command::new("cargo")
                .args(["install", "fnm"])
                .stdout(Stdio::null())
                .status()
            {
                Ok(_) => {
                    println!("✔️  Installed fnm");
                    //match std::env::consts::OS {
                    //"windows" => {}
                    //_ => {
                    let mut bashrc = OpenOptions::new()
                        .create(true)
                        .append(true)
                        .write(true)
                        .open(get_my_home().unwrap().unwrap_or("~".into()).join(".bashrc"))
                        .await?;
                    bashrc.write_all(b"eval \"$(fnm env --use-on-cd)\"").await?;
                    //}
                    //}
                    if let Err(e) = Command::new("fnm").arg("install").arg("18").status() {
                        bail!("'fnm install 18' failed");
                    }
                }
                Err(_) => todo!(),
            }
        }
    }

    Ok(())
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
        Err(_) => {
            println!("\t❌ No Node.js installation found - installing...");
            install_node().await?;
            activate_pkg_mgr(&pkg_mgr);
        }
    }

    Ok(())
}

pub async fn setup_pkg_mgr(ze_dir: PathBuf) -> anyhow::Result<String> {
    let pkg_mgr = crate::pm::detect_pkg_mgr(&ze_dir)?;

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
            print!(
                "❌ {} was not found. Would you like to install it? (y/N) ",
                pkg_mgr.bold()
            );
            let _ = std::io::stdout().flush()?;
            let mut line = String::new();
            std::io::stdin()
                .read_line(&mut line)
                .expect("Unable to read user input");
            if let Some('\n') = line.chars().next_back() {
                line.pop();
            }
            if let Some('\r') = line.chars().next_back() {
                line.pop();
            }
            line = line.trim().to_owned();

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
