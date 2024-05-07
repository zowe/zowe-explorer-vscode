use clap::Parser;
use cmd::{Args, RootCommands};

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
