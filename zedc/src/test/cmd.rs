use crate::test::{ghr, local};

use anyhow::bail;
use clap::{command, Subcommand};
use owo_colors::OwoColorize;
use reqwest::header::ACCEPT;
#[derive(Subcommand)]
pub enum Commands {
    #[command(
        name = "gh-repo",
        about = "Fetch one or more extension artifacts from a Git ref",
        alias = "ghr"
    )]
    GhRepo {
        #[arg(
            help = "Exclude artifacts matching the given list of names",
            long,
            short
        )]
        exclude: Vec<String>,
        #[arg(
            help = "The Git refs to grab the artifacts from (branch, commit hash, or tag)",
            trailing_var_arg = true
        )]
        references: Vec<String>,
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
    println!("{}\n", "zedc test".bold());
    match cmd {
        Commands::GhRepo {
            references,
            exclude,
        } => {
            let pat = match std::env::var("ZEDC_PAT") {
                Ok(p) => p,
                Err(e) => {
                    bail!("ZEDC_PAT must be defined with a personal access token to continue.");
                }
            };
            // todo: Use Octocrab to grab appropriate artifacts from branch/PR/commit hash
            // then set up VS Code and continue
            let crab = octocrab::Octocrab::builder()
                .base_uri("https://github.com")?
                .add_header(ACCEPT, "application/json".to_string())
                .personal_token(pat)
                .build()?;

            ghr::setup(references, vsc_version, &crab).await?;
        }
        Commands::Local { files } => {
            match local::setup(vsc_version, files).await {
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
        super::install_cli(ver)?;
    }

    Ok(())
}
