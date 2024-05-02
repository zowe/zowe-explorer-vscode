use clap::Parser;
use cmd::{Args, RootCommands};

mod cmd;
mod code;
mod pm;
mod setup;
mod test;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    octocrab::initialise(octocrab::Octocrab::default());

    let matches = Args::parse();
    match matches.command {
        RootCommands::Setup { reference } => {
            setup::handle_cmd(reference)?;
        }
        RootCommands::Test {
            subcommand,
            vsc_version,
            install_cli,
        } => {
            test::handle_cmd(install_cli, vsc_version, subcommand).await?;
        }
        RootCommands::Version => {
            println!("zedc {}", env!("CARGO_PKG_VERSION"));
        }
        RootCommands::PkgMgr {} => todo!(),
    }

    Ok(())
}
