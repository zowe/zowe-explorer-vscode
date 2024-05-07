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
    if std::env::var("ZEDC_PAT").is_ok() {
        let pat = std::env::var("ZEDC_PAT").unwrap();
        let crab = octocrab::Octocrab::builder()
            .base_uri("https://api.github.com")?
            .personal_token(pat)
            .build()?;
        octocrab::initialise(crab);
    }

    let matches = Args::parse();
    match matches.command {
        RootCommands::Setup { reference } => {
            if let Err(e) = setup::handle_cmd(reference).await {
                println!("{}", format!("Error: {}", e).red());
                return Err(e);   
            }
        }
        RootCommands::Test {
            subcommand,
            vsc_version,
            install_cli,
        } => {
            if let Err(e) = test::handle_cmd(install_cli, vsc_version, subcommand).await {
                println!("{}", format!("Error: {}", e).red());
                return Err(e);
            }
        },
        RootCommands::Version => {
            println!("zedc {}", env!("CARGO_PKG_VERSION"));
        }
        RootCommands::PkgMgr { args } => pm::handle_cmd(args)?,
    }

    Ok(())
}
