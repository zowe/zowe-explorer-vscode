use clap::Parser;
use cmd::{Args, RootCommands};
use owo_colors::OwoColorize;

mod cmd;
mod code;
mod pm;
mod setup;
mod test;
mod util;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    octocrab::initialise(octocrab::Octocrab::default());

    let matches = Args::parse();
    match matches.command {
        RootCommands::Setup { reference } => {
            setup::handle_cmd(reference).await?;
        }
        RootCommands::Test {
            subcommand,
            vsc_version,
            install_cli,
        } => {
            match test::handle_cmd(install_cli, vsc_version, subcommand).await {
                Err(e) => println!("{}", e.red()),
                _ => ()
            }
        }
        RootCommands::Version => {
            println!("zedc {}", env!("CARGO_PKG_VERSION"));
        }
        RootCommands::PkgMgr { args } => pm::handle_cmd(args)?,
    }

    Ok(())
}
