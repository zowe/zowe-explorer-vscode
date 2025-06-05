//! The main module for the Zowe Explorer development CLI.

use anyhow::{Context, Result};
use clap::Parser;
use cmd::{generate_completions, Args, RootCommands};

mod cmd;
mod code;
mod pm;
mod setup;
mod status;
mod test;
mod util;

/// Initialize GitHub client if a personal access token is available
fn init_github() -> Result<()> {
    if let Ok(pat) = std::env::var("ZEDC_PAT") {
        let crab = octocrab::Octocrab::builder()
            .base_uri("https://api.github.com")?
            .personal_token(pat)
            .build()
            .context("Failed to initialize GitHub client")?;
        octocrab::initialise(crab);
    }
    Ok(())
}

/// Main entrypoint function for handling all `zedc` commands.
#[tokio::main]
async fn main() -> Result<()> {
    // Initialize GitHub client if token is available
    init_github().context("Failed to initialize GitHub integration")?;

    // Parse the command entered by the user.
    let matches = Args::parse();
    match matches.command {
        RootCommands::Setup { reference } => setup::handle_cmd(reference).await?,
        RootCommands::Test { subcommand, config } => {
            test::handle_cmd(config.install_cli, config.vsc_version, subcommand).await?
        }
        RootCommands::Version => {
            println!("zedc {}", env!("CARGO_PKG_VERSION"));
        }
        RootCommands::PkgMgr { args } => match pm::handle_cmd(args) {
            Ok(_output) => {}
            Err(e) => eprintln!("Error from zedc pm: {}", e),
        },
        RootCommands::Status { verbose } => status::handle_cmd(verbose).await?,
        RootCommands::Completions { shell } => generate_completions(shell)?,
    }

    Ok(())
}
