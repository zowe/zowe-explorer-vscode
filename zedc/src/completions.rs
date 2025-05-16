use crate::cmd::Args;
use anyhow::Result;
use clap::CommandFactory;
use clap_complete::{generate, Shell};

pub fn generate_completions(shell: Shell) -> Result<()> {
    let mut cmd = Args::command();
    generate(shell, &mut cmd, "zedc", &mut std::io::stdout());
    Ok(())
}
