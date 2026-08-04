//! Command module for handling `test` commands.

use crate::output::{self, exit};
use crate::test::{coverage, ghr, local};
use clap::Subcommand;
use owo_colors::OwoColorize;

#[derive(Subcommand)]
pub enum Commands {
    #[command(
        name = "gh-repo",
        about = "Fetch one or more extension artifacts from a Git ref",
        alias = "ghr"
    )]
    GhRepo {
        #[arg(
            help = "The Git refs to grab the artifacts from (branch, commit hash, or tag)",
            trailing_var_arg = true
        )]
        references: Vec<String>,
    },
    #[command(
        name = "local",
        about = "Provide multiple .vsix files containing extensions",
        alias = "l"
    )]
    Local { files: Vec<String> },
    #[command(
        name = "coverage",
        about = "Run unit tests and compare patch coverage with main branch",
        alias = "cov"
    )]
    Coverage {
        #[arg(short, long)]
        verbose: bool,
        #[arg(short, long, help = "Filter tests to a specific package")]
        filter: Option<String>,
        #[arg(
            long,
            value_name = "N",
            help = "Exit non-zero if patch coverage falls below this percentage (0–100)"
        )]
        threshold: Option<f64>,
    },
}

/// Handles the logic for the `zedc test [t]` command.
///
/// # Arguments
/// * `install_cli` - (optional) Installs the given version of Zowe CLI, if provided.
/// * `vsc_version` - (optional) The version of VS Code to install (default: `latest`)
/// * `cmd` - Any subcommands passed to the `test` command
pub async fn handle_cmd(
    install_cli: Option<String>,
    vsc_version: Option<String>,
    cmd: Commands,
) -> anyhow::Result<i32> {
    let json = output::json_enabled();
    if !json {
        println!("{}\n", "zedc test".bold().blue());
    }

    // Handle any subcommands.
    let (code, action_command) = match cmd {
        Commands::GhRepo { references } => {
            let crab = octocrab::instance();
            ghr::setup(references, vsc_version, &crab).await?;
            (exit::SUCCESS, Some("test gh-repo"))
        }
        Commands::Local { files } => {
            match local::setup(vsc_version, files).await {
                Ok(_) => {}
                Err(_e) => {
                    return Ok(exit::SUCCESS);
                }
            };
            (exit::SUCCESS, Some("test local"))
        }
        Commands::Coverage {
            verbose,
            filter,
            threshold,
        } => (
            coverage::run_coverage_check(verbose, filter, threshold)?,
            None,
        ),
    };

    if code != exit::SUCCESS {
        return Ok(code);
    }

    // Install Zowe CLI if a version was provided.
    if install_cli.is_some() {
        let ver = install_cli.unwrap();
        if output::text_enabled() {
            println!(
                "💿 {}",
                format!("Installing Zowe CLI (version: {})...", ver).blue()
            );
        }
        super::install_cli(ver)?;
    }

    if json {
        if let Some(command) = action_command {
            output::emit_action_result(command, true);
        }
    }

    Ok(code)
}
