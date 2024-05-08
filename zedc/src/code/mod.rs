//! "Root" module for VS Code-related functions.

mod prepare;
pub use prepare::*;

/// Returns an OS-specific filename that corresponds to the VS Code binary.
pub fn code_binary() -> String {
    match std::env::consts::OS {
        "macos" => "Visual Studio Code.app",
        "windows" => "Code.exe",
        _ => "code",
    }.to_owned()
}