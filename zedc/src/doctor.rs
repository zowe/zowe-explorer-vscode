//! `zedc doctor` — strict version matrix validation for the development environment.

use anyhow::Result;
use owo_colors::OwoColorize;
use serde_json::Value;
use std::path::PathBuf;
use std::process::Command;

use crate::cmd;
use crate::pm;
use crate::util::find_dir_match;

// ─── Version ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
struct Version {
    major: u32,
    minor: u32,
    patch: u32,
}

impl Version {
    fn parse(raw: &str) -> Option<Self> {
        let s = raw.trim().trim_start_matches('v');
        // Split on any of: '.', '-', '+' — stops at non-numeric segments
        // e.g. "2.44.0.windows.1" → [2, 44, 0]; "22.14.0-nightly" → [22, 14, 0]
        let parts: Vec<u32> = s
            .split(['.', '-', '+'])
            .take_while(|seg| seg.chars().all(|c| c.is_ascii_digit()) && !seg.is_empty())
            .filter_map(|seg| seg.parse().ok())
            .collect();

        if parts.is_empty() {
            return None;
        }
        Some(Self {
            major: parts[0],
            minor: *parts.get(1).unwrap_or(&0),
            patch: *parts.get(2).unwrap_or(&0),
        })
    }
}

impl std::fmt::Display for Version {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}.{}.{}", self.major, self.minor, self.patch)
    }
}

// ─── Check result ─────────────────────────────────────────────────────────────

#[derive(Debug, PartialEq)]
enum CheckStatus {
    Pass,
    Fail,
    Warn,
    /// Requirement not determinable — shown but doesn't count as failure.
    Skip,
}

struct CheckResult {
    label: String,
    status: CheckStatus,
    installed: Option<String>,
    /// The version requirement string (e.g. ">=22.0.0", "11.5.2").
    required: Option<String>,
    /// Extra context shown dimmed on its own line.
    detail: Option<String>,
    /// Suggested remediation shown on its own line.
    fix_hint: Option<String>,
}

impl CheckResult {
    fn print(&self) {
        let icon = match self.status {
            CheckStatus::Pass => "✓".green().bold().to_string(),
            CheckStatus::Fail => "✗".red().bold().to_string(),
            CheckStatus::Warn => "⚠".yellow().bold().to_string(),
            CheckStatus::Skip => "–".dimmed().to_string(),
        };

        // Pad label and installed before coloring to preserve visual alignment.
        let label_padded = format!("{:<16}", self.label);
        let installed_str = self.installed.as_deref().unwrap_or("not found");
        let installed_padded = format!("{:<22}", installed_str);

        print!(
            "  {}  {}  {}",
            icon,
            label_padded.bold(),
            installed_padded
        );

        if let Some(req) = &self.required {
            let req_display = format!("(required: {})", req);
            let colored = match self.status {
                CheckStatus::Pass => req_display.dimmed().to_string(),
                CheckStatus::Fail => req_display.red().to_string(),
                CheckStatus::Warn => req_display.yellow().to_string(),
                CheckStatus::Skip => req_display.dimmed().to_string(),
            };
            print!("  {}", colored);
        }
        println!();

        if let Some(detail) = &self.detail {
            println!("         {}", detail.dimmed());
        }
        if let Some(hint) = &self.fix_hint {
            println!("         {} {}", "→".yellow(), hint);
        }
    }

    fn is_failure(&self) -> bool {
        self.status == CheckStatus::Fail
    }

    fn is_warning(&self) -> bool {
        self.status == CheckStatus::Warn
    }
}

// ─── Node.js requirement inference ────────────────────────────────────────────

/// Returns `(requirement_string, source_description)` derived from package.json.
fn infer_node_requirement(pkg: &Value) -> Option<(String, String)> {
    // 1. Explicit engines.node field (e.g. ">=18.0.0")
    if let Some(req) = pkg.pointer("/engines/node").and_then(|v| v.as_str()) {
        return Some((req.to_string(), "engines.node in package.json".to_string()));
    }

    // 2. Infer minimum major from @types/node devDependency
    if let Some(types_node) = pkg["devDependencies"]
        .get("@types/node")
        .and_then(|v| v.as_str())
    {
        // Strip range prefix (^, ~, >=, >, =) to get the base version string
        let stripped = types_node.trim_start_matches(|c: char| !c.is_ascii_digit());
        if let Some(major) = stripped.split('.').next().and_then(|m| m.parse::<u32>().ok()) {
            return Some((
                format!(">={}.0.0", major),
                format!("inferred from @types/node@{} in devDependencies", types_node),
            ));
        }
    }

    None
}

