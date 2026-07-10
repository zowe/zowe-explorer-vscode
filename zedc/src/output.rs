//! Output formatting helpers and stable process exit codes.
//!
//! `zedc` supports a machine-readable mode (`--json` / `--format json`) so that
//! agents and CI can consume structured results instead of scraping colorized
//! terminal output. The resolved [`OutputFormat`] is stored globally so that
//! cross-cutting concerns (progress spinners, OSC-8 hyperlinks) can suppress
//! decorative output without threading a parameter through every function.

use std::sync::OnceLock;

/// Selects how command results are rendered.
#[derive(Copy, Clone, Debug, Default, PartialEq, Eq, clap::ValueEnum)]
pub enum OutputFormat {
    /// Human-readable, colorized terminal output (default).
    #[default]
    Text,
    /// Machine-readable JSON with no colors, spinners, or hyperlinks.
    Json,
}

static FORMAT: OnceLock<OutputFormat> = OnceLock::new();

/// Records the resolved output format for the lifetime of the process.
///
/// Called once from `main` after argument parsing. Subsequent calls are no-ops,
/// keeping the format immutable for the duration of the run.
pub fn set_format(format: OutputFormat) {
    let _ = FORMAT.set(format);
}

/// Returns the resolved output format, defaulting to [`OutputFormat::Text`]
/// when it has not been set (e.g. in unit tests).
pub fn format() -> OutputFormat {
    FORMAT.get().copied().unwrap_or_default()
}

/// Convenience predicate for the common "are we in machine-readable mode?" check.
pub fn json_enabled() -> bool {
    format() == OutputFormat::Json
}

/// Convenience predicate for text-only progress/status output.
pub fn text_enabled() -> bool {
    !json_enabled()
}

/// Serializes `value` as pretty-printed JSON to stdout.
///
/// Serialization is infallible for the report structs used here; on the
/// off chance it fails, a minimal JSON error object is emitted so consumers
/// still receive parseable output.
pub fn emit_json<T: serde::Serialize>(value: &T) {
    match serde_json::to_string_pretty(value) {
        Ok(s) => println!("{}", s),
        Err(e) => println!(
            "{{\"ok\":false,\"error\":\"failed to serialize output: {}\"}}",
            e.to_string().replace('"', "'")
        ),
    }
}

/// Emits a terminal error as a JSON envelope on stdout (machine-readable mode).
///
/// Existing error messages may embed ANSI color codes (several `bail!` calls
/// colorize their text); those are stripped so the JSON `error` value is clean.
pub fn emit_error(message: &str) {
    emit_json(&serde_json::json!({ "ok": false, "error": strip_ansi(message) }));
}

/// Removes ANSI CSI escape sequences (e.g. color codes) from a string.
fn strip_ansi(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\u{1b}' {
            // Consume a CSI sequence: ESC '[' ... <final letter>.
            if chars.peek() == Some(&'[') {
                chars.next();
                for nc in chars.by_ref() {
                    if nc.is_ascii_alphabetic() {
                        break;
                    }
                }
            }
        } else {
            out.push(c);
        }
    }
    out
}

/// Emits a concise success/failure envelope for side-effecting commands that
/// don't produce a richer structured report.
pub fn emit_action_result(command: &str, ok: bool) {
    emit_json(&serde_json::json!({ "ok": ok, "command": command }));
}

/// Stable process exit codes.
///
/// These are part of `zedc`'s machine-facing contract: an agent or CI job can
/// branch on them without parsing output. Their meaning must remain stable
/// across releases. Note that exit code `2` is reserved by `clap` for CLI
/// usage/parse errors and is intentionally left unused here.
pub mod exit {
    /// The command completed successfully.
    pub const SUCCESS: i32 = 0;
    /// Generic failure — e.g. `doctor` reported one or more failing checks,
    /// or an unhandled error bubbled up to `main`.
    pub const FAILURE: i32 = 1;
    /// Unit tests failed while collecting coverage.
    pub const TESTS_FAILED: i32 = 3;
    /// Patch coverage fell below the requested `--threshold`.
    pub const COVERAGE_BELOW_THRESHOLD: i32 = 4;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_color_codes() {
        let colored = "\u{1b}[31mAt least one reference is required.\u{1b}[39m";
        assert_eq!(strip_ansi(colored), "At least one reference is required.");
    }

    #[test]
    fn leaves_plain_text_untouched() {
        assert_eq!(strip_ansi("plain message"), "plain message");
    }

    #[test]
    fn json_shorthand_overrides_default_format() {
        assert_eq!(OutputFormat::default(), OutputFormat::Text);
    }
}
