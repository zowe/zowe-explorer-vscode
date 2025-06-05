//! "Root" module for handling `test` commands.

mod cmd;
mod fs;

pub mod coverage;
pub mod ghr;
pub mod local;
pub use cmd::{handle_cmd, Commands};
pub use fs::install_cli;
