mod cmd;
mod fs;

pub mod ghr;
pub mod local;
pub use fs::install_cli;
pub use cmd::{handle_cmd, Commands};
