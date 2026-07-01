//! The main module for the Zowe Explorer development CLI.

use anyhow::{Context, Result};
use clap::Parser;
use cmd::{generate_completions, Args, RootCommands};
use output::{exit, OutputFormat};

mod cmd;
mod code;
mod doctor;
mod output;
mod pm;
mod pr;
mod setup;
mod status;
mod test;
mod util;

/// Initialize GitHub client if a personal access token is available
fn init_github() -> Result<()> {
    if let Ok(pat) = std::env::var("ZEDC_PAT") {
        let crab = octocrab::Octocrab::builder()
            .base_uri("https://api.github.com")?
            .personal_token(pat)
            .build()
            .context("Failed to initialize GitHub client")?;
        octocrab::initialise(crab);
    }
    Ok(())
}

/// Routes a parsed command to its handler and returns a stable exit code.
///
/// Handlers that produce a structured result (`doctor`, `status`, `test
/// coverage`, …) emit their own JSON when `--json` is active and return the
/// appropriate [`exit`] code. Side-effecting commands emit a small JSON
/// envelope on success so an agent always receives parseable confirmation.
async fn dispatch(command: RootCommands) -> Result<i32> {
    let json = output::json_enabled();

    match command {
        RootCommands::Setup { reference } => {
            setup::handle_cmd(reference).await?;
            if json {
                output::emit_action_result("setup", true);
            }
            Ok(exit::SUCCESS)
        }
        RootCommands::Test { subcommand, config } => {
            test::handle_cmd(config.install_cli, config.vsc_version, subcommand).await
        }
        RootCommands::Version => {
            if json {
                output::emit_json(&serde_json::json!({ "zedc": env!("CARGO_PKG_VERSION") }));
            } else {
                println!("zedc {}", env!("CARGO_PKG_VERSION"));
            }
            Ok(exit::SUCCESS)
        }
        RootCommands::PkgMgr { args } => match pm::handle_cmd(args) {
            Ok(out) => {
                if json {
                    output::emit_json(&serde_json::json!({
                        "ok": true,
                        "command": "pkg-manager",
                        "output": out,
                    }));
                }
                Ok(exit::SUCCESS)
            }
            Err(e) => {
                if json {
                    output::emit_error(&e.to_string());
                } else {
                    eprintln!("Error from zedc pm: {}", e);
                }
                Ok(exit::FAILURE)
            }
        },
        RootCommands::Doctor => doctor::handle_cmd().await,
        RootCommands::Status { verbose } => status::handle_cmd(verbose).await,
        // Completions always print the raw shell script; `--json` is ignored
        // here since wrapping a completion script in JSON would break it.
        RootCommands::Completions { shell } => {
            generate_completions(shell)?;
            Ok(exit::SUCCESS)
        }
        RootCommands::Pr {
            pr_number,
            vsc_version,
            skip_setup,
            build,
        } => {
            pr::handle_cmd(pr_number, vsc_version, skip_setup, build).await?;
            if json {
                output::emit_action_result("pr", true);
            }
            Ok(exit::SUCCESS)
        }
    }
}

/// Parses arguments, runs the requested command, and returns a process exit code.
///
/// In `--json` mode any bubbled-up error is rendered as a JSON envelope on
/// stdout; otherwise it is printed in anyhow's familiar `Error:` form on stderr.
async fn run() -> i32 {
    let args = Args::parse();
    let format = args.output_format();
    output::set_format(format);

    let result = async {
        init_github().context("Failed to initialize GitHub integration")?;
        dispatch(args.command).await
    }
    .await;

    match result {
        Ok(code) => code,
        Err(e) => {
            if format == OutputFormat::Json {
                output::emit_error(&format!("{:#}", e));
            } else {
                eprintln!("Error: {:?}", e);
            }
            exit::FAILURE
        }
    }
}

/// Main entrypoint function for handling all `zedc` commands.
#[tokio::main]
async fn main() {
    std::process::exit(run().await);
}
