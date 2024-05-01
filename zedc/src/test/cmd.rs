use crate::test::local;

use anyhow::bail;
use clap::{command, Subcommand};
#[derive(Subcommand)]
pub enum Commands {
    #[command(
        name = "gh-repo",
        about = "Fetch one or more extension artifacts from a Git ref",
        alias = "ghr"
    )]
    GhRepo {
        #[arg(help = "The Git ref to grab the artifacts from (branch, commit hash, or tag)", long, short)]
        reference: String,
        #[arg(
            help = "Exclude artifacts matching the given list of names",
            long,
            short
        )]
        exclude: Vec<String>,
    },
    #[command(
        name = "local",
        about = "Provide multiple .vsix or .tgz files containing extensions",
        alias = "l"
    )]
    Local { files: Vec<String> },
}

pub async fn handle_cmd(
    install_cli: Option<String>,
    vsc_version: Option<String>,
    cmd: Commands,
) -> anyhow::Result<()> {
    match cmd {
        Commands::GhRepo {
            reference: _,
            exclude: _,
        } => {
            // todo: Use Octocrab to grab appropriate artifacts from branch/PR/commit hash
            // then set up VS Code and continue
        }
        Commands::Local { files } => {
            match local::setup(vsc_version, files) {
                Ok(_) => {}
                Err(_e) => {
                    return Ok(());
                }
            };
        }
    }

    if install_cli.is_some() {
        let ver = install_cli.unwrap();
        println!("💿 Installing Zowe CLI (version: {})...", ver);
        local::install_cli(ver)?;
    }

    Ok(())
}
