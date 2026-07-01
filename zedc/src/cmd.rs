//! Command module that defines the `zedc` command tree.

use std::process::Command;

use crate::output::OutputFormat;
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
    /// Check that installed tool versions satisfy the project's requirements
    Doctor,
    /// Fetch a PR, reuse its posted VSIX artifact (or build from source), and launch the sandbox
    Pr {
        /// GitHub pull request number
        pr_number: u64,
        /// VS Code version to use for the sandbox (default: latest)
        #[arg(long, value_name = "VERSION")]
        vsc_version: Option<String>,
        /// Skip dependency installation (reuse existing node_modules)
        #[arg(long)]
        skip_setup: bool,
        /// Always build from source, ignoring any VSIX artifact posted on the PR
        #[arg(long)]
        build: bool,
    },
}

/// Command-line arguments for the zedc tool
#[derive(Parser)]
#[command(author, version, about, long_about = None)]
pub struct Args {
    #[command(subcommand)]
    pub command: RootCommands,

    /// Output format for command results
    #[arg(long, value_enum, value_name = "FORMAT", global = true)]
    pub format: Option<OutputFormat>,

    /// Emit machine-readable JSON (shorthand for `--format json`)
    #[arg(long, global = true)]
    pub json: bool,
}

impl Args {
    /// Resolves the effective output format, treating `--json` as a shorthand
    /// for `--format json`. The explicit `--json` flag takes precedence.
    pub fn output_format(&self) -> OutputFormat {
        if self.json {
            OutputFormat::Json
        } else {
            self.format.unwrap_or_default()
        }
    }
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
