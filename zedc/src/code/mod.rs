mod prepare;

pub use prepare::*;

pub fn code_binary() -> String {
    match std::env::consts::OS {
        "macos" => "Visual Studio Code.app",
        "windows" => "Code.exe",
        _ => "code",
    }.to_owned()
}