// ─── Individual checks ────────────────────────────────────────────────────────

fn check_node(pkg: &Value) -> CheckResult {
    let label = "Node.js".to_string();

    let installed_raw = Command::new("node")
        .arg("--version")
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string());

    let Some(installed_raw) = installed_raw else {
        return CheckResult {
            label,
            status: CheckStatus::Fail,
            installed: None,
            required: None,
            detail: Some("node not found in PATH".to_string()),
            fix_hint: Some("install Node.js from https://nodejs.org".to_string()),
        };
    };

    let Some((req_str, req_source)) = infer_node_requirement(pkg) else {
        return CheckResult {
            label,
            status: CheckStatus::Skip,
            installed: Some(installed_raw),
            required: None,
            detail: Some(
                "no Node.js requirement found (add engines.node to package.json to enable this check)"
                    .to_string(),
            ),
            fix_hint: None,
        };
    };

    // Parse operator and version from requirement string
    let (op, ver_str): (&str, &str) = if let Some(rest) = req_str.strip_prefix(">=") {
        (">=", rest.trim())
    } else if let Some(rest) = req_str.strip_prefix('^') {
        ("^", rest.trim())
    } else if let Some(rest) = req_str.strip_prefix('~') {
        ("~", rest.trim())
    } else if let Some(rest) = req_str.strip_prefix('>') {
        (">", rest.trim())
    } else {
        (">=", req_str.trim())
    };

    let installed_ver = Version::parse(&installed_raw);
    let required_ver = Version::parse(ver_str);

    match (installed_ver, required_ver) {
        (Some(inst), Some(req)) => {
            let passes = match op {
                "^" => inst.major == req.major && inst >= req,
                ">" => inst > req,
                _ => inst >= req,
            };
            CheckResult {
                label,
                status: if passes {
                    CheckStatus::Pass
                } else {
                    CheckStatus::Fail
                },
                installed: Some(installed_raw.clone()),
                required: Some(format!("{}{}", op, req)),
                detail: Some(req_source),
                fix_hint: if !passes {
                    Some(format!(
                        "installed {} does not satisfy {}{}  —  install a compatible Node.js version",
                        installed_raw, op, req
                    ))
                } else {
                    None
                },
            }
        }
        _ => CheckResult {
            label,
            status: CheckStatus::Warn,
            installed: Some(installed_raw),
            required: Some(req_str),
            detail: Some("could not parse versions for comparison".to_string()),
            fix_hint: None,
        },
    }
}

fn check_pkg_mgr(pkg: &Value, ze_dir: &PathBuf) -> CheckResult {
    // Parse packageManager field: "pnpm@11.5.2" or "pnpm@11.5.2+sha512.xxx..."
    let (pm_name, required_version) = match pkg
        .get("packageManager")
        .and_then(|v| v.as_str())
        .and_then(|f| f.split_once('@'))
    {
        Some((name, ver)) => {
            // Strip corepack content-hash suffix if present
            let clean = ver.split('+').next().unwrap_or(ver).to_string();
            (name.to_string(), Some(clean))
        }
        None => {
            // No packageManager field — fall back to lockfile detection (skip version check)
            let detected = pm::detect_pkg_mgr(ze_dir).unwrap_or_else(|_| "pnpm".to_string());
            (detected, None)
        }
    };

    let label = pm_name.clone();

    let installed_raw = cmd::as_binary(&pm_name)
        .arg("--version")
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string());

    let Some(installed_raw) = installed_raw else {
        return CheckResult {
            label,
            status: CheckStatus::Fail,
            installed: None,
            required: required_version.clone(),
            detail: Some(format!("{} not found in PATH", pm_name)),
            fix_hint: Some(format!(
                "enable corepack: corepack enable && corepack use {}@{}",
                pm_name,
                required_version.as_deref().unwrap_or("latest")
            )),
        };
    };

    let Some(required_raw) = required_version else {
        return CheckResult {
            label,
            status: CheckStatus::Skip,
            installed: Some(installed_raw),
            required: None,
            detail: Some("no packageManager field in package.json".to_string()),
            fix_hint: None,
        };
    };

    let installed_ver = Version::parse(&installed_raw);
    let required_ver = Version::parse(&required_raw);

    match (installed_ver, required_ver) {
        (Some(inst), Some(req)) => {
            let (status, detail, fix_hint) = if inst == req {
                (CheckStatus::Pass, None, None)
            } else {
                let mismatch = if inst.major != req.major {
                    format!(
                        "major version mismatch: {} installed, {} required",
                        inst, req
                    )
                } else if inst.minor != req.minor {
                    format!(
                        "minor version mismatch: {} installed, {} required",
                        inst, req
                    )
                } else {
                    format!(
                        "patch version differs: {} installed, {} required",
                        inst, req
                    )
                };
                let severity = if inst.major != req.major || inst.minor != req.minor {
                    CheckStatus::Fail
                } else {
                    CheckStatus::Warn
                };
                (
                    severity,
                    Some(mismatch),
                    Some(format!("run: corepack use {}@{}", pm_name, req)),
                )
            };
            CheckResult {
                label,
                status,
                installed: Some(installed_raw),
                required: Some(required_raw),
                detail,
                fix_hint,
            }
        }
        _ => CheckResult {
            label,
            status: CheckStatus::Warn,
            installed: Some(installed_raw),
            required: Some(required_raw),
            detail: Some("could not parse versions for comparison".to_string()),
            fix_hint: None,
        },
    }
}

