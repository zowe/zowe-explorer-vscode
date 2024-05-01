use clap::{command, Parser, Subcommand};

#[derive(Subcommand)]
pub enum RootCommands {
    #[command(
        name = "test",
        about = "Manually test Zowe Explorer or an extender",
        visible_alias = "t"
    )]
    Test {
        #[command(subcommand)]
        subcommand: crate::test::Commands,
        #[arg(help = "The VS Code version to use for testing", long)]
        vsc_version: Option<String>,
    },
    #[command(
        name = "version",
        about = "Prints the version info for the zedc tool",
        alias = "v"
    )]
    Version,
}

#[derive(Parser)]
pub struct Args {
    #[command(subcommand)]
    pub command: RootCommands,
}