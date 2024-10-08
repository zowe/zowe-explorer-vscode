//! Command module for handling `test` commands.
 
use crate::test::{ghr, local};
use clap::{command, Subcommand};
use owo_colors::OwoColorize;

#[derive(Subcommand)]
pub enum Commands {
    #[command(
        name = "gh-repo",
        about = "Fetch one or more extension artifacts from a Git ref",
        alias = "ghr"
    )]
    GhRepo {
        #[arg(
            help = "The Git refs to grab the artifacts from (branch, commit hash, or tag)",
            trailing_var_arg = true
        )]
        references: Vec<String>,
    },
    #[command(
        name = "local",
        about = "Provide multiple .vsix files containing extensions",
        alias = "l"
    )]
    Local { files: Vec<String> },
}

/// Handles the logic for the `zedc test [t]` command.
///
/// # Arguments
/// * `install_cli` - (optional) Installs the given version of Zowe CLI, if provided.
/// * `vsc_version` - (optional) The version of VS Code to install (default: `latest`)
/// * `cmd` - Any subcommands passed to the `test` command
pub async fn handle_cmd(
    install_cli: Option<String>,
    vsc_version: Option<String>,
    cmd: Commands,
) -> anyhow::Result<()> {
    println!("{}\n", "zedc test".bold());

    // Handle any subcommands.
    match cmd {
        Commands::GhRepo {
            references,
        } => {
            let crab = octocrab::instance();
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

    // Install Zowe CLI if a version was provided.
    if install_cli.is_some() {
        let ver = install_cli.unwrap();
        println!("💿 Installing Zowe CLI (version: {})...", ver);
        super::install_cli(ver)?;
    }

    Ok(())
}
