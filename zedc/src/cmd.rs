//! Command module that defines the `zedc` command tree.

use clap::{command, Parser, Subcommand};

#[derive(Subcommand)]
pub enum RootCommands {
    #[command(
        name = "pkg-manager",
        about = "Forward commands to the applicable package manager",
        visible_alias = "pm"
    )]
    PkgMgr {
        #[arg(last = true)]
        args: Vec<String>,
    },
    #[command(
        name = "setup",
        about = "Setup required dependencies to facilitate Zowe Explorer development",
        visible_alias = "s"
    )]
    Setup {
        #[arg(
            default_value = None,
            help = "A Git ref to checkout when setting up the environment",
            long,
            short,
            value_name = "REF"
        )]
        reference: Option<String>,
    },
    #[command(
        name = "test",
        about = "Manually test Zowe Explorer or an extender",
        visible_alias = "t"
    )]
    Test {
        #[command(subcommand)]
        subcommand: crate::test::Commands,
        #[arg(
            default_value = None,
            default_missing_value = Some("latest"),
            help = "Installs the given version of Zowe CLI",
            global = true,
            long,
            value_name = "VERSION",
            num_args = 0
        )]
        install_cli: Option<String>,
        #[arg(default_value = None, help = "The VS Code version to use for testing", long, value_name = "VERSION", global = true)]
        vsc_version: Option<String>,
    },
    #[command(
        name = "version",
        about = "Prints the version info for the zedc tool",
        alias = "v"
    )]
    Version,
    #[command(
        name = "status",
        about = "Show the current state of the Zowe Explorer development environment",
        visible_alias = "st"
    )]
    Status {
        #[arg(
            long,
            help = "Show detailed information about the environment",
            default_value = "false"
        )]
        verbose: bool,
    },
    #[command(
        name = "completions",
        about = "Generate shell completion scripts",
        visible_alias = "comp"
    )]
    Completions {
        #[arg(help = "The shell to generate completions for", value_enum)]
        shell: clap_complete::Shell,
    },
}

#[derive(Parser)]
pub struct Args {
    #[command(subcommand)]
    pub command: RootCommands,
}