fn check_git() -> CheckResult {
    let label = "Git".to_string();
    match Command::new("git").arg("--version").output() {
        Ok(output) if output.status.success() => {
            let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
            // "git version 2.44.0.windows.1" → "2.44.0.windows.1"
            let ver = raw
                .strip_prefix("git version ")
                .unwrap_or(&raw)
                .trim()
                .to_string();
            CheckResult {
                label,
                status: CheckStatus::Pass,
                installed: Some(ver),
                required: None,
                detail: None,
                fix_hint: None,
            }
        }
        _ => CheckResult {
            label,
            status: CheckStatus::Fail,
            installed: None,
            required: None,
            detail: Some("git not found in PATH".to_string()),
            fix_hint: Some("install Git from https://git-scm.com".to_string()),
        },
    }
}

fn check_dependencies(ze_dir: &PathBuf) -> CheckResult {
    let label = "node_modules".to_string();
    let installed = pm::check_dependencies(ze_dir);
    CheckResult {
        label,
        status: if installed {
            CheckStatus::Pass
        } else {
            CheckStatus::Fail
        },
        installed: Some(if installed {
            "installed".to_string()
        } else {
            "not installed".to_string()
        }),
        required: None,
        detail: None,
        fix_hint: if !installed {
            Some("run: zedc setup".to_string())
        } else {
            None
        },
    }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

fn print_section(title: &str) {
    println!("\n{}", title.bold().blue());
    println!("{}", "─".repeat(title.len()).blue());
}

pub async fn handle_cmd() -> Result<()> {
    let workspace = std::env::current_dir().unwrap_or_default();
    let ze_dir = find_dir_match(&["package.json"])?.unwrap_or(workspace.clone());

    let pkg_json: Value = std::fs::read_to_string(ze_dir.join("package.json"))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(Value::Object(Default::default()));

    println!(
        "{}",
        "Zowe Explorer Dev Environment Doctor".bold().green()
    );
    println!("{}", "=".repeat(40).green());

    let mut results: Vec<CheckResult> = Vec::new();

    print_section("Runtime Checks");
    let r = check_node(&pkg_json);
    r.print();
    results.push(r);

    let r = check_pkg_mgr(&pkg_json, &ze_dir);
    r.print();
    results.push(r);

    let r = check_git();
    r.print();
    results.push(r);

    print_section("Workspace Checks");
    let r = check_dependencies(&ze_dir);
    r.print();
    results.push(r);

    // Summary
    let fails = results.iter().filter(|r| r.is_failure()).count();
    let warns = results.iter().filter(|r| r.is_warning()).count();

    println!();
    if fails == 0 && warns == 0 {
        println!("{}", "✓  No issues found.".bold().green());
    } else {
        if fails > 0 {
            println!(
                "{}",
                format!("✗  {} issue(s) require attention.", fails)
                    .bold()
                    .red()
            );
        }
        if warns > 0 {
            println!(
                "{}",
                format!("⚠  {} warning(s) found.", warns).bold().yellow()
            );
        }
    }

    if fails > 0 {
        std::process::exit(1);
    }

    Ok(())
}