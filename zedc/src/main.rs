use clap::Parser;
use cmd::{Args, RootCommands};

mod cmd;
mod code;
mod test;
// TODO: look into option for installing CLI during bootstrap process

fn main() -> anyhow::Result<()> {
    let matches = Args::parse();
    match matches.command {
        RootCommands::Test {
            subcommand,
            vsc_version
        } => {
            test::handle_cmd(vsc_version, subcommand)?;
            // todo: Use Octocrab to grab appropriate artifacts
            // from branch/PR/commit, then set up VS Code and continue
        }
        RootCommands::Version => {
            println!("zedc {}", env!("CARGO_PKG_VERSION"));
        }
    }

    Ok(())
}
