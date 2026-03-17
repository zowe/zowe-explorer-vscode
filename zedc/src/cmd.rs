//! Command module that defines the `zedc` command tree.

use std::process::Command;

use crate::test::Commands as TestCommands;
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
    /// Set up the development environment
    Setup {
        /// Git reference to use for setup
        #[arg(short, long)]
        reference: Option<String>,
    },
    /// Run tests
    Test {
        #[command(subcommand)]
        subcommand: TestCommands,
        #[command(flatten)]
        config: TestConfig,
    },
    /// Print version information
    Version,
    /// Run package manager commands
    PkgMgr {
        /// Arguments to pass to the package manager
        #[arg(trailing_var_arg = true)]
        args: Vec<String>,
    },
    /// Show development environment status
    Status {
        /// Show verbose output
        #[arg(short, long)]
        verbose: bool,
    },
    /// Generate shell completions
    Completions {
        /// Shell to generate completions for
        #[arg(value_enum)]
        shell: clap_complete::Shell,
    },
}

/// Command-line arguments for the zedc tool
#[derive(Parser)]
#[command(author, version, about, long_about = None)]
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

pub fn as_binary(name: &str) -> Command {
    #[cfg(windows)]
    return Command::new(format!("{}.cmd", name));
    #[cfg(not(windows))]
    return Command::new(name);
}
