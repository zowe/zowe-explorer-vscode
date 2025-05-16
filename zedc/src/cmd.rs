//! Command module that defines the `zedc` command tree.

use anyhow::Result;
use clap::{command, CommandFactory, Parser, Subcommand};
use clap_complete::{generate, Shell};

/// Configuration options for test commands
#[derive(Parser)]
pub struct TestConfig {
    #[arg(
        default_value = None,
        default_missing_value = Some("latest"),
        help = "Installs the given version of Zowe CLI",
        global = true,
        long,
        value_name = "VERSION",
        num_args = 0
    )]
    pub install_cli: Option<String>,

    #[arg(
        default_value = None,
        help = "The VS Code version to use for testing",
        long,
        value_name = "VERSION",
        global = true
    )]
    pub vsc_version: Option<String>,
}

/// Root commands available in the Zowe Explorer development CLI
#[derive(Subcommand)]
pub enum RootCommands {
    /// Forward commands to the applicable package manager
    #[command(
        name = "pkg-manager",
        about = "Forward commands to the applicable package manager",
        visible_alias = "pm"
    )]
    PkgMgr {
        #[arg(last = true)]
        args: Vec<String>,
    },

    /// Setup required dependencies to facilitate Zowe Explorer development
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

    /// Manually test Zowe Explorer or an extender
    #[command(
        name = "test",
        about = "Manually test Zowe Explorer or an extender",
        visible_alias = "t"
    )]
    Test {
        #[command(subcommand)]
        subcommand: crate::test::Commands,
        #[command(flatten)]
        config: TestConfig,
    },

    /// Prints the version info for the zedc tool
    #[command(
        name = "version",
        about = "Prints the version info for the zedc tool",
        alias = "v"
    )]
    Version,

    /// Show the current state of the Zowe Explorer development environment
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

    /// Generate shell completion scripts
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

/// Command-line arguments for the zedc tool
#[derive(Parser)]
pub struct Args {
    #[command(subcommand)]
    pub command: RootCommands,
}

/// Generate shell completion scripts for the specified shell
pub fn generate_completions(shell: Shell) -> Result<()> {
    let mut cmd = Args::command();
    generate(shell, &mut cmd, "zedc", &mut std::io::stdout());
    Ok(())
}
