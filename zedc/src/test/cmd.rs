use crate::test::local;

use clap::{command, Subcommand};
#[derive(Subcommand)]
pub enum Commands {
    #[command(
        name = "gh-repo",
        about = "Fetch one or more extension artifacts from a Git ref",
        alias = "ghr"
    )]
    GhRepo {
        repo_name: String,
        artifacts: Vec<String>,
    },
    #[command(
        name = "local",
        about = "Provide multiple .vsix or .tgz files containing extensions",
        alias = "l"
    )]
    Local { files: Vec<String> },
}

pub fn handle_cmd(vsc_version: Option<String>, cmd: Commands) -> anyhow::Result<()> {
    match cmd {
        Commands::GhRepo {
            repo_name: _,
            artifacts: _,
        } => {
            // todo: Use Octocrab to grab appropriate artifacts from branch/PR/commit hash
            // then set up VS Code and continue
        }
        Commands::Local { files } => {
            local::setup(vsc_version, files)?;
        }
    }

    Ok(())
}