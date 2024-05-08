//! The main module for the Zowe Explorer development CLI.

use clap::Parser;
use cmd::{Args, RootCommands};

mod cmd;
mod code;
mod pm;
mod setup;
mod test;
mod util;

/// Main entrypoint function for handling all `zedc` commands.
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize `octocrab` if a GitHub personal token is present in `ZEDC_PAT`.
    if std::env::var("ZEDC_PAT").is_ok() {
        let pat = std::env::var("ZEDC_PAT").unwrap();
        let crab = octocrab::Octocrab::builder()
            .base_uri("https://api.github.com")?
            .personal_token(pat)
            .build()?;
        octocrab::initialise(crab);
    }

    // Parse the command entered by the user.
    let matches = Args::parse();
    match matches.command {
        RootCommands::Setup { reference } => setup::handle_cmd(reference).await?,
        RootCommands::Test {
            subcommand,
            vsc_version,
            install_cli,
        } => test::handle_cmd(install_cli, vsc_version, subcommand).await?,
        RootCommands::Version => {
            println!("zedc {}", env!("CARGO_PKG_VERSION"));
        }
        RootCommands::PkgMgr { args } => pm::handle_cmd(args)?,
    }

    Ok(())
}